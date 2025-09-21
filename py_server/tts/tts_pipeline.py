import torch
import kokoro
import logging
import numpy as np
import threading

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TTSPipeline:
    def __init__(self, worker_id, dtype, block_size: int, sample_rate:int , stop_event: threading.Event  ):  # Add buffer_size parameter
        """Initializes the Kokoro TTS pipeline."""
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logging.info(f"TaskQueue using device: {self.device}")
        self.worker_id = worker_id
        self.dtype = dtype
        self.block_size = block_size
        self.sample_rate = sample_rate
        self.stop_event = stop_event
        self.pipeline = kokoro.KPipeline(lang_code='a', device=self.device)
        self._buffer = np.array([], dtype=self.dtype) # Internal buffer for fractional blocks

    def generate_audio_chunks(self, text):
        """Generates audio from text with buffering."""
        logger.info(f"Kokoro Wrapper: Starting speech generation for text.")
        try:
            if not text:
                logger.error(f"No Text received stopping speech generation")
                return
            generator = self.pipeline(text, voice='am_adam', speed=1, split_pattern=r'\n+')

            for _, _, audio_tensor in generator:
                if self.stop_event.is_set():
                    logger.info("STOP event received stopping tts")
                    break

                if not isinstance(audio_tensor, torch.Tensor):
                    logger.error(f"Expected torch.Tensor for audio chunk, but got type: {type(audio_tensor)}. Skipping chunk.")
                    continue

                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)   
                self._buffer = np.concatenate((self._buffer, raw_chunk))
 
                while len(self._buffer) >= self.block_size:
                    block = self._buffer[:self.block_size]
                    self._buffer = self._buffer[self.block_size:]
                    yield (self.worker_id, block)

            if len(self._buffer) > 0:
                logger.debug(f"Wrapper: Yielding final partial block of {len(self._buffer)} frames, padding to {self.block_size}")
                padded_block = np.pad(self._buffer, (0, self.block_size - len(self._buffer)), 
                                    mode='constant', constant_values=0).astype(self.dtype)
                yield (self.worker_id, padded_block)
                        
            logger.debug("Wrapper: Finished yielding all blocks for text.")
        except Exception as e:
            logging.error(f"TTS pipeline error: {e}")
            yield self.worker_id, str(e).encode('utf-8')  # Yield the error message as byte data.
