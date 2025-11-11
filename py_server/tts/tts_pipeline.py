import torch
import kokoro
import logging
import numpy as np
import threading

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TTSPipeline:
    def __init__(self, worker_id, dtype, block_size: int, sample_rate:int , stop_event: threading.Event, task):  # Add buffer_size parameter
        """Initializes the Kokoro TTS pipeline."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logging.info(f"TaskQueue using device: {self.device}")
        self.worker_id = worker_id
        self.dtype = dtype
        self.block_size = block_size
        self.task = task
        self.sample_rate = sample_rate
        self.stop_event = stop_event
        self.pipeline = kokoro.KPipeline(lang_code='a', device=self.device)
        self._buffer = np.array([], dtype=self.dtype) # Internal buffer for fractional blocks

    def generate_audio_chunks(self, text):
        """Generates audio from text with robust cancellation support."""
        logging.info(f"Kokoro Wrapper: Starting speech generation for text.")

        # Check if task was already canceled before starting
        if self.task.is_canceled() or self.stop_event.is_set():
            logging.info(f"Task {self.task.task_id} canceled before generation started.")
            return

        try:
            if not text:
                logging.info("No text provided. Stopping speech generation.")
                return

            generator = self.pipeline(text, voice='am_adam', speed=1, split_pattern=r'\n+')

            for _, _, audio_tensor in generator:
                # Mid-generation cancellation check
                if self.task.is_canceled() or self.stop_event.is_set():
                    logging.info(f"Task {self.task.task_id} canceled during generation. Stopping.")
                    return

                if not isinstance(audio_tensor, torch.Tensor):
                    logging.info(f"Expected torch.Tensor, got {type(audio_tensor)}. Skipping chunk.")
                    continue

                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)
                self._buffer = np.concatenate((self._buffer, raw_chunk))

                # Flush buffer in blocks, check cancellation at every iteration
                while len(self._buffer) >= self.block_size:
                    if self.task.is_canceled() or self.stop_event.is_set():
                        logger.info(f"Task {self.task.task_id} canceled during buffer flush.")
                        return
                    block = self._buffer[:self.block_size]
                    self._buffer = self._buffer[self.block_size:]
                    yield (self.worker_id, block)

            # Yield any remaining partial block
            if len(self._buffer) > 0:
                if self.task.is_canceled() or self.stop_event.is_set():
                    logger.info(f"Task {self.task.task_id} canceled before final block.")
                    return
                padded_block = np.pad(self._buffer, (0, self.block_size - len(self._buffer)),
                                    mode='constant', constant_values=0).astype(self.dtype)
                yield (self.worker_id, padded_block)

            logging.info(f"Task {self.task.task_id}: Finished generating all blocks for text.")

        except Exception as e:
            logging.info(f"TTS pipeline error: {e}", exc_info=True)
            yield (self.worker_id, str(e).encode('utf-8'))  # Yield error as bytes
        finally:
        # Clear internal buffer no matter what
            self._buffer = np.array([], dtype=self.dtype)
            logging.debug(f"Task {self.task.task_id}: Internal buffer cleared.")
