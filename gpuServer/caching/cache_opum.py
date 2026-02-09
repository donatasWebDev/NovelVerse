from pydub import AudioSegment
import io
import numpy as np
import hashlib
from mutagen.oggopus import OggOpus
import subprocess

SAMPLE_RATE = 48000
SAMPLE_WIDTH = 2
CHANNELS = 1

def add_metadata_ffmpeg(opus_bytes: bytes, task) -> bytes:

    # Sanitize/escape text for shell safety
    safe_text = task.text.replace('\\', '\\\\').replace('"', '\\"').replace('=', '\\=')
    # Limit length  (truncate or store elsewhere if >100KB)
    if len(safe_text) > 100_000:
        safe_text = safe_text[:100_000] + " [truncated]"

    cmd = [
        "ffmpeg",
        "-i", "pipe:0",
        "-codec", "copy",               # no re-encode
        "-map_metadata", "0",
        "-metadata", f"DURATION={task.duration:.2f}",
        "-metadata", f"LYRICS={task.text}",
        "-metadata", f"WPM={task.wpm}",
        "-f", "ogg",
        "pipe:1"
    ]
    result = subprocess.run(
        cmd,
        input=opus_bytes,
        capture_output=True,
        check=True
    )
    return result.stdout

def encode_opus(full_audio_float32: np.ndarray, task) -> bytes:
    # full_audio_float32 is the complete _buffer after generation (at 48 kHz now)
    clipped = np.clip(full_audio_float32, -1.0, 1.0)
    int16_pcm = (clipped * 32767).astype(np.int16)
    raw_bytes = int16_pcm.tobytes()

    audio = AudioSegment(
        raw_bytes,
        frame_rate=SAMPLE_RATE,
        sample_width=SAMPLE_WIDTH,
        channels=CHANNELS
    )
    buf = io.BytesIO()
    audio.export(
        buf,
        format="ogg",
        codec="libopus",
        bitrate="48k",          # or "32k" for even smaller size
        parameters=["-vbr", "on"] 
    )
    opus_bytes = buf.getvalue()

    return add_metadata_ffmpeg(opus_bytes, task)


def get_s3_key(book_url: str, chapter_nr: int | str) -> str:

    normalized = book_url.strip().lower().rstrip('/')
    
    #hash md5
    h = hashlib.md5(normalized.encode('utf-8')).hexdigest()
    
    short_hash = h[:16]
    
    # Consistent naming
    return f"audio/{short_hash}/chapter_{chapter_nr}-v1.opus"