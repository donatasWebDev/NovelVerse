# test_local.py
import os
from flask import Flask, request, Response, stream_with_context
import json
import base64
import io
import time
import numpy as np
from pydub import AudioSegment
import logging
from flask_cors import CORS

# Import your real modules (adjust paths)
from tts.tts_pipeline import TTSPipeline
from scarping.scrape import get_chapter_url, scrape_novel_chapter

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app, resources={r"/stream": {"origins": "http://localhost:5173"}})

SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2
CHANNELS = 1
BLOCK_SIZE = 19200
DTYPE = 'float32'
INITIAL_BUFFER_DURATION_SECONDS = 20
packet_size = 2048
backlog_ratio = 0.1
MIN_CHUNK_SIZE = BLOCK_SIZE * 2
WPM = 160

def encode_mp3(chunk_bytes):
    # Option B: relative to current script location (better than ./)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ffmpeg_path = os.path.join(script_dir, "ffmpeg.exe")
    AudioSegment.ffmpeg = ffmpeg_path

    audio = AudioSegment(
        chunk_bytes,
        frame_rate=SAMPLE_RATE,
        sample_width=SAMPLE_WIDTH,
        channels=CHANNELS
    )
    buf = io.BytesIO()
    audio.export(buf, format="mp3", codec="libmp3lame")
    return buf.getvalue()

@app.route('/stream', methods=['GET', 'POST'])
def stream():
    try:
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
        else:
            data = request.args.to_dict()

        book_url = data.get("book_url")
        chapter_nr = data.get("chapter_nr")

        if not book_url or not chapter_nr:
            return {"error": "Missing book_url or chapter_nr"}, 400

        # Scrape (your function)
        chapter_url = get_chapter_url(book_url, chapter_nr)
        text = scrape_novel_chapter(chapter_url)

        if not text:
            return {"error": "Failed to scrape chapter"}, 400

        def generate():
            yield f"data: {json.dumps({'status': 'started'})}\n\n"
            duration = (len(text.split()) / WPM) * 60
            yield f"data: {json.dumps({'status': 'audio-info','duration': duration, 'WPM': WPM, 'text': text})}\n\n"
            pipeline = TTSPipeline(dtype=DTYPE, block_size=BLOCK_SIZE*3, sample_rate=SAMPLE_RATE, task=None)
            chunks_made = 0
            try:
                for isFinal, block in pipeline.generate_audio_chunks(text):
                    chunks_made += 1
                    # block is np.float32 array (from your pipeline)
                    # Convert to int16 PCM (required for pydub)
                    pcm_int16 = (block * 32767).astype(np.int16)
                    pcm_bytes = pcm_int16.tobytes()

                    if isFinal:
                    # Pad with 0.1–0.5s silence so encoder can flush properly
                        silence_samples = int(0.2 * 19200)  # adjust based on your sample rate
                        silence_pcm = np.zeros(silence_samples, dtype=np.int16)
                        pcm_bytes += silence_pcm.tobytes()

                    # MP3 encode
                    mp3_bytes = encode_mp3(pcm_bytes)

                    payload = {
                        "status": "chunk",
                        "audio_bytes": base64.b64encode(mp3_bytes).decode('utf-8')
                    }

                    yield f"data: {json.dumps(payload)}\n\n"

                yield f"data: {json.dumps({'status': 'complete'})}\n\n"
                print("chunks made: ", chunks_made)
            except Exception as e:
                print(e)
                yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache'}
        )
    finally:
        logger.info("Stream handler finished.")

if __name__ == '__main__':
    print("Running local SSE test server at http://127.0.0.1:5000/stream")
    app.run(host='0.0.0.0', port=5000, debug=True)