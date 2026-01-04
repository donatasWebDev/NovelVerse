import asyncio
import websockets
import signal
import os
import numpy as np

import threading
import uuid
import json
import requests
import io
import wave
from pydub import AudioSegment  # Import the AudioSegment class from pydub
import base64

from tasks.task_queue import TaskQueue, worker_function, Task
from scarping.scrape import get_chapter_url, scrape_novel_chapter

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

MAX_WORKERS = 2
WPM = 175
SAMPLE_RATE = 24000
BLOCK_SIZE = 1024
DTYPE = 'float32'
INITIAL_BUFFER_DURATION_SECONDS = 20
SAMPLE_WIDTH = 2
CHANNELS = 1
packet_size = 2048  # Size of each packet to be sent
backlog_ratio = 0.1  # Adjust this ratio for smoother streaming


URL = os.getenv("NODE_BACK_URL", "http://host.docker.internal:4000")+"/api/lib/verify"
task_queue = TaskQueue( DTYPE, SAMPLE_RATE, BLOCK_SIZE, MAX_WORKERS)
isReady = False

WPM = 200  # words per minute for speech duration calculation
MAX_FAILED_ATTEMPTS = 5


ffmpeg_path = os.path.join(os.getcwd(), "ffmpeg.exe")  # project root
AudioSegment.ffmpeg = ffmpeg_path
AudioSegment.ffprobe = ffmpeg_path.replace("ffmpeg.exe", "ffprobe.exe")
AudioSegment.converter = ffmpeg_path

# Each socket gets its own buffers and task state

buffer_data = {}  
buffer_data_lock = asyncio.Lock()

socket_data = {}
socket_data_lock = threading.Lock()

active_tasks = {}
active_tasks_lock = asyncio.Lock()

connected_clients = set()



def handle_exit():
    """Handles cleanup actions before exiting."""
    print("Performing cleanup...")
    print("Exiting...")
    task_queue.stop()
    # os.kill(os.getpid(), signal.SIGTERM)'
def json_to_bytes(data):
    return json.dumps(data).encode("utf-8") + b"\n"

async def send_message(message, websocket, messageType="info", needResponse=False):
    payload = {
        "message": message,
        "type": messageType
    }

    try:
        await websocket.send(json.dumps(payload))
    except websockets.exceptions.ConnectionClosedOK as e:
        logging.info(f"Connection closed normally: {e}")
    except websockets.exceptions.ConnectionClosedError as e:
        logging.info(f"Connection closed with error: {e}")
    except Exception as e:
        logging.error(f"Error sending message: {e}")
    finally:
        # DON'T remove here — do in finally of handle_client
        pass
