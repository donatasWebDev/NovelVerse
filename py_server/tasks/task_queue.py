# tasks/task_queue.py

import threading
import logging
import torch
import uuid
import queue
from tts.tts_pipeline import TTSPipeline

MAX_WORKERS = 3

class Task:
    def __init__(self, task_id, socket_id, text):
        self.task_id = task_id
        self.socket_id = socket_id
        self.text = text
        self._is_canceled = False
        self._cancel_lock = threading.Lock()

    def cancel(self):
        with self._cancel_lock:
            self._is_canceled = True

    def is_canceled(self):
        with self._cancel_lock:
            return self._is_canceled

class TaskQueue:
    def __init__(self, dtype, sample_rate, block_size, num_workers=MAX_WORKERS):
        self.num_workers = num_workers
        self.request_queue = queue.Queue()
        self.response_queues = {}
        self.response_queues_lock = threading.Lock()
        self.dtype = dtype
        self.sample_rate = sample_rate
        self.block_size = block_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        self.workers_initialized = threading.Event()
        self.worker_barrier = threading.Barrier(self.num_workers + 1)
        self.workers = {}
        self.active_tasks = {} # Store active tasks by task_id
        self.active_tasks_lock = threading.Lock()

        logging.info(f"TaskQueue using device: {self.device}")

    def start(self, worker_function):
        for _ in range(self.num_workers):
            worker_id = str(uuid.uuid4())
            stop_event = threading.Event()
            t = threading.Thread(
                target=worker_function,
                args=(self.request_queue, self.response_queues_lock, self.response_queues,
                      self.device, self.dtype, self.sample_rate,
                      self.block_size, worker_id, stop_event, self.worker_barrier, self.active_tasks_lock, self.active_tasks),
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
        with self.active_tasks_lock:
            self.active_tasks[task.task_id] = task
        with self.response_queues_lock:
            if task.socket_id not in self.response_queues:
                self.response_queues[task.socket_id] = queue.Queue()
        self.request_queue.put(task)

    def get_result(self, socket_id, timeout=1):
        with self.response_queues_lock:
            sock_queue = self.response_queues.get(socket_id)
        if not sock_queue:
            return None
        try:
            return sock_queue.get(timeout=timeout)
        except queue.Empty:
            return None

    def cancel_task(self, task_id):
        with self.active_tasks_lock:
            task = self.active_tasks.get(task_id)
            if task:
                task.cancel()
                logging.info(f"Task {task_id} marked as canceled.")
                # Clear per-socket response queue
                with self.response_queues_lock:
                    sock_queue = self.response_queues.get(task.socket_id)
                    if sock_queue:
                        with sock_queue.mutex:
                            sock_queue.queue.clear()
                return True
        logging.warning(f"Task {task_id} not found in active tasks.")
        return False
    
    def cleanup_socket(self, socket_id):
        with self.response_queues_lock:
            if socket_id in self.response_queues:
                with self.response_queues[socket_id].mutex:
                    self.response_queues[socket_id].queue.clear()
                del self.response_queues[socket_id]

    def stop(self):
        for worker_id, info in self.workers.items():
            info["stop_event"].set()
        logging.info("Stopping all workers.")


# Worker function
def worker_function(request_queue, response_queues_lock, response_queues, device,
                    dtype, sample_rate, block_size,
                    worker_id, stop_event, worker_barrier, active_tasks_lock, active_tasks):

    logging.info(f"Worker {worker_id} ready at barrier.")
    worker_barrier.wait()
    logging.info(f"Worker {worker_id} started.")

    while not stop_event.is_set():
        try:
            task: Task = request_queue.get(timeout=0.1)
        except queue.Empty:
            continue

        if task.is_canceled(): # Check if the task was canceled before starting
            logging.info(f"Worker {worker_id}: Task {task.task_id} already canceled before processing.")
            with active_tasks_lock:
                active_tasks.pop(task.task_id, None)
            continue

        logging.info(f"Worker {worker_id}: Starting task {task.task_id} for socket {task.socket_id}")

        try:
            # Pass the task object itself to the TTSPipeline
            tts_pipeline = TTSPipeline(worker_id, dtype, sample_rate, block_size, stop_event, task)

            for chunk_worker_id, chunk in tts_pipeline.generate_audio_chunks(task.text):
                # The cancellation check is now primarily handled within TTSPipeline
                if task.is_canceled():
                    break

                with response_queues_lock:
                    sock_queue = response_queues.get(task.socket_id)
                    if sock_queue:
                        sock_queue.put((task, chunk, False))

            else:
                # If canceled, ensure it's removed from active_tasks if it wasn't already by get_result
                with active_tasks_lock:
                    active_tasks.pop(task.task_id, None)
            
            with response_queues_lock:
                sock_queue = response_queues.get(task.socket_id)
                if sock_queue:
                    sock_queue.put((task, chunk, True))


        except Exception as e:
            logging.error(f"Worker {worker_id} error on task {task.task_id}: {e}", exc_info=True)
            with active_tasks_lock:
                active_tasks.pop(task.task_id, None) # Ensure cleanup on error
        finally:
            with active_tasks_lock:
                active_tasks.pop(task.task_id, None)