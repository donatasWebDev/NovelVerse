import asyncio
import websockets
import signal
import os
import numpy as np
import logging
import threading
import uuid
import json
import requests
import io
import wave
from pydub import AudioSegment  # Import the AudioSegment class from pydub
import base64

from tasks.task_queue import TaskQueue, worker_function, Task
from scarping.scrape import scrape_new_novel, scrape_novel_chapter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

MAX_WORKERS = 2
MAX_FAILED_ATTEMPTS = 3
WPM = 175
SAMPLE_RATE = 24000
BLOCK_SIZE = 1024
DTYPE = 'float32'
INITIAL_BUFFER_DURATION_SECONDS = 20
SAMPLE_WIDTH = 2
CHANNELS = 1
packet_size = 2048  # Size of each packet to be sent
backlog_ratio = 0.1  # Adjust this ratio for smoother streaming


URL = "http://localhost:4000/api/lib/verify"
task_queue = TaskQueue( DTYPE, SAMPLE_RATE, BLOCK_SIZE, MAX_WORKERS)
isReady = False

WPM = 200  # words per minute for speech duration calculation
MAX_FAILED_ATTEMPTS = 5


# Each socket gets its own buffers and task state

buffer_data = {}  
buffer_data_lock = asyncio.Lock()

socket_data = {}
socket_data_lock = threading.Lock()

connected_clients = set()



def handle_exit():
    """Handles cleanup actions before exiting."""
    print("Performing cleanup...")
    print("Exiting...")
    task_queue.stop()
    # os.kill(os.getpid(), signal.SIGTERM)'

def stop_audio_stream_id(worker_id):
    task_queue.stop_worker(worker_id)
    logging.info(f"Audio stream with ID {worker_id} stopped.")

def json_to_bytes(data):
    return json.dumps(data).encode("utf-8") + b"\n"

async def send_message(message, websocket, messageType="info", needResponse=False):
    try:
        # print(message)  #? echo
        payload = {
            "message": message,
            "type": messageType
        }
        
        await websocket.send(json.dumps(payload))
    except Exception as e:
        logging.error(f"Error sending message: {e}")
        await websocket.close()
        handle_exit()

