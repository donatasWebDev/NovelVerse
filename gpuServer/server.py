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
import uuid
import redis

# Import your real modules (adjust paths)
from tts.tts_pipeline import TTSPipeline
from tasks.task_queue import TaskChain, TaskQueue, worker_function, Task
from scarping.scrape import get_chapter_url, scrape_novel_chapter

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(threadName)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app, resources={r'/stream': {"origins": "http://localhost:5173"}})

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
MAX_WORKERS = 2
MAX_CHAINS_PER_USER = 1

r = None

if os.environ.get("ENV") == "dev":
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True,)
else:
    r = redis.Redis(
        host='novelverse-redis-knb7i1.serverless.use1.cache.amazonaws.com',
        port=6379,
        ssl=True,                   # ← This enables TLS
        decode_responses=True,
        socket_timeout=10,
        socket_connect_timeout=10,
    )

task_queue = TaskQueue( DTYPE, SAMPLE_RATE, BLOCK_SIZE, MAX_WORKERS)


def encode_mp3(chunk_bytes):

    if os.environ.get("ENV") == "dev":
        script_dir = os.path.dirname(os.path.abspath(__file__))
        ffmpeg_path = os.path.join(script_dir, "ffmpeg.exe")
        AudioSegment.ffmpeg = ffmpeg_path

    else:
        AudioSegment.ffmpeg = "ffmpeg" #Production PATH

    audio = AudioSegment(
        chunk_bytes,
        frame_rate=SAMPLE_RATE,
        sample_width=SAMPLE_WIDTH,
        channels=CHANNELS
    )
    buf = io.BytesIO()
    audio.export(buf, format="mp3", codec="libmp3lame")
    return buf.getvalue()

@app.route('/health', methods=['GET'])
def health():
    with task_queue.active_tasks_lock:
        return {"status": "healthy", "active_tasks": len(task_queue.active_tasks), "queue_size": task_queue.request_queue.qsize()}, 200

@app.route('/stream', methods=['GET', 'POST'])
def stream():
    try:
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
        else:
            data = request.args.to_dict()

        book_url = data.get("book_url")
        chapter_nr = int(data.get("chapter_nr"))
        num_preloads = int(data.get("preload", 3))

        user_ip = request.remote_addr
        book_hash = hash(book_url) & 0xffffffff
        user_chain_key = f"chain:active:{user_ip}:{book_hash}"

        current_active = r.incr(user_chain_key)
        if current_active > MAX_CHAINS_PER_USER:
            r.decr(user_chain_key)
            return {"error": f"Exceeded maximum of {MAX_CHAINS_PER_USER} active chains for this book."}, 429
        r.expire(user_chain_key, 300) # expire in 5 minutes

        if not book_url or not chapter_nr:
            return {"error": "Missing book_url or chapter_nr"}, 400
        
        task_chain = []
        
        for offset in range(num_preloads+1):  # current + preloads
            ch_nr = chapter_nr + offset
            chapter_url = get_chapter_url(book_url, ch_nr)
            text = scrape_novel_chapter(chapter_url)

            if not text:
                logger.warning(f"Failed to scrape chapter {ch_nr}")
                continue  # skip bad chapter, don't fail whole chain

            task_id = str(uuid.uuid4())
            task = Task(task_id, text, ch_nr, book_url)
            task_chain.append(task)

        if not task_chain:
            r.decr(user_chain_key)
            return {"error": "No valid chapters could be scraped"}, 400
        
        chain_id = str(uuid.uuid4())
        task_chain_obj = TaskChain(chain_id, task_chain)
        task_queue.put_chain(task_chain_obj)


        def generate():
            try:
                yield f"data: {json.dumps({'status': 'started', 'chapter': chapter_nr})}\n\n"

                duration = (len(task.text.split()) / WPM) * 60
                yield f"data: {json.dumps({'status': 'audio-info', 'duration': duration, 'WPM': WPM, 'text': task.text})}\n\n"

                sent_bytes = 0
                while True:
                    full_buffer, is_done = task_chain_obj.tasks[0].get_response()

                    pcm_bytes = b''
                    if len(full_buffer) > sent_bytes:
                        new_pcm = full_buffer[sent_bytes:]
                        sent_bytes = len(full_buffer)
                        pcm_float = np.frombuffer(new_pcm, dtype=np.float32)
                        pcm_int16 = (pcm_float * 32767).astype(np.int16)
                        pcm_bytes = pcm_int16.tobytes()

                    if is_done and pcm_bytes:
                        silence_samples = int(0.2 * SAMPLE_RATE)
                        silence_pcm = np.zeros(silence_samples, dtype=np.int16).tobytes()
                        pcm_bytes += silence_pcm

                    if not pcm_bytes:
                        if is_done:
                            yield f"data: {json.dumps({'status': 'complete'})}\n\n"
                            break
                        time.sleep(0.05)
                        continue

                    mp3_bytes = encode_mp3(pcm_bytes)
                    yield f"data: {json.dumps({'status': 'chunk', 'audio_bytes': base64.b64encode(mp3_bytes).decode('utf-8')})}\n\n"

                    if task.error:
                        yield f"data: {json.dumps({'status': 'error', 'message': task.error})}\n\n"
                        break

                    if is_done:
                        yield f"data: {json.dumps({'status': 'complete'})}\n\n"
                        break

                    time.sleep(0.05)

            except GeneratorExit:  # client disconnected
                logger.info("Client disconnected during stream")
                raise
            except Exception as e:
                logger.error(f"Stream generator error: {e}")
                print(e)
                yield {f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"}, 500
            finally:
                logger.info("Stream generator finished.")
                if user_chain_key:
                    r.decr(user_chain_key)
                    count = r.get(user_chain_key)
                    if count is None or int(count) <= 0:
                        r.delete(user_chain_key)


        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache'}
        )
    finally:
        logger.info("Stream handler finished.")


if __name__ == '__main__':
    if (r.ping()):
        print("Connected to Redis server successfully.")
    else:
        print("Failed to connect to Redis server.")
    task_queue.start(worker_function)
    app.run(host='0.0.0.0', port=6001, debug=True)