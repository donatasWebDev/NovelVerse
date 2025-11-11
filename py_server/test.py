import threading
import queue
import time
import numpy as np
import sounddevice as sd
import logging
import sys
from collections import deque
import soundfile as sf

logger = logging.getLogger(__name__)
# Attempt to import kokoro and torch
try:
    from kokoro import KPipeline
    import torch
    # Check for CUDA if available
    KOKORO_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    logging.info(f"Kokoro will use device: {KOKORO_DEVICE}")
except ImportError as e:
    logging.critical(f"Failed to import kokoro or torch: {e}")
    logging.critical("Please ensure 'kokoro' and 'torch' are installed (e.g., pip install kokoro torch).")
    logging.critical("For CUDA support, refer to PyTorch installation instructions.")
    sys.exit(1)


# --- Configuration Constants ---
SAMPLE_RATE = 24000  # Sample rate of the audio (Hz), adjust based on your Kokoro model
BLOCK_SIZE = 1024    # Block size for sounddevice callback (frames per block)
CHANNELS = 1        # Number  1 of audio channels (mono)
DTYPE = 'float32'    # Data type for audio samples (sounddevice expects float32 typically)

# Buffer control parameters
SPEED_RATE = 1
INITIAL_BUFFER_AUDIO_DURATION_SECONDS = 1  # How many seconds of audio to pre-buffer before starting playback (real time audio)
QUEUE_BUFFER_SIZE_SECONDS = 30         # Max audio to keep in the queue ahead of time (seconds)

# Logging setup


# --- Kokoro Pipeline Wrapper ---
class KokoroPipelineWrapper:
    def __init__(self, pipeline: KPipeline, block_size: int = BLOCK_SIZE, sample_rate: int = SAMPLE_RATE, dtype=DTYPE):
        self.pipeline = pipeline
        self.block_size = block_size
        self.sample_rate = sample_rate
        self.dtype = dtype
        self._buffer = np.array([], dtype=self.dtype) # Internal buffer for fractional blocks

    def generate_speech_in_blocks(self, text: str):
        logger.info(f"Kokoro Wrapper: Starting speech generation for text.")
        
        try:
            # Call the kokoro pipeline with your specified voice and parameters.
            # It yields tuples where the third element is a torch.Tensor.
            generator = self.pipeline(text, 
                                      voice='am_adam', # Use 'am_adam' as you specified
                                      speed=1, 
                                      split_pattern=r'\n+') 
            
            # Direct unpacking as confirmed
            for _, _, audio_tensor in generator: # audio_tensor will be a torch.Tensor  
                
                # --- CRITICAL FIX: Convert torch.Tensor to numpy.ndarray ---
                if not isinstance(audio_tensor, torch.Tensor):
                    logger.error(f"Expected torch.Tensor for audio chunk, but got type: {type(audio_tensor)}. Skipping chunk.")
                    continue
                
                # Convert torch tensor to numpy array and move to CPU if it's on CUDA
                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)
                # --- END CRITICAL FIX ---

                # Concatenate to internal buffer
                self._buffer = np.concatenate((self._buffer, raw_chunk))
                
                while len(self._buffer) >= self.block_size:
                    block = self._buffer[:self.block_size]
                    self._buffer = self._buffer[self.block_size:]
                    yield block

            # After all raw chunks are processed, yield any remaining data, padded if necessary
            if len(self._buffer) > 0:
                logger.debug(f"Wrapper: Yielding final partial block of {len(self._buffer)} frames, padding to {self.block_size}")
                padded_block = np.pad(self._buffer, (0, self.block_size - len(self._buffer)), 
                                      mode='constant', constant_values=0).astype(self.dtype)
                yield padded_block
            
            logger.debug("Wrapper: Finished yielding all blocks for text.")
        except Exception as e:
            logger.error(f"Error in KokoroPipelineWrapper's generate_speech_in_blocks: {e}")
            raise # Re-raise to propagate error to the producer thread
    def generate_audio_full(self, text:str):
         logger.info(f"Kokoro Wrapper: Starting speech generation for text. FULL AUDIO")
         generator = self.pipeline(text, 
                        voice='am_adam', # Use 'am_adam' as you specified
                        speed=1, 
                        split_pattern=r'\n+') 
         for _, _, audio_tensor in generator: # audio_tensor will be a torch.Tensor
                
                # --- CRITICAL FIX: Convert torch.Tensor to numpy.ndarray ---
                if not isinstance(audio_tensor, torch.Tensor):
                    logger.error(f"Expected torch.Tensor for audio chunk, but got type: {type(audio_tensor)}. Skipping chunk.")
                    continue
                
                # Convert torch tensor to numpy array and move to CPU if it's on CUDA
                raw_chunk = audio_tensor.cpu().numpy().astype(self.dtype)

                # Concatenate to internal buffer
                yield raw_chunk 