async def send_audio_chunk(websocket):
    """Encodes and sends an audio chunk as MP3 via WebSocket from the primary buffer."""
    sample_rate = SAMPLE_RATE
    channels = 1
    sample_width = 2  # 2 bytes for 16-bit PCM
    # MIN_CHUNK_MS = 200 # Minimum chunk duration in milliseconds OG 200
    MIN_CHUNK_SIZE = BLOCK_SIZE * 2 


    async with buffer_data_lock:
        if websocket not in buffer_data:
            logging.info(f"Buffer data for {websocket} not found during send_audio_chunk.")
            return

        buf_info = buffer_data[websocket]
        
        # Check if enough data is in the primary buffer to form a minimum chunk
        if len(buf_info["primary_buffer"]) < MIN_CHUNK_SIZE:
            logging.info(f"Primary buffer ({len(buf_info['primary_buffer'])} bytes) too small for MIN_CHUNK_SIZE ({MIN_CHUNK_SIZE} bytes). Skipping send.")
            return

        send_sz = max(
            (len(buf_info["primary_buffer"]) * (1 - backlog_ratio)) // packet_size * packet_size,
            packet_size
        )
        
        # Ensure we always send at least MIN_CHUNK_SIZE if available
        logging.info(f"SZ: {send_sz}")
        if send_sz < MIN_CHUNK_SIZE:
            if len(buf_info["primary_buffer"]) >= MIN_CHUNK_SIZE:
                # If primary buffer has enough for MIN_CHUNK_SIZE, adjust send_sz
                send_sz = (MIN_CHUNK_SIZE // packet_size + (1 if MIN_CHUNK_SIZE % packet_size != 0 else 0)) * packet_size
                send_sz = min(send_sz, len(buf_info["primary_buffer"])) # Don't take more than available
            else:
                logging.info(f"Primary buffer ({len(buf_info['primary_buffer'])} bytes) has less than MIN_CHUNK_SIZE ({MIN_CHUNK_SIZE} bytes) even for calculated send_sz. Cannot send yet.")
                return # Not enough data for MIN_CHUNK_SIZE, so don't send

        # Ensure send_sz is not 0
        if send_sz == 0:
            logging.info("Calculated send_sz is 0. No data to send.")
            return

        # Extract the chunk from the primary buffer
        chunk = buf_info["primary_buffer"][:int(send_sz)]
        buf_info["primary_buffer"] = buf_info["primary_buffer"][int(send_sz):]

    try:
        # Create AudioSegment directly from raw PCM
        audio_segment = AudioSegment(
            chunk,
            frame_rate=sample_rate,
            sample_width=sample_width,
            channels=channels
        )

        # Convert AudioSegment to MP3 in memory
        mp3_bytes_io = io.BytesIO()
        audio_segment.export(mp3_bytes_io, format="mp3")

        mp3_bytes = mp3_bytes_io.getvalue()

        # Base64 encode the MP3 data
        base64_mp3 = base64.b64encode(mp3_bytes).decode('utf-8')
        data = {"audio_bytes": base64_mp3}
        await send_message(data, websocket, "audio")

        # Compute playback time of this chunk and return it for asyncio.sleep
        samples = send_sz // sample_width
        duration_s = samples / sample_rate
        return 0.1

    except Exception as e:
        logging.info(f"Error converting to MP3 or sending: {e}")
        # Consider clearing the buffer or signaling an error state
        with buffer_data_lock:
            if websocket in buffer_data:
                buffer_data[websocket]["primary_buffer"] = bytearray() # Clear buffer on error
                buffer_data[websocket]["secondary_buffer"] = bytearray()
        stop_task(websocket)
        return 0 # Return 0 duration on error to prevent long waits
    
async def scrape_novel(url, ch_nr, websocket):
    if url and ch_nr and websocket:
        title_received, chapters, base_url = scrape_new_novel(url)
        if ch_nr.isdigit() and len(chapters) > 0 and int(ch_nr) != 0:
            title_chapter, chapterURL = chapters[int(ch_nr)-1]
            logging.info(f"Loaded chapter: {title_received} {chapterURL} ")
            if chapterURL:
                title,text = scrape_novel_chapter(chapterURL)
                with socket_data_lock:
                    prev_data = socket_data.get(websocket, {})  # Get existing data or empty dict
                    socket_data[websocket] = {**prev_data, "title": title, "text": text, "chapters": chapters, "base_url": base_url}
                await generate_audio(f"{title}\n\n{text}", websocket)
                # await send_message(f"Generating chapter", websocket)
                return
        else:
            await send_message(f"Invalid chapter number. Use 'help' for available commands.", websocket, "info", True)
            print(ch_nr)

def get_data(websocket):
    with socket_data_lock:
        return socket_data.get(websocket, {})  # Get existing data or empty dict
     

async def generate_audio(text, websocket):
    print("generating audio")
    await send_message("generating audio", websocket)
    if not text:
        logging.warning("No text provided. Skipping audio stream creation.")
        await send_message("No text provided. Skipping audio stream creation.", websocket, "error")
        return

    logging.info(f"Starting to create audio stream: {text}")
    await send_message(f"Starting to create audio stream: {text}", websocket, "info")

    task_id = str(uuid.uuid4())
    duration = (len(text.split()) / WPM) * 60
    await send_message({"duration": duration, "WPM": WPM, "text": text}, websocket, "audio-info")
    with socket_data_lock:
        task_queue.put_task(Task(task_id, websocket, text))



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
            res = await asyncio.to_thread(task_queue.get_result, timeout=2)
           
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
            res_task_id, res_socket_id, chunk, is_end = res
            data_payload =  chunk
            if is_end:
                logging.info(f"End-of-stream marker for {websocket}")
                await send_message({"end_stream": True}, websocket, "end")
                break

            if isinstance(data_payload, bytes):
                error_message = data_payload.decode('utf-8', errors='ignore')
                logging.error(f"Worker {res_task_id} sent an error: {error_message}")
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
        print(res.text)
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
        print(dataObj)
        res = requests.post(url=URL, json=dataObj)
        if res.status_code != 200:
            print(res.status_code, res.text)
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
    task_id = data["task_id"]
    if task_id:
        task_queue.stop_worker(task_id)
        return True
    return False

async def handle_client(websocket):
    client_address = websocket.remote_address
    connected_clients.add(websocket)
    print(f"New connection! Total users: {len(connected_clients)}")
    print(f"Accepted connection from {client_address}")
    await send_message(f"Server accepted connection and is Ready to go \n", websocket)

    try:
        # Get and check user key
        user_data = await websocket.recv()
        print(f"Received user_data: '{user_data}'")
        if not user_data:
            logging.error(f"Invalid key received from {client_address}")
            await send_message(f"No key found", websocket)
            return
        user_data = user_data.strip().split(",")
        print(f"Split user_data: {user_data}")
        if user_data and len(user_data) > 0:
            token = user_data[0]
            user_id = user_data[1] # This line could cause an IndexError
            data = None
            with socket_data_lock:
                data = socket_data.get(websocket, None)
            if data:
                for user in data:
                    if user and user["user_id"] == user_id:
                        await send_message(f"User {user_id} already connected", websocket)
                        return
            await add_user(user_id, token, websocket)

            # # **Create an async task for message handling**
            message_handler_task = asyncio.create_task(handle_messages(websocket, client_address))

            # **Keep handle_client running until the connection is closed (e.g., when handle_messages finishes)**
            try:
                await message_handler_task
            except websockets.exceptions.ConnectionClosedOK:
                logging.info(f"Connection closed normally for {client_address}")
            except websockets.exceptions.ConnectionClosedError:
                logging.info(f"Connection closed with error for {client_address}")
            else:
                logging.warning(f"Received empty user_data after split from {client_address}")
                await send_message(f"Empty user data received", websocket)
                return


    except Exception as e:
        logging.error(f"Error in handle_client for {client_address}: {e}")
        await send_message(f"Server error: {e}", websocket)
        await websocket.close()

async def handle_messages(websocket, client_address):
    """Handles incoming messages from a single WebSocket client."""
    try:
        async for data in websocket:
            print( data )
            data = data.strip()
            print(f"Received from {client_address}: {data}")
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
        print(f"Error with {client_address}: {e}")
    finally:
        connected_clients.remove(websocket)
        print(f"User disconnected. Total users: {len(connected_clients)}")


async def run_server(port):
    host = '0.0.0.0'
    # host = '127.0.0.1'
    port = port
    print(f"Server listening on {host}:{port}")
    signal.signal(signal.SIGINT, lambda sig, frame: handle_exit())
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