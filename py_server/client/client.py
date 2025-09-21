import time
import queue
import threading
import numpy as np
import sounddevice as sd
import torch
import kokoro # Assuming kokoro is installed and available

# --- CONFIGURATION ---
SAMPLE_RATE = 24000  # Kokoro's typical sample rate
BLOCK_SIZE = 1024    # Frames per sounddevice callback. Adjust for latency vs CPU usage.
CHANNELS = 1         # Mono audio for TTS
DTYPE_SOUNDDEVICE = 'int16' # Explicitly set sounddevice's data type to int16
QUEUE_BUFFER_SIZE = 20 # Number of audio chunks to pre-buffer

# --- Global Queue and Event for inter-thread communication ---
audio_q = queue.Queue(maxsize=QUEUE_BUFFER_SIZE)
finished_event = threading.Event()
underrun_count = 0

# --- Helper function for float32 to int16 conversion ---
def float32_to_int16(audio_float32: np.ndarray) -> np.ndarray:
    """
    Converts a float32 NumPy array (range -1.0 to 1.0) to int16 NumPy array.
    """
    if audio_float32.dtype != np.float32:
        raise ValueError("Input array must be float32")
    # Scale to int16 range and convert type
    audio_int16 = (audio_float32 * 32767).astype(np.int16)
    return audio_int16

# --- Producer Thread Function (Generates TTS) ---
def tts_producer(text_to_speak, pipeline_obj, speed_factor, voice_name):
    print("[PRODUCER] Starting TTS generation...")
    try:
        generator = pipeline_obj(text_to_speak, voice=voice_name, speed=speed_factor)
        for _, _, audio_chunk_tensor in generator:
            # 1. Convert tensor to numpy float32
            audio_chunk_float32 = audio_chunk_tensor.cpu().numpy()
            # 2. Convert float32 to int16
            audio_chunk_int16 = float32_to_int16(audio_chunk_float32)

            try:
                # Put the int16 NumPy array directly into the queue
                audio_q.put(audio_chunk_int16, timeout=5)
            except queue.Full:
                print("[PRODUCER WARNING] Queue full! Producer is faster than consumer.")
                # In a real app, you might add backpressure/pause generation
        print("[PRODUCER] All TTS chunks generated and put into queue.")
    except Exception as e:
        print(f"[PRODUCER ERROR] An error occurred during TTS generation: {e}")
    finally:
        audio_q.put(None) # Signal end of stream
        print("[PRODUCER] Signaled end of stream.")

# --- Consumer / Sounddevice Callback Function ---
# This callback expects data to be in the DTYPE_SOUNDDEVICE format (int16 numpy array)
def callback(outdata, frames, time_info, status):
    global underrun_count
    if status:
        if sd.CallbackFlags.UNDERRUN in status:
            underrun_count += 1
            print(f"[CALLBACK WARNING] Underrun detected! ({underrun_count}) - Audio buffer ran dry.")
        print(f"[CALLBACK STATUS] {status}")

    try:
        # Get the int16 NumPy array directly from the queue
        data_chunk_int16 = audio_q.get_nowait()
        if data_chunk_int16 is None: # End of stream signal received
            raise sd.CallbackStop # Stop the sounddevice stream

        # Ensure outdata has the correct shape for single channel
        if outdata.shape[1] > 1:
            # If outdata is multi-channel, only fill the first channel
            # For TTS, we usually expect mono, so outdata[:, 0] is correct.
            target_outdata_channel = outdata[:, 0]
        else:
            target_outdata_channel = outdata # If outdata is already mono, no slicing needed

        if len(data_chunk_int16) >= frames: # More than enough data for this block
            target_outdata_channel[:] = data_chunk_int16[:frames]
            # If we got more than needed, put remainder back
            if len(data_chunk_int16) > frames:
                audio_q.put_nowait(data_chunk_int16[frames:])
        else: # Not enough data for this block (partial fill)
            print(f"[CALLBACK WARNING] Partial data available ({len(data_chunk_int16)}/{frames} frames). Filling with zeros.")
            target_outdata_channel[:len(data_chunk_int16)] = data_chunk_int16
            target_outdata_channel[len(data_chunk_int16):].fill(0)
            underrun_count += 1 # This is an underrun scenario
    except queue.Empty:
        # Queue was empty, definitive underrun
        print(f"[CALLBACK WARNING] Queue empty! Filling with zeros for {frames} frames.")
        outdata.fill(0) # Fill with silence
        underrun_count += 1
    except sd.CallbackStop:
        raise sd.CallbackStop
    except Exception as e:
        print(f"[CALLBACK ERROR] An unexpected error occurred: {e}")
        outdata.fill(0)
        raise sd.CallbackStop