def audio_generator_static(text: str):
    try:
        OUTPUT_FILENAME = './output/testAudio.wav'
        # Initialize the actual Kokoro pipeline
        logger.info(f"Initializing KPipeline on device: {KOKORO_DEVICE}...")
        # You might need to specify a model name or path depending on your Kokoro setup
        kokoro_pipeline = KPipeline(device=KOKORO_DEVICE, lang_code="a") 
        logger.info("KPipeline initialized.")
        
        # Ensure the DTYPE matches what Kokoro is likely returning (often float32)
        kokoro_wrapper = KokoroPipelineWrapper(
            kokoro_pipeline, 
            block_size=BLOCK_SIZE, 
            sample_rate=SAMPLE_RATE, 
            dtype=DTYPE # Make sure this matches the expected NumPy array dtype
        )
        buffer = np.array([], dtype=DTYPE)
        for block in  kokoro_wrapper.generate_audio_full(text):
            buffer = np.concatenate((buffer, block))
        try:
            sf.write(OUTPUT_FILENAME, buffer, SAMPLE_RATE, subtype='FLOAT', format='WAV')
            
            logger.info(f"Successfully saved full audio to '{OUTPUT_FILENAME}' using soundfile.")
            logger.info(f"Total samples: {len(buffer)}, Duration: {len(buffer) / SAMPLE_RATE:.2f} seconds")
        except Exception as e:
            logger.error(f"Error saving WAV file with soundfile: {e}")

    except ImportError:
        logger.critical("sounddevice not found. Please install it with 'pip install sounddevice numpy'")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"An unexpected error occurred during streaming: {e}")
    finally:
        logger.info("Stopping playback and cleaning up...")
        logger.info("TTS streaming process finished.")


# --- Producer Thread Function (No changes needed here) ---
def audio_producer(text_to_synthesize: str,
                   audio_queue: queue.Queue,
                   prime_buffer_ready_event: threading.Event,
                   finished_event: threading.Event,
                   kokoro_wrapper: KokoroPipelineWrapper):
    thread_name = threading.current_thread().name
    logger.info(f"{thread_name}: Starting audio production for: '{text_to_synthesize[:50]}...'")
    
    try:
        current_queue_audio_duration = 0.0
        target_initial_buffer_frames = int(INITIAL_BUFFER_AUDIO_DURATION_SECONDS * SAMPLE_RATE)
        target_queue_max_frames = int(QUEUE_BUFFER_SIZE_SECONDS * SAMPLE_RATE)

        # --- Timing for initial buffer fill starts here ---
        initial_buffer_start_time = time.perf_counter()
        
        # Phase 1 & 2: Pre-buffer initial audio and then continuously feed
        for block_idx, block in enumerate(kokoro_wrapper.generate_speech_in_blocks(text_to_synthesize)):
            if finished_event.is_set():
                logger.info(f"{thread_name}: Playback stopped, exiting producer.")
                break
            audio_queue.put(block)
            current_queue_audio_duration += BLOCK_SIZE / SAMPLE_RATE
            
            if current_queue_audio_duration  <INITIAL_BUFFER_AUDIO_DURATION_SECONDS:
                logger.info(f"{thread_name}: Put block {block_idx}. Queue size: {audio_queue.qsize()} ({current_queue_audio_duration:.2f}s)")



            # Check if initial buffer is primed
            if not prime_buffer_ready_event.is_set() and \
               current_queue_audio_duration >= INITIAL_BUFFER_AUDIO_DURATION_SECONDS:
                prime_buffer_ready_event.set()
                # --- Timing for initial buffer fill ends here and is logged ---
                initial_buffer_end_time = time.perf_counter()
                logger.info(f"{thread_name}: Initial buffer primed ({audio_queue.qsize() * BLOCK_SIZE / SAMPLE_RATE:.2f}s) in {initial_buffer_end_time - initial_buffer_start_time:.3f}s. Signaled playback to start.")
                
            # Keep producer from getting too far ahead
            # This 'while' loop pauses the producer if the queue is full.
            while audio_queue.qsize() * BLOCK_SIZE >= target_queue_max_frames and not finished_event.is_set():
                logger.info(f"{thread_name}: Queue full ({audio_queue.qsize() * BLOCK_SIZE / SAMPLE_RATE:.2f}s), waiting...")
                time.sleep(0.1) # Wait if queue is too full to avoid excessive memory usage
        
        logger.info(f"{thread_name}: Finished putting all audio blocks into the queue.")
        # Signal that no more data will be produced by putting None
        audio_queue.put(None) 

    except Exception as e:
        logger.error(f"{thread_name}: Error during audio production: {e}")
        finished_event.set() # Signal main thread to stop
    finally:
        logger.info(f"{thread_name}: Audio producer thread exiting.")

