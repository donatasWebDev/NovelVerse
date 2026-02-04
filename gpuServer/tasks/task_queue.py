# tasks/task_queue.py

import threading
import logging
import torch
import uuid
import queue
import boto3
from tts.tts_pipeline import TTSPipeline
from caching.cache_opum import encode_opus, get_s3_key

import numpy as np

MAX_WORKERS = 3

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TaskChain:
    def __init__(self, chain_id, tasks: list):
        self.chain_id = chain_id
        self.tasks = tasks
        self.canceled = False
        self.error = None

    def is_canceled(self):
        return self.canceled
    def cancel(self):
        self.canceled = True
        for task in self.tasks:
            task.cancel()
            task.clear_buffer()
        logger.info(f"Task chain {self.chain_id} has been canceled.")
    def set_error(self, msg):
        self.error = msg
        self.canceled = True  # stop waiting


class Task:
    def __init__(self, task_id, text, ch_nr, book_url, wpm, duration, dtype='float32'):
        self.task_id = task_id
        self.text = text
        self.ch = ch_nr
        self.book_url = book_url
        self.wpm = wpm
        self.duration = duration
        self.dtype = dtype
        self.response_queues = np.array([], dtype=dtype)
        self.done = False
        self.error = None

    def cancel(self):
        self.done = True
        logger.info(f"Task {self.task_id} has been canceled.")

    def clear_buffer(self):
        self.response_queues = np.array([], dtype=self.dtype)
        logger.info(f"Task {self.task_id} buffer cleared.")

    def is_canceled(self):
        return self.done

    def put_chunk(self, chunk):
        self.response_queues = np.concatenate((self.response_queues, chunk))

    def get_response(self):
        return self.response_queues, self.done

    def mark_complete(self):
        logger.info(f"Task {self.task_id} has been completed 2.")
        self.done = True

    def set_error(self, msg):
        self.error = msg
        self.done = True  # stop waiting

class TaskQueue:
    def __init__(self, dtype, sample_rate, block_size, num_workers=MAX_WORKERS):
        self.num_workers = num_workers
        self.request_queue = queue.Queue()
        self.dtype = dtype
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.workers_initialized = threading.Event()
        self.worker_barrier = threading.Barrier(self.num_workers + 1)
        self.workers = {}
        self.active_tasks = {} # Store active tasks by task_id
        self.active_tasks_lock = threading.Lock()

        logger.info(f"TaskQueue using device: {self.device}")

    def start(self, worker_function):
        for _ in range(self.num_workers):
            worker_id = str(uuid.uuid4())
            stop_event = threading.Event()
            t = threading.Thread(
                target=worker_function,
                args=(self.request_queue,
                      self.device, self.dtype, self.sample_rate,
                      self.block_size, worker_id, stop_event, self.worker_barrier, self.active_tasks_lock, self.active_tasks),
                daemon=True
            )
            self.workers[worker_id] = {"thread": t, "stop_event": stop_event}
            t.start()
            logger.info(f"Started worker {worker_id}")

        self.worker_barrier.wait()
        self.workers_initialized.set()
        logger.info("All workers initialized.")

    def wait_for_initialization(self):
        self.workers_initialized.wait()

    def put_task(self, task: Task):
        logger.info(f"Queueing task {task.task_id}")
        with self.active_tasks_lock:
            self.active_tasks[task.task_id] = task

        self.request_queue.put(task)
    def put_chain(self, task_chain: TaskChain):
        logger.info(f"Queueing task chain of size {len(task_chain.tasks)}")
        with self.active_tasks_lock:
            self.active_tasks[task_chain.chain_id] = task_chain
        self.request_queue.put(task_chain)
    def cancel_task(self, task_id):
        with self.active_tasks_lock:
            task = self.active_tasks.get(task_id)
            if task:
                self.active_tasks.pop(task_id,None)
                task.cancel()
                logger.info(f"Task {task_id} marked as canceled.")
                # Clear per-socket response queue
                return True
        logger.warning(f"Task {task_id} not found in active tasks.")
        return False
    
    def stop(self):
        for worker_id, info in self.workers.items():
            info["stop_event"].set()
        logger.info("Stopping all workers.")


# Worker function
def worker_function(request_queue, device,
                    dtype, sample_rate, block_size,
                    worker_id, stop_event, worker_barrier, active_tasks_lock, active_tasks):

    logger.info(f"Worker {worker_id} ready at barrier.")
    worker_barrier.wait()
    logger.info(f"Worker {worker_id} started.")


    s3 = boto3.client('s3')  # ← this line uses EC2 IAM role automatically
    BUCKET_NAME = 'novelverse-audio-storage-20260131'
    while not stop_event.is_set():
        try:
            task_chain: TaskChain = request_queue.get(timeout=0.1)
        except queue.Empty:
            continue

        if task_chain.is_canceled():
            logger.info(f"Worker {worker_id}: Task chain {task_chain.chain_id} is canceled before starting.")
            continue

        logger.info(f"Worker {worker_id}: Starting task chain {task_chain.chain_id}")


        try:
            for task in task_chain.tasks:
                
                s3_key = get_s3_key(task.book_url, task.ch)
                try:
                    s3.head_object(Bucket=BUCKET_NAME, Key=s3_key)
                    logger.info(f"Worker {worker_id}: Found cached audio for task {task.task_id} in S3.")
                    task.mark_complete()
                    continue  # Object exists, skip to next task
                except Exception as e:
                    logger.info(f"cache miss for task {task.task_id} in S3")

                logger.info(f"Worker {worker_id}: Processing task {task.task_id} in chain {task_chain.chain_id}")
                if task_chain.is_canceled() or task.is_canceled():
                    logger.info(f"Worker {worker_id}: Task {task.task_id} or chain {task_chain.chain_id} is canceled. Skipping.")
                    continue
                try:
                    # Pass the task object itself to the TTSPipeline
                    tts_pipeline = TTSPipeline(worker_id, dtype, block_size, sample_rate, stop_event, task, device)

                    for isFinal, chunk in tts_pipeline.generate_audio_chunks(task.text):

                        logger.info(f"Worker {worker_id}: Generated chunk of size {len(chunk)} (isFinal={isFinal}) for task {task.task_id}")

                        if isFinal:
                            logger.info(f"Worker {worker_id}: Completed task {task.task_id}")
                            task.put_chunk(chunk)
                            task.mark_complete()
                            opus_bytes = encode_opus(task.response_queues, task)
                            s3.put_object(
                                Bucket=BUCKET_NAME,
                                Key=s3_key,
                                Body=opus_bytes,
                                ContentType='audio/ogg'
                            )
                            continue
                        task.put_chunk(chunk)
                    else:
                        continue  # Continue to next task in chain

                except Exception as e:
                    logger.error(f"Worker {worker_id} error on task {task.task_id}: {e}", exc_info=True)
                    task.set_error(str(e))
                    
                finally:
                    continue
            else:
                with active_tasks_lock:
                    active_tasks.pop(task_chain.chain_id, None)
                task_chain.cancel()
                logger.info(f"Worker {worker_id}: Completed task chain {task_chain.chain_id}")
        except Exception as e:
            logger.error(f"Worker {worker_id}: Error processing task chain {task_chain.chain_id}: {e}")
            task_chain.set_error(str(e))
        finally:
            with active_tasks_lock:
                active_tasks.pop(task_chain.chain_id, None)
