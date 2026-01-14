import uuid
import torch
import kokoro
import logging
import numpy as np
import threading

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TTSPipeline:
    def __init__(self, dtype, block_size: int, sample_rate:int):  # Add buffer_size parameter
        """Initializes the Kokoro TTS pipeline."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logging.info(f"TaskQueue using device: {self.device}")
        self.dtype = dtype
        self.block_size = block_size
        self.worker_id = str(uuid.uuid4())
        self.sample_rate = sample_rate
        self.pipeline = kokoro.KPipeline(lang_code='a', device=self.device)
        self._buffer = np.array([], dtype=self.dtype) # Internal buffer for fractional blocks

    def generate_audio_chunks(self, text):
        """Generates audio from text with robust cancellation support."""
        logging.info(f"Kokoro Wrapper: Starting speech generation for text.")

        try:
            if not text:
                logging.info("No text provided. Stopping speech generation.")
                return

            generator = self.pipeline(text, voice='am_adam', speed=1, split_pattern=r'\n+')

            for _, _, audio_tensor in generator:

                if not isinstance(audio_tensor, torch.Tensor):
                    logging.info(f"Expected torch.Tensor, got {type(audio_tensor)}. Skipping chunk.")
                    continue

                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)
                self._buffer = np.concatenate((self._buffer, raw_chunk))

                # Flush buffer in blocks, check cancellation at every iteration
                while len(self._buffer) >= self.block_size:
                    block = self._buffer[:self.block_size]
                    self._buffer = self._buffer[self.block_size:]
                    yield (False, block)

            # Yield any remaining partial block
            if len(self._buffer) > 0:
                padded_block = np.pad(self._buffer, (0, self.block_size - len(self._buffer)),
                                    mode='constant', constant_values=0).astype(self.dtype)
                yield (True, padded_block)

            logging.info(f"Task {self.worker_id}: Finished generating all blocks for text.")

        except Exception as e:
            logging.info(f"TTS pipeline error: {e}", exc_info=True)
            yield (True, str(e).encode('utf-8'))  # Yield error as bytes
        finally:
        # Clear internal buffer no matter what
            self._buffer = np.array([], dtype=self.dtype)
            logging.debug(f"Task {self.worker_id}: Internal buffer cleared.")