# --- Sounddevice Playback Callback (No changes needed here) ---
def audio_callback(outdata: np.ndarray, frames: int, time_obj, status: sd.CallbackFlags,
                   audio_buffer_deque: deque, finished_event: threading.Event):
    if status:
        logger.warning(f"Sounddevice callback status: {status}")
        # if sd.CallbackFlags.Underrun in status:
        #     logger.error("Audio underrun detected! Playback might be choppy.")
        #     # Depending on desired behavior, could stop stream here or just log
        #     # finished_event.set() # Uncomment to stop on underrun
    try:
        # Fill output buffer from our internal deque
        num_frames_to_fill = frames
        current_frame_offset = 0

        while num_frames_to_fill > 0 and audio_buffer_deque:
            block = audio_buffer_deque[0]
            
            if len(block) >= num_frames_to_fill:
                # We have enough data in the current block
                print(block[:num_frames_to_fill].reshape(-1, CHANNELS))
                outdata[current_frame_offset:current_frame_offset + num_frames_to_fill] = block[:num_frames_to_fill].reshape(-1, CHANNELS)
                audio_buffer_deque[0] = block[num_frames_to_fill:] # Keep remaining part
                num_frames_to_fill = 0
            else:
                # Not enough data in current block, use all of it and get next
                outdata[current_frame_offset:current_frame_offset + len(block)] = block.reshape(-1, CHANNELS)
                current_frame_offset += len(block)
                num_frames_to_fill -= len(block)
                audio_buffer_deque.popleft() # Remove consumed block
        
        if num_frames_to_fill > 0:
            # If we still need frames, it means the deque is empty. Fill with zeros.
            logger.warning(f"Sounddevice: Not enough data in buffer. Filling {num_frames_to_fill} frames with zeros.")
            outdata[current_frame_offset:current_frame_offset + num_frames_to_fill] = 0.0

    except Exception as e:
        logger.critical(f"Error in sounddevice callback: {e}")
        finished_event.set() # Critical error, signal main thread to stop


