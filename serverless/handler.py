# handler.py
import runpod
import json
import base64
import numpy as np
from pydub import AudioSegment
import io
from runpod.serverless.modules.rp_logger import RunPodLogger

# Your imports
from tts.tts_pipeline import TTSPipeline
from scarping.scrape import get_chapter_url, scrape_novel_chapter

SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2
CHANNELS = 1
WPM = 160

print("Top Line Print")

logger = RunPodLogger()

def encode_mp3(chunk_bytes):
    audio = AudioSegment(chunk_bytes, frame_rate=SAMPLE_RATE, sample_width=SAMPLE_WIDTH, channels=CHANNELS)
    buf = io.BytesIO()
    audio.export(buf, format="mp3", codec="libmp3lame")
    return buf.getvalue()

def handler(job):
    """Streaming TTS handler – yields JSON lines directly"""
    logger.info("Got new Job")
    job_input = job["input"]
    book_url = job_input.get("book_url")
    chapter_nr = job_input.get("chapter_nr")

    logger.info(f"Processing book_url={book_url}, chapter_nr={chapter_nr}")

    if not book_url or not chapter_nr:
        yield json.dumps({"status": "error", "message": "Missing book_url or chapter_nr"}) + "\n"
        return  # or raise, but yield error and exit

    chapter_url = get_chapter_url(book_url, chapter_nr)
    text = scrape_novel_chapter(chapter_url)

    if not text:
        yield json.dumps({"status": "error", "message": "Failed to scrape chapter"}) + "\n"
        return

    # Initial status
    yield json.dumps({"status": "started"}) + "\n"

    word_count = len(text.split())
    duration = (word_count / WPM) * 60
    yield json.dumps({
        "status": "audio-info",
        "duration": duration,
        "WPM": WPM,
        "text_length": len(text)  # or full text if small enough
    }) + "\n"

    pipeline = TTSPipeline(dtype='float32', block_size=19200*3, sample_rate=SAMPLE_RATE)

    try:
        for isFinal, block in pipeline.generate_audio_chunks(text):
            pcm_int16 = (block * 32767).astype(np.int16)
            pcm_bytes = pcm_int16.tobytes()

            if isFinal:
                silence_samples = int(0.2 * SAMPLE_RATE)
                silence = np.zeros(silence_samples, dtype=np.int16).tobytes()
                pcm_bytes += silence

            mp3_bytes = encode_mp3(pcm_bytes)

            payload = {
                "status": "chunk",
                "audio_bytes": base64.b64encode(mp3_bytes).decode('utf-8')
            }
            yield json.dumps(payload) + "\n"

        yield json.dumps({"status": "complete"}) + "\n"

    except Exception as e:
        logger.error(f"Error in TTS generation: {str(e)}")
        yield json.dumps({"status": "error", "message": str(e)}) + "\n"

# Start the serverless listener
runpod.serverless.start({
    "handler": handler,
    "return_aggregate_stream": True  # Optional: aggregates chunks for /run if needed
})

# The lines below are for safety/debug – they should never run in production
logger.error("!!! START RETURNED – THIS SHOULD NEVER PRINT !!!")
import sys
sys.exit(1)