async def send_audio_chunk(websocket):
    sample_rate = SAMPLE_RATE
    channels = 1
    sample_width = 2
    MIN_CHUNK_SIZE = BLOCK_SIZE * 2

    async with buffer_data_lock:
        if websocket not in buffer_data:
            return 0

        buf_info = buffer_data[websocket]

        if len(buf_info["primary_buffer"]) < MIN_CHUNK_SIZE:
            return 0

        # Calculate send_sz same as before...
        send_sz = max(
            (len(buf_info["primary_buffer"]) * (1 - backlog_ratio)) // packet_size * packet_size,
            packet_size
        )

        if send_sz < MIN_CHUNK_SIZE:
            if len(buf_info["primary_buffer"]) >= MIN_CHUNK_SIZE:
                send_sz = (MIN_CHUNK_SIZE // packet_size + (1 if MIN_CHUNK_SIZE % packet_size != 0 else 0)) * packet_size
                send_sz = min(send_sz, len(buf_info["primary_buffer"]))
            else:
                return 0

        if send_sz == 0:
            return 0

        chunk = buf_info["primary_buffer"][:int(send_sz)]
        buf_info["primary_buffer"] = buf_info["primary_buffer"][int(send_sz):]

        if len(chunk) == 0:
            return 0

        if len(chunk) % (sample_width * channels) != 0:
            padding_needed = (sample_width * channels) - (len(chunk) % (sample_width * channels))
            chunk += b'\0' * padding_needed

    # OFFLOAD HEAVY MP3 ENCODE TO THREAD — NO BLOCK
    def encode_mp3():
        audio_segment = AudioSegment(
            chunk,
            frame_rate=sample_rate,
            sample_width=sample_width,
            channels=channels
        )
        mp3_io = io.BytesIO()
        audio_segment.export(mp3_io, format="mp3", codec="libmp3lame")
        return mp3_io.getvalue()

    try:
        mp3_bytes = await asyncio.to_thread(encode_mp3)

        base64_mp3 = base64.b64encode(mp3_bytes).decode('utf-8')
        data = {"audio_bytes": base64_mp3}
        await send_message(data, websocket, "audio")

        duration_s = len(chunk) / (sample_rate * channels * sample_width)
        return duration_s

    except Exception as e:
        logging.error(f"Chunk encode/send error: {e}")
        async with buffer_data_lock:
            if websocket in buffer_data:
                buffer_data[websocket]["primary_buffer"] = bytearray()
                buffer_data[websocket]["secondary_buffer"] = bytearray()
        try:
            connected_clients.remove(websocket)
        except:
            pass
        await websocket.close()
        return 0
    
async def scrape_novel(url, ch_nr, websocket):
    if url and ch_nr and websocket:
        chapterUrl = get_chapter_url(url, ch_nr)
        logging.info(f"Loaded chapter: {ch_nr} {chapterUrl} ")
        if chapterUrl:
            text = scrape_novel_chapter(chapterUrl)
            if not text:
                logging.error("Failed to scrape chapter content.")
                await send_message(f"Failed to scrape chapter content. Use 'help' for available commands.", websocket, "info", True)
                return
            with socket_data_lock:
                prev_data = socket_data.get(websocket, {})  # Get existing data or empty dict
                socket_data[websocket] = {**prev_data, "text": text, "base_url": url}
            await generate_audio(f"{text}", websocket)
            # await send_message(f"Generating chapter", websocket)
            return
        else:
            await send_message(f"Invalid chapter number. Use 'help' for available commands.", websocket, "info", True)
            print(ch_nr)

def get_data(websocket):
    with socket_data_lock:
        return socket_data.get(websocket, {})  # Get existing data or empty dict


async def watch_websocket_disconnect(websocket):
    try:
        await websocket.wait_closed()  # Waits until client disconnects
    finally:
        async with active_tasks_lock:
            task_queue.cleanup_socket(websocket)
            if websocket in active_tasks:
                t = active_tasks.pop(websocket)
                t.cancel()
                logging.info(f"WebSocket {websocket} disconnected — canceled Task {t.task_id}")

async def generate_audio(text, websocket):
    logging.info("generating audio")
    await send_message("generating audio", websocket)
    if not text:
        logging.warning("No text provided. Skipping audio stream creation.")
        await send_message("No text provided. Skipping audio stream creation.", websocket, "error")
        return

    logging.info(f"Starting to create audio stream: {text}")
    # await send_message(f"starting audio generation", websocket, "info")
    # await send_message(f"{text}", websocket, "info_script")

    task_id = str(uuid.uuid4()) # Generate a unique task ID
    duration = (len(text.split()) / WPM) * 60
    await send_message({"duration": duration, "WPM": WPM, "text": text}, websocket, "audio-info")
    with socket_data_lock:
        prev_data = socket_data.get(websocket, {})
        socket_data[websocket] = {**prev_data, "task_id": task_id} # Store the unique task_id
        task = Task(task_id, websocket, text)
        async with active_tasks_lock:
            active_tasks[websocket] = task
        asyncio.create_task(watch_websocket_disconnect(websocket))
        task_queue.put_task(task) # Pass the unique task_id to the Task constructor



    # Initialize buffers
    async with buffer_data_lock:
        buffer_data[websocket] = {
            "primary_buffer": bytearray(),
            "secondary_buffer": bytearray(),
            "failed_attempts": 0,
            "warm_up": False
        }

    try:
        while True:

            res = await asyncio.to_thread(task_queue.get_result, websocket, timeout=10)

            if res is None:
                should_break_loop = False
                async with buffer_data_lock:
                    fa = buffer_data[websocket]["failed_attempts"]
                    if fa < MAX_FAILED_ATTEMPTS:
                        buffer_data[websocket]["failed_attempts"] += 1
                    else:
                        logging.error(f"Exceeded MAX_FAILED_ATTEMPTS ({MAX_FAILED_ATTEMPTS}) for {websocket}. Forcing stream end due to continuous timeouts.")
                        await send_message({"end_stream": True}, websocket, "end")
                        should_break_loop = True
                
                if should_break_loop:
                    break

                await asyncio.sleep(0.1)
                continue
            res_task, chunk, is_end = res
            data_payload =  chunk

            if task.is_canceled():
                logging.info(f"WebSocket {websocket} Task canceled. Stopping audio generation.")
                break

            if is_end:
                logging.info(f"End-of-stream marker for {websocket}")
                await send_message({"end_stream": True}, websocket, "end")
                break

            if isinstance(data_payload, bytes):
                error_message = data_payload.decode('utf-8', errors='ignore')
                logging.error(f"Worker {res_task.task_id} sent an error: {error_message}")
                await send_message({"error": f"Worker error: {error_message}"}, websocket, "error")
                continue # Skip processing this chunk, go to the next iteration
           
            logging.debug(f"Received audio data from task_queue. Resetting failed attempts.")
            async with buffer_data_lock:
                buffer_data[websocket]["failed_attempts"] = 0 

            audio_data = data_payload
            pcm_bytes = (audio_data * 32767).astype(np.int16).tobytes()


            bytes_per_second = SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS
            initial_bytes_target = int(INITIAL_BUFFER_DURATION_SECONDS * bytes_per_second)
            logging.info(f"Targeting initial buffer of {INITIAL_BUFFER_DURATION_SECONDS}s, which is {initial_bytes_target} bytes.")
            should_attempt_send = False

            # wait for prime up 20s realti audio
            async with buffer_data_lock:
                buf = buffer_data[websocket]
                buf["primary_buffer"].extend(pcm_bytes)

                if not buf["warm_up"] and len(buf["primary_buffer"]) >= initial_bytes_target:
                    buf["warm_up"] = True
                    logging.info(f"WebSocket {websocket} warmed up with {len(buf['primary_buffer'])} bytes (target: {initial_bytes_target}). Starting stream.")
                
                should_attempt_send = buf["warm_up"] and len(buf["primary_buffer"]) > 0
            # output prime buff / dont stop making audio and store everthing in one buffer 
            if should_attempt_send:
                duration_s = await send_audio_chunk(websocket)
                if duration_s is not None and duration_s > 0:
                    await asyncio.sleep(duration_s) # Wait for the chunk to "play"
                else:
                    await asyncio.sleep(0.01) # Small sleep to prevent busy-waiting
            else:
                # If not warmed up yet, or no data to send after warm-up, wait briefly
                await asyncio.sleep(0.01) # Small sleep to prevent busy-waiting

            #possible souces for slow rate in not pc is timout on task Queue 

            #wait for prime


    except KeyboardInterrupt:
        logging.info("Playback interrupted.")
    except Exception as e:
        logging.error(f"Error in generate_audio for {websocket}: {e}")
    finally:
        async with buffer_data_lock:
            # Ensure buffers are cleaned up
            buffer_data.pop(websocket, None)
        logging.info(f"Cleaned up buffers for {websocket}.")

async def check_auth(websocket):
    data = {}
    with socket_data_lock:
        data = socket_data[websocket]
    if not data:
        await send_message("No user found", websocket)
        return
    user_id = data["user_id"]
    token = data["token"]
    data = {"userId": user_id, "streamKey": token}
    res = requests.post(URL, data=data)
    if res.status_code == 200:
        logging.info(res.text)
        asyncio.create_task(watch_websocket_disconnect(websocket))
        return True  

    if res.status_code != 200:
        logging.error(f"Error CheckAuth: {res.status_code}, {res.text}", {res})
        await send_message(f"User verification failed err: {res}", websocket, "error")
        return False
    

async def add_user(user_id, token, websocket):
    if not user_id or not websocket:
        await send_message("Invalid data", websocket)
        return 
    try:
        dataObj = {"userId": user_id, "streamKey": token, "message": "socket"}
        logging.info(dataObj)
        res = requests.post(url=URL, json=dataObj)
        if res.status_code != 200:
            logging.error(f"Error adding user: {res.status_code}, {res.text}")
            await send_message(f"User verification failed err: {res.text}", websocket, "error")
            await websocket.close()
            return 
        with socket_data_lock:
            prev_data = socket_data.get(websocket, {})  # Get existing data or empty dict
            socket_data[websocket] = {**prev_data, "user_id": user_id, "token": None, "is_canceled": False}
        await send_message(f"User {user_id} added", websocket)
        return
    except Exception as e:
        logging.error(f"Error adding user: {e}")
        await send_message(f"Error adding user: {e}", websocket, "error")
        return 

async def skip_to(websocket,time=0, ): 
    data = get_data(websocket)
    if not data["text"]:
        return
    full_text = data["text"]
    target_time_minutes = time / 60
    words_to_skip = int(WPM * target_time_minutes)
    words = full_text.split()
    if words_to_skip >= len(words):
        return ""  # Skip the entire text
    return " ".join(words[words_to_skip:])

async def stop_task(websocket):
    data = get_data(websocket)
    task_id = data.get("task_id")
    if task_id:
        task_queue.cancel_task(task_id)
        return True
    return False

async def handle_client(websocket):
    client_address = websocket.remote_address
    connected_clients.add(websocket)
    logging.info(f"New connection! Total users: {len(connected_clients)}")
    logging.info(f"Accepted connection from {client_address}")
    await send_message(f"Server accepted connection and is Ready to go \n", websocket)

    try:
        user_data = await websocket.recv()
        logging.info(f"Received user_data: '{user_data}'")
        user_data = user_data.strip().split(",")
        logging.info(f"Split user_data: {user_data}")
        if user_data and len(user_data) > 1:  # Safe length check
            token = user_data[0]
            user_id = user_data[1]
            await add_user(user_id, token, websocket)
            await handle_messages(websocket, client_address)
        else:
            await send_message(f"Invalid user data", websocket, "error")
    except websockets.exceptions.ConnectionClosedOK:
        logging.info(f"Connection closed normally for {client_address}")
    except websockets.exceptions.ConnectionClosedError:
        logging.info(f"Connection closed with error for {client_address}")
    except Exception as e:
        logging.error(f"Error in handle_client for {client_address}: {e}")
        await send_message(f"Server error: {e}", websocket, "error")
    finally:
        # Safe remove + await close
        try:
            connected_clients.remove(websocket)
        except ValueError:
            pass
        await websocket.close()
        logging.info(f"Connection cleaned up for {client_address}")

async def handle_messages(websocket, client_address):
    """Handles incoming messages from a single WebSocket client."""
    try:
        async for data in websocket:
            logging.info(data)
            data = data.strip()
            logging.info(f"Received from {client_address}: {data}")
            data = data.split(" ")

            match data[0]:
                case "play":
                    #Scrapes and Plays the audio
                    if len(data) != 3:
                        await send_message(f"Invalid data Require (url, ch_nr)", websocket)
                        continue
                    
                    book_url = data[1].strip()
                    ch_nr = data[2].strip()
                    if not check_auth(websocket):
                        continue
                    await send_message(f"Playing book {book_url}", websocket)
                    await scrape_novel(book_url, ch_nr, websocket)
                case "to":
                    #skips time to given time
                    if len(data) != 2:
                        await send_message(f"Invalid data Require (time in Seconds)", websocket)
                        continue
                    if not get_data()["text"]:
                        await send_message(f"No audio playing", websocket)
                        continue
                    time = int(data[1])

                    text = skip_to(websocket, time)
                    if len(text) > 0:
                        isStopped = await stop_task(websocket)
                        if isStopped:
                            generate_audio(text, websocket)



    except Exception as e:
        logging.error(f"Error with {client_address}: {e}")
    finally:
        try:
            connected_clients.remove(websocket)
        except ValueError:
            pass  # Already removed — safe
        await stop_task(websocket) # Ensure task is canceled on disconnect
        logging.info(f"User disconnected. Total users: {len(connected_clients)}")

async def run_server(port):
    host = '0.0.0.0'
    # host = '127.0.0.1'
    port = port
    logging.info(f"Server listening on {host}:{port}")
    task_queue.start(worker_function)
    try:
        async with websockets.serve(handle_client, host, port) as server:
            await asyncio.Future()  # run forever
    except KeyboardInterrupt:
        handle_exit()
    finally:
        handle_exit()

if __name__ == "__main__":
    asyncio.run(run_server(port=12345))
