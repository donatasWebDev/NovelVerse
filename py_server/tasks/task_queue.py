# tasks/task_queue.py

import threading
import logging
import torch
import uuid
import queue
from tts.tts_pipeline import TTSPipeline

MAX_WORKERS = 3

class Task:
    def __init__(self, task_id, socket_id, text, is_canceled=False):
        self.task_id = task_id
        self.socket_id = socket_id
        self.text = text
        self.is_canceled = is_canceled

class TaskQueue:
    def __init__(self, dtype, sample_rate, block_size, num_workers=MAX_WORKERS):
        self.num_workers = num_workers
        self.request_queue = queue.Queue()
        self.response_queue = queue.Queue()
        self.dtype = dtype
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.workers_initialized = threading.Event()
        self.worker_barrier = threading.Barrier(self.num_workers + 1)
        self.workers = {}

        logging.info(f"TaskQueue using device: {self.device}")

    def start(self, worker_function):
        for _ in range(self.num_workers):
            worker_id = str(uuid.uuid4())
            stop_event = threading.Event()
            t = threading.Thread(
                target=worker_function,
                args=(self.request_queue, self.response_queue,
                      self.device, self.dtype, self.sample_rate,
                      self.block_size, worker_id, stop_event, self.worker_barrier),
                daemon=True
            )
            self.workers[worker_id] = {"thread": t, "stop_event": stop_event}
            t.start()
            logging.info(f"Started worker {worker_id}")

        self.worker_barrier.wait()
        self.workers_initialized.set()
        logging.info("All workers initialized.")

    def wait_for_initialization(self):
        self.workers_initialized.wait()

    def put_task(self, task: Task):
        logging.info(f"Queueing task {task.task_id} for socket {task.socket_id}")
        self.request_queue.put(task)

    def get_result(self, timeout=1):
        try:
            return self.response_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def stop(self):
        for worker_id, info in self.workers.items():
            info["stop_event"].set()
        logging.info("Stopping all workers.")


# Worker function
def worker_function(request_queue, response_queue, device,
                    dtype, sample_rate, block_size,
                    worker_id, stop_event, worker_barrier):

    logging.info(f"Worker {worker_id} ready at barrier.")
    worker_barrier.wait()
    logging.info(f"Worker {worker_id} started.")

    while not stop_event.is_set():
        try:
            task: Task = request_queue.get(timeout=0.1)
        except queue.Empty:
            continue

        if task.is_canceled:
            logging.info(f"Worker {worker_id}: Task {task.task_id} canceled.")
            continue

        logging.info(f"Worker {worker_id}: Starting task {task.task_id} for socket {task.socket_id}")

        try:
            # NEW: reset pipeline for each task to avoid shared state
            tts_pipeline = TTSPipeline(worker_id, dtype, sample_rate, block_size, stop_event)

            for chunk_worker_id, chunk in tts_pipeline.generate_audio_chunks(task.text):
                response_queue.put((task.task_id, task.socket_id, chunk, False))

            response_queue.put((task.task_id, task.socket_id, "END_OF_STREAM_MARKER", True))

        except Exception as e:
            logging.error(f"Worker {worker_id} error on task {task.task_id}: {e}", exc_info=True)
