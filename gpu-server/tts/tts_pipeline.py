import torch
import kokoro
import logging
import numpy as np
import threading

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TTSPipeline:
    def __init__(self, worker_id, dtype, block_size: int, sample_rate:int , stop_event: threading.Event, task, device=None):  # Add buffer_size parameter
        """Initializes the Kokoro TTS pipeline."""
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logging.info(f"TaskQueue using device: {self.device}")
        self.worker_id = worker_id
        self.dtype = dtype
        self.block_size = block_size
        self.task = task
        self.sample_rate = sample_rate
        self.stop_event = stop_event
        self.pipeline = kokoro.KPipeline(lang_code='a', device=self.device)

    def generate_audio_chunks(self, text):
        """Generates audio from text with robust cancellation support."""
        logging.info(f"Kokoro Wrapper: Starting speech generation for text.")

        _buffer = np.array([], dtype=self.dtype)  # local buffer, no self.

        try:
            if not text:
                logging.info("No text provided. Stopping speech generation.")
                return

            generator = self.pipeline(text, voice='am_adam', speed=1, split_pattern=r'\n+')

            for _, _, audio_tensor in generator:

                # logging.debug(f"Kokoro Wrapper: Generated audio tensor shape: {audio_tensor}")

                if not isinstance(audio_tensor, torch.Tensor):
                    logging.info(f"Expected torch.Tensor, got {type(audio_tensor)}. Skipping chunk.")
                    continue

                if self.stop_event.is_set() or self.task.is_canceled():
                    logging.info(f"Task {self.worker_id}: Cancellation detected. Stopping generation.")
                    break

                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)
                _buffer = np.concatenate((_buffer, raw_chunk))

                # Flush buffer in blocks, check cancellation at every iteration
                while len(_buffer) >= self.block_size:
                    block = _buffer[:self.block_size]
                    _buffer = _buffer[self.block_size:]
                    yield (False, block)

            # Yield any remaining partial block
            if len(_buffer) > 0:
                padded_block = np.pad(_buffer, (0, self.block_size - len(_buffer)),
                                    mode='constant', constant_values=0).astype(self.dtype)
                yield (True, padded_block)

            logging.info(f"Task {self.worker_id}: Finished generating all blocks for text.")

        except Exception as e:
            logging.info(f"TTS pipeline error: {e}", exc_info=True)
            self.task.set_error(str(e))
        finally:
            logging.debug(f"Task {self.worker_id}: Internal buffer cleared.")