# --- Main Orchestration Logic ---
def stream_tts_audio(text: str):
    print("started", len(text))
    # Max size for the audio_queue (number of blocks)
    queue_max_blocks = int(QUEUE_BUFFER_SIZE_SECONDS * SAMPLE_RATE / BLOCK_SIZE) + 2
    audio_queue = queue.Queue(maxsize=queue_max_blocks) 
    # Events for synchronization between threads
    prime_buffer_ready_event = threading.Event() # Producer signals when initial buffer is full
    finished_event = threading.Event()           # Any thread can signal to stop playback
    # Deque for sounddevice callback (faster access for real-time audio data)
    audio_buffer_deque = deque()

    producer_thread = None # Initialize producer_thread to None
    try:
        # Initialize the actual Kokoro pipeline
        logger.info(f"Initializing KPipeline on device: {KOKORO_DEVICE}...")
        # You might need to specify a model name or path depending on your Kokoro setup
        kokoro_pipeline = KPipeline(device=KOKORO_DEVICE, lang_code="a") 
        logger.info("KPipeline initialized.")
        
        # Ensure the DTYPE matches what Kokoro is likely returning (often float32)
        kokoro_wrapper = KokoroPipelineWrapper(
            kokoro_pipeline, 
            block_size=BLOCK_SIZE, 
            sample_rate=SAMPLE_RATE, 
            dtype=DTYPE # Make sure this matches the expected NumPy array dtype
        )

        # Start the producer thread
        producer_thread = threading.Thread(
            target=audio_producer,
            args=(text, audio_queue, prime_buffer_ready_event, finished_event, kokoro_wrapper),
            name="AudioProducer"
        )
        producer_thread.start()

        logger.info(f"Waiting for initial buffer to be primed ({INITIAL_BUFFER_AUDIO_DURATION_SECONDS}s)...")
        prime_buffer_ready_event.wait(timeout=INITIAL_BUFFER_AUDIO_DURATION_SECONDS*2) # Wait up to 60 seconds for the initial buffer

        if not prime_buffer_ready_event.is_set():
            logger.error("Initial buffer not primed in time. Exiting.")
            finished_event.set() # Signal producer to stop
            return

        # Start sounddevice stream
        print(sd.query_devices())
        logger.info(f"Starting sounddevice stream with sample rate: {SAMPLE_RATE}, block size: {BLOCK_SIZE}, channels: {CHANNELS}, dtype: {DTYPE}")
        with sd.OutputStream(samplerate=SAMPLE_RATE* SPEED_RATE,
                             blocksize=BLOCK_SIZE,
                             channels=CHANNELS,
                             dtype=DTYPE,
                             callback=lambda outdata, frames, time_obj, status: 
                                 audio_callback(outdata, frames, time_obj, status, audio_buffer_deque, finished_event)):
            
            logger.info("Sounddevice stream started. Playback in progress...")
            
            while not finished_event.is_set():
                try:
                    # Get audio block from the producer queue with a timeout
                    block = audio_queue.get(timeout=0.1) 
                    if block is None:
                        # Producer has finished generating all audio (received 'None' marker)
                        logger.info("Producer signaled end of audio (None received).")
                        # Wait for the playback deque to empty completely before stopping
                        while audio_buffer_deque and not finished_event.is_set():
                            logger.debug(f"Waiting for audio_buffer_deque to empty ({len(audio_buffer_deque)} blocks remaining)...")
                            time.sleep(0.05) # Small sleep to avoid busy-waiting
                        if not audio_buffer_deque:
                            logger.info("Audio buffer deque is empty. Playback finished.")
                        finished_event.set() # Signal to stop
                        break # Exit the main playback loop
                    
                    audio_buffer_deque.append(block)
                    logger.debug(f"Main: Moved block from queue to deque. Queue size: {audio_queue.qsize()}, Deque size: {len(audio_buffer_deque)}")
                
                except queue.Empty:
                    # The audio_queue is temporarily empty.
                    # Check if the producer thread has died and there's no more data.
                    if not producer_thread.is_alive() and audio_queue.empty() and not audio_buffer_deque:
                        logger.info("Producer thread died and all queues/buffers are empty. Stopping playback.")
                        finished_event.set()
                        break
                    logger.debug("Main: Audio queue empty, waiting for producer...")
                    time.sleep(0.05) # Prevent busy-waiting
                except Exception as e:
                    logger.error(f"Main thread error during queue retrieval: {e}")
                    finished_event.set()
                    break

    except ImportError:
        logger.critical("sounddevice not found. Please install it with 'pip install sounddevice numpy'")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"An unexpected error occurred during streaming: {e}")
    finally:
        logger.info("Stopping playback and cleaning up...")
        finished_event.set() # Ensure all threads know to stop
        if producer_thread is not None and producer_thread.is_alive():
            producer_thread.join(timeout=5) # Give producer a moment to finish
            if producer_thread.is_alive():
                logger.warning("Producer thread did not terminate gracefully.")
        logger.info("TTS streaming process finished.")