# --- Main Test Function ---
def run_realtime_tts_test(text_to_speak: str, requested_speed_factor: float = 1.0, voice_name: str = 'am_adam'):
    global underrun_count
    underrun_count = 0
    finished_event.clear()

    print(f"\n--- Starting Real-time TTS Test (int16 compatible) ---")
    print(f"Text: '{text_to_speak[:70]}...'")
    print(f"Requested Playback Speed Factor: {requested_speed_factor}x")

    # 1. Initialize Kokoro Pipeline
    print("[MAIN] Initializing Kokoro pipeline...")
    pipeline = KPipeline(lang_code='a', device=torch.device("cuda" if torch.cuda.is_available() else "cpu"))
    print(f"[MAIN] Kokoro pipeline initialized on device: {pipeline.model.device}.")

    # --- MEASURE TOTAL GENERATION TIME AND AUDIO LENGTH ---
    print("\n[MEASUREMENT] Generating all audio content to measure total duration and generation time...")
    measurement_start_time = time.time()
    all_chunks_for_measurement = []
    measurement_generator = pipeline(text_to_speak, voice=voice_name, speed=requested_speed_factor)
    for _, _, audio_chunk_tensor in measurement_generator:
        # Perform the float32 to int16 conversion for measurement too
        all_chunks_for_measurement.append(float32_to_int16(audio_chunk_tensor.cpu().numpy()))
    measurement_end_time = time.time()

    total_generation_time_seconds = measurement_end_time - measurement_start_time
    total_audio_samples = sum(chunk.shape[0] for chunk in all_chunks_for_measurement)
    total_audio_duration_seconds = total_audio_samples / SAMPLE_RATE

    print(f"[MEASUREMENT] Total time to generate all audio content: {total_generation_time_seconds:.4f} seconds.")
    print(f"[MEASUREMENT] Total length of generated audio content (at 1x speed): {total_audio_duration_seconds:.4f} seconds.")
    print(f"[MEASUREMENT] Expected playback duration at {requested_speed_factor}x speed: {total_audio_duration_seconds / requested_speed_factor:.4f} seconds.")

    # --- REAL-TIME STREAMING PART ---
    print("\n[STREAMING] Preparing real-time audio stream...")
    # Start Producer Thread
    producer_thread = threading.Thread(
        target=tts_producer,
        args=(text_to_speak, pipeline, requested_speed_factor, voice_name)
    )
    producer_thread.start()
    print("[STREAMING] Producer thread started.")

    # Start Sounddevice Stream
    try:
        with sd.OutputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            channels=CHANNELS,
            dtype=DTYPE_SOUNDDEVICE, # Use the int16 dtype here
            callback=callback,
            finished_callback=finished_event.set # Signal when stream finishes
        ) as stream:
            print(f"[STREAMING] Audio stream active. Output device: '{sd.query_devices(kind='output')['name']}'")
            print(f"[STREAMING] Buffering initial chunks ({QUEUE_BUFFER_SIZE} max)...")
            # Wait for some initial buffer to fill up
            while audio_q.qsize() < QUEUE_BUFFER_SIZE and producer_thread.is_alive():
                time.sleep(0.1)
            print("[STREAMING] Initial buffer filled. Playback should now start.")

            stream_playback_start_time = time.time()
            finished_event.wait() # Block until stream finishes
            stream_playback_end_time = time.time()

    except sd.PortAudioError as e:
        print(f"[STREAMING ERROR] PortAudioError: {e}")
        print("This usually means no audio device is found or configured on your system.")
        print("Please ensure PortAudio is installed and your audio devices are working.")
    except Exception as e:
        print(f"[STREAMING ERROR] An unexpected error occurred during streaming: {e}")
    finally:
        producer_thread.join()
        total_real_time_playback_duration = stream_playback_end_time - stream_playback_start_time
        print("\n--- Real-time Playback Summary ---")
        print(f"Total Actual Playback Time (stream active duration): {total_real_time_playback_duration:.4f} seconds.")
        print(f"Number of Underruns detected during playback: {underrun_count}")

        print("\n--- Final Analysis ---")
        print(f"  Target Playback Duration (at {requested_speed_factor}x speed): {total_audio_duration_seconds / requested_speed_factor:.4f} seconds")
        print(f"  Observed Real-Time Playback Duration: {total_real_time_playback_duration:.4f} seconds")
        if underrun_count == 0 and total_real_time_playback_duration <= (total_audio_duration_seconds / requested_speed_factor) * 1.05:
            print(f"  RESULT: Smooth real-time playback achieved at {requested_speed_factor}x speed with no (or negligible) underruns.")
            print(f"  Generation is fast enough to keep up with playback.")
        elif underrun_count > 0:
            print(f"  RESULT: Playback experienced {underrun_count} underruns.")
            print(f"  This indicates that generation was not consistently fast enough to feed the audio buffer, or the buffer size was insufficient.")
        else:
            print(f"  RESULT: Playback completed, but took longer than expected ({total_real_time_playback_duration:.4f}s vs {total_audio_duration_seconds / requested_speed_factor:.4f}s).")
            print(f"  This suggests the overall system (generation + buffering + sound device) is the bottleneck.")


# --- Example Usage (Run this on your LOCAL MACHINE) ---
if __name__ == "__main__":
    my_text = """
    This is a demonstration of real-time audio generation and streaming with int16 data. We are carefully converting the audio to the correct format to ensure compatibility with your sound device settings. Let's confirm if this setup provides smooth and continuous output.
    """

    # Test at 1x speed
    run_realtime_tts_test(my_text, requested_speed_factor=1.0)

    # Test at 2x speed
    # run_realtime_tts_test(my_text, requested_speed_factor=2.0)

    # You can experiment with different texts, speeds, and voices
    # run_realtime_tts_test("A shorter test at a higher speed.", requested_speed_factor=1.8, voice='af_sarah')