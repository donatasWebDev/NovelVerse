from pydub import AudioSegment
import io
import hashlib

SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2
CHANNELS = 1

def encode_opus(float32_array):
    audio = AudioSegment(
        float32_array,
        frame_rate=SAMPLE_RATE,
        sample_width=4,          # float32 = 4 bytes
        channels=CHANNELS,
    )
    buf = io.BytesIO()
    audio.export(
        buf,
        format="opus",
        codec="libopus",
        bitrate="32k"  # speech sweet spot
    )
    return buf.getvalue()


def get_s3_key(book_url: str, chapter_nr: int | str) -> str:

    normalized = book_url.strip().lower().rstrip('/')
    
    #hash md5
    h = hashlib.md5(normalized.encode('utf-8')).hexdigest()
    
    short_hash = h[:16]
    
    # Consistent naming
    return f"audio/{short_hash}/chapter_{chapter_nr}-v1.opus"