# --- Main Execution ---
if __name__ == "__main__":
    # Example usage:
    text_to_speak = """

Translator: Henyee Translations Editor: Henyee Translations

“My handsome brother, time to get up.”

Eh?

“Who is calling me handsome?”

“Wait a minute.”

“Wasn’t I sleeping alone? Who’s talking?”

Surprised and bewildered, Su Ping quickly opened his eyes. He turned around to take a look. Just one glance almost scared him half to death!

Leaning against his pillow was a ghost that was bleeding from all the seven openings of her face. A twisted smile was ripping her mouth open, revealing ghastly white teeth.

“What the f*ck!!”

Trembling, Su Ping gave the ghost a backhand slap.

His hand went straight through the ghost’s face and landed on the soft pillow. It was just like fanning the air!

The ghost grinned a bit and stuck out her scarlet tongue.

Su Ping was terrified. He hastened to turn around and flee. However, he didn’t pay attention due to panic; his hand was misplaced and he fell off the bed face first on the ground.

“It hurts!”

Su Ping felt his nose was broken and the pain caused a burning sensation.

That being said, he then felt cold all over his body once he thought about the horrifying ghost again.

“Um, pff...”

It seemed as if someone was trying to hold back but failed. There was a burst of laughter coming from the side.

Su Ping shivered from fear. Was the ghost laughing?!

“Ha, ha, ha... Su Ping, are you trying to kill me with laughter? How hopelessly spineless can you be, to be frightened like this!”

The laughter came from the side of the room.

Su Ping was startled.

He turned around.

At the foot of the bed stood a delicate and cute girl with bright eyes and white teeth, wearing orange pajamas with cartoon characters. She was pretty, but at the moment she was laughing so hard that the word beauty no longer had anything to do with her.

“What is going on?”

Su Ping was confused. Then, he suddenly noticed there was something different about the environment of the room.

The first thing that jumped out was a huge poster of a monster on the wall behind the girl. That had to be a poster from some movie.

This was not his room!

Su Ping never had the habit of putting up posters in his room.

Where was the ghost girl?

Upon remembering the shock she had given him when he woke up, he quickly turned his head to look.

There was nothing on the bed. The ghost girl was gone!

“Did she leave?”

Su Ping was in a daze. He was just about to breathe in relief.

And yet, all of a sudden, a black figure whooshed out from under his blanket. It was a black cat.

It was more of a “rolling” than a “whooshing” out. The cat was so chubby that it was practically a ball.

“Snowball, come here,” the girl said to the black cat.

Hearing her voice, the black cat spared no effort in struggling with its four limbs to stand, finally turning around from its belly-up position. The cat shook its fur for a bit, threw a glance to Su Ping who was still cowering on the ground and walked toward the girl with graceful little steps.

Maybe he was just imagining things, but Su Ping thought he was being despised by a cat.

At that moment Su Ping suddenly noticed two sharp horns on the head of the black cat. There were a few strands of dark red hair on its forehead, forming something like a circle of flames.

A question mark slowly emerged above Su Ping’s head.

Buzzing!

Suddenly, as if space and time were quivering...

Su Ping’s vision blurred. Like flood currents, countless pieces of information were surging in his head from all sides.

“Su Ping? Su Lingyue?”

“Astral Pets?”

“Another world?”

The information that came in a continuous stream was confusing and overwhelming. Su Ping felt his head was about to explode, and the pain was unbearable. He had to clench his teeth to somewhat hold back the urge to utter a sound.

He didn’t know how long it took before the messy storm of information in his head gradually quieted down. Some clips of memory emerged in an orderly manner along the timeline.

He had been transported to another world...

Su Ping came to the realization. No wonder he was in this unfamiliar room with that strange girl and the odd cat.

“However, I was just curling up at home to sleep! How could I be transported to another world like this?”

“Was it because I used my hand for some pre-sleep exercise?”

Inside, Su Ping was smiling bitterly. He began to sort through the memories in his mind.

“This is a world similar to earth. But the technology is more advanced, already having entered the era of interstellar travels, reaching far beyond the earth. At the same time, the focus here is not technological development, but the unique Astral Pets!”

“Astral Pets come in great variety and have everything to do with human society. There are Tool Pets who are in charge of infrastructure, transportation and work in daily life, even in scientific research! Battle pets are responsible for pioneering new frontiers amongst the stars and they also offer support in wars. When it comes to battles and status classification of major countries, the might of the battle pets is the decisive factor!”

“Astral Pets...”

Su Ping indulged himself in those memory clips. The more he knew, the more shocked he was. He then understood what that ghost girl was about.

“Battle pet of the demon family, the Phantom Flame Beast’s main ability is to construct illusions and manipulate fire elements...”

This Phantom Flame Beast was that strange cat, a ferocious and tough battle pet of the demon family. This was an Astral Pet that was proficient both in spirit control and element control, a “rare” kind that could cost an arm and a leg!

Su Ping couldn’t believe that “his” younger sister Su Lingyue would use such a rare Astral Pet just to trick him every day...

Once he finished browsing through the memories of his body’s original owner, Su Ping found this life both funny and annoying. This brother and sister were such a quarrelsome pair; they mutually couldn’t stand the sight of the other since young. At first, Su Ping was the one who often played pranks to bully and scare his younger sister. However, the tables had turned as they grew up. It was Su Ping’s turn to spend his days on tenterhooks.

The trigger for such a change was because they had entered different schools when they were twelve.

One of them went to a common trade school.

The other went to the Academy of Astral Pet Warriors!

In a world that was centered on Astral Pets, not everyone could become an Astral Pet Warrior. Only the ones that were well-endowed at birth could build contracts with Astral Pets!

It was determined at birth that the former “Su Ping” didn’t have such talent, which meant that he was destined to be a normal person.

But, in their childhood, this pair of brother and sister didn’t understand this concept. Therefore, the talented Su Lingyue had always been the one on the receiving end, being constantly bullied by Su Ping who had no talent to train Astral Pets.

Once they realized the difference between them, the disastrous life for Su Ping had finally begun.

This younger sister of his was not one to be taken lightly. She harbored a bitter resentment due to all the times she had been bullied by her big brother. She had been repaying him that kindness by several folds over the years.

At the present day, the gap between them had widened even more. One of them was a genius girl who was enrolled in a famous school, with a promising future ahead of her, while the other couldn’t even get into an average university. He would have to drop out of school to help out the family in the business.

“Well, what are you doing there? You didn’t damage your head with the fall, did you?”

Su Lingyue felt something was unusual as she stared at the dumbstruck Su Ping who was sitting on the ground. She frowned, since she remembered that he fell head first.

She wasn’t worried about Su Ping’s safety, but their parents might blame her for this.

“Eh?”

Su Ping came back to his senses. He threw a look at the proud girl who was there holding her head high with her arms folded in front of her chest. He didn’t know what to do with her. “Don’t play pranks like this anymore,” said Su Ping.

Since he had taken over this body, he didn’t want to continue with the practical-joke-revenge living arranged by his sister.

Su Lingyue was taken aback.

“Wouldn’t he usually jump right up and give vent to a torrent of abuse to call me a shrew?

“Why is he so quiet today?

“Could it be...

“He thinks I could become soft-hearted just because he wants to submit?

“Hmm!”

“As long as you haven’t become dumb. Well, truth be told, maybe you can become smarter with your head smashed, given your poor intelligence.” Su Lingyue sneered. She turned around and left right away. “Don’t dawdle. Hurry up and get down for breakfast. Don’t make mom tell me to come up and get you again!”

Slam!

She smashed the door behind her.

Su Ping produced a forced smile. Why was his younger sister so violent when other people’s sisters were cute and lovable girls?

Whoosh!

The door was pulled open again.

Su Ping was startled. It was Su Lingyue who had returned. She hid her spooky face behind the door as she added, “Also, don’t tell mom on me. Or else...” Then she made a cutthroat gesture.

Slam!

The poor door had to shoulder another strike before Su Ping could give a reply.

“...”

Su Ping sat there for a while and crawled back up after he was sure no more sounds were coming from outside.

He glanced around the room and saw many action figures and posters of Astral Pets. While he was a normal person in this world, he wasn’t inferior to the average Astral Pet Warriors regarding the studies on Astral Pets.

Of course, this didn’t stem from his great love of Astral Pets. This bro hated Astral Pets. He was only delving in such studies to find a way to defeat Astral Pets as an average person!

To be more accurate, to find a way to defeat his sister’s Astral Pet!

However, many years had passed; he was still on the receiving end of maltreatment and contempt without the ability to fight back. One could only imagine how difficult his life had been, for him to have researched this much.

Su Ping had a surge of mixed feelings after he reviewed the 18-year life of this man. Not only was he a good-for-nothing, but he had also offended the only powerful person he could have latched himself to. He had been mischievous since he was a kid. He created so many troubles and fooled his sister many times. He would put caterpillars in her lunchbox or scare her in the dead of night by dressing up as a ghost. He was practically the cause of her childhood trauma.

Look at the results. He had turned the girl whose coattails he could ride on into his foe. Besides, this sister of his was not a kind person. She had become his adulthood trauma for a change.

Su Ping definitely had to find a chance to reconcile with this powerful sister. Otherwise, he would be traumatized or his nerves would be wrecked after a few more rounds of peculiar scares.

Su Ping got himself ready, then he put on his slippers and headed downstairs.

“What took you so long? The congee is getting cold. Hurry up,” his mother, Li Qingru, said. She seemed to be in her forties, gentle and refined.

Su Lingyue had already dug in and remained by the table. She had placed the Phantom Flame Beast named “Snowball” on the chair next to hers, which was supposed to be his spot.

Su Ping curled his lips. Even at a simple breakfast, he could still feel such a vindictive nature...

“Coming.”

Su Ping went to the living room to get another chair. He took a look at the substantial breakfast with congee, meat pies, and soybean milk. He was getting hungry.

Su Lingyue raised her eyebrows and cast a glance at Su Ping. She deliberately used Snowball to occupy his seat to provoke him, so that he would get angry and scream and yell. That way she would tell her mom to scold him. Why did he bear the insult?

Curious.

There was some alertness in Su Lingyue’s looks. Was this guy up to something by acting out of character?

“Mom, I’m done. I’ll be heading to the academy now.” Since her plan had fallen through, Su Lingyue was no longer in the mood to stay. She finished her breakfast quickly and bid farewell to her mom.

When she was about to leave, Li Qingru stopped her, “Xiao Yue, wait.”

“Ah?” Su Lingyue turned around.

“Recently, your brother’s store hasn’t been performing very well, it’s not quite popular. How about you put Snowball there just to put on the dog?” Li Qingru tried to sound her out.

Su Lingyue was surprised. She threw a glance at Su Ping who was swallowing down the congee. She rolled her eyes and grumpily reasoned with her, “Mom, the business has been worsening day by day since you let this guy take over. Why do you think that is? The reason is that this guy is not attending to his proper duties. Do you still remember when someone almost filed a complaint against us at the Association of Astral Pets?

“Someone left a ‘Messenger Bird’ there for the boarding service. However, it started saying ‘f*ck you dumb**s’ to all the people it met, and it would blurt out all kinds of curse words, all in less than a week. A few days later, the bird was beaten to death and this case remained unresolved!”

“Do you have the courage to have my Snowball be raised by him when he can’t even take care of a Messenger Bird? There is hope that Snowball can advance to an Astral Pet of the eighth rank. If you don’t mind, I won’t, either. After all, you were the one that bought me Snowball.”

Li Qingru was rendered speechless. She opened her mouth but ended up sighing.

If it weren’t for the fact that she had to rest quietly to recuperate since she was under the weather, she wouldn’t have asked Su Ping to take over the store so early.

Su Ping could sense his sister’s unkind glare but decided to keep silent. He lowered his head and continued eating the congee without paying attention to Su Lingyue.

“Hmm!” she snorted, after sensing that Su Ping knew how to behave in a delicate situation. She picked up Snowball who was still eating bones and went back to her room to get changed and head out.

A moment later, Su Ping had also finished his breakfast. As per usual, after Li Qingru told him to take care, he rode the bike to the store.

It was an Astral Pets store.

Su Ping was a dabbler trainer. His work was more related to Astral Pets’ servicing than to actual training.

After all, the real master trainers could change the potential and rank of an Astral Pet. The master trainers enjoyed similar, or even higher positions than Astral Pet Warriors!

Along the way, Su Ping saw high buildings and large mansions, just like on earth. The only thing different was the peculiar-looking Astral Pets walking alongside most of the pedestrians.

“I am indeed in another world...” Su Ping exclaimed. Everything was like a dream but it was every bit as real.

Soon, he had arrived at his family’s Astral Pet store.

The store was at the end of a commercial street, a relatively remote location, but it used to be pretty popular. Su Ping’s mother Li Qingru was an official Astral Pet trainer of the Federation. While she was only an elementary trainer, she was more than capable of opening a small store like this. She had loads of repeated customers.

But things turned south quickly when Su Ping took over the store.

Could anyone expect that a person who disliked Astral Pets would take good care of them?

Crash~!

Su Ping opened the roller shutter door. He could see dust stirring up in the air when sunshine reached the interior of the store.

It seemed the store hadn’t been cleaned in a long time. There was a pungent smell of animal urine and feces coming from the inside.

Su Ping frowned and held his breath for a bit.

All of a sudden, cold mechanic sounds emerged in Su Ping’s mind.

“A suitable soul was detected within the target range. Performing contract detection...”

“Contract completed. Adding to the system...”

“Completed... Ready to launch...”

“System?”

Su Ping paused for a second. Then, glow burst out from his eyes.

What should come was coming...

"""

    print("\n" + "="*50)
    print("Starting Hybrid TTS Streaming Demo with Kokoro")
    print("="*50 + "\n")
    
    stream_tts_audio(text_to_speak)
    # audio_generator_static(text_to_speak)
    
    print("\n" + "="*50)
    print("Demo Finished")
    print("="*50 + "\n")