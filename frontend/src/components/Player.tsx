import React, { useState, useEffect, useRef, forwardRef, useCallback, useImperativeHandle } from 'react';
import { useLibrary } from '../uttils/LibraryContext';
import { BookCurrent } from '../types';

interface Props {
  isPlaying: boolean | undefined
  setterIsPlaying: (value: boolean) => void
  playSpeed: number
  loading: boolean
  onRequestMoreData: () => void; // Callback to parent to request more data
  duration: number
}

export interface PlayerCompRef {
  skipForward: (e: React.MouseEvent<HTMLButtonElement>) => void;
  skipBackward: (e: React.MouseEvent<HTMLButtonElement>) => void;
  setPlaybackRate: (speed: number) => void;
  processIncomingChunk: (chunk: ArrayBuffer) => void; // New imperative method to receive a chunk
  isAwaitingMoreData: () => boolean; // New method for parent to query buffer status
}
//*testing
import { useSocket } from "../uttils/socketConnection";


const resBook: BookCurrent = {
  chList: [
    {
      bookId: "SAfdsadsda",
      chapterURL: "https://novelbin.me/novel-book/starting-my-cultivation-with-time-management/chapter-1-1-the-junior-sister-always-challenges-me",
      title: "Chapter 1 - 1 The Junior Sister Always Challenges Me",
      text: null,
      nr: "1"
    },
  ],
  id: "67d6dd5785c385d9cc3e8f99",
  author: "Ghostly Blessing",
  bookURL: "https://novelbin.me/novel-book/starting-my-cultivation-with-time-management",
  categoryList: [
    "Game",
    "Xianxia"
  ],
  coverImg: "https://novelbin.me/media/novel/starting-my-cultivation-with-time-management.jpg",
  isComplete: false,
  title: "Starting My Cultivation With Time Management",
  progress: 0,
  currentChapter: 1,
  numberOfChapters: 10,
  currentChapterTitle: "Chapter 2 - 2 Hurry up and get married, you two",
  isPlaying: false,
  speed: 1
}

//*testing end

const Player = forwardRef<PlayerCompRef, Props>(({ isPlaying, duration, setterIsPlaying, playSpeed, loading, onRequestMoreData }, ref) => {

  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSeeking, setIsSeeking] = useState(false)

  const [internalAppendQueue, setInternalAppendQueue] = useState<ArrayBuffer[]>([]);
  const [isSourceOpen, setIsSourceOpen] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;

    mediaSourceRef.current = new MediaSource();
    audioRef.current.src = URL.createObjectURL(mediaSourceRef.current);

    const handleSourceOpen = () => {
      console.log('MediaSource opened');
      setIsSourceOpen(true);
      const mimeCodec = 'audio/mpeg'; // IMPORTANT: Match your audio format

      if (MediaSource.isTypeSupported(mimeCodec)) {
        sourceBufferRef.current = mediaSourceRef.current!.addSourceBuffer(mimeCodec);
        sourceBufferRef.current.addEventListener('updateend', handleSourceBufferUpdateEnd);
        sourceBufferRef.current.addEventListener('error', handleSourceBufferError);
        // Once opened, try to request initial data from parent
        onRequestMoreData();
      } else {
        console.error('MIME type not supported:', mimeCodec);
      }
    };

    const handleSourceClose = () => {
      console.log('MediaSource closed');
      setIsSourceOpen(false);
    };

    mediaSourceRef.current.addEventListener('sourceopen', handleSourceOpen);
    mediaSourceRef.current.addEventListener('sourceclose', handleSourceClose);
    mediaSourceRef.current.addEventListener('sourceended', handleSourceClose);

    return () => {
      if (mediaSourceRef.current && audioRef.current) {
        mediaSourceRef.current.removeEventListener('sourceopen', handleSourceOpen);
        mediaSourceRef.current.removeEventListener('sourceclose', handleSourceClose);
        mediaSourceRef.current.removeEventListener('sourceended', handleSourceClose);
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (sourceBufferRef.current) {
        sourceBufferRef.current.removeEventListener('updateend', handleSourceBufferUpdateEnd);
        sourceBufferRef.current.removeEventListener('error', handleSourceBufferError);
      }
    };
  }, []); // Empty dependency array: runs once on mount

  const processAppendQueue = useCallback(() => {
    const sourceBuffer = sourceBufferRef.current;
    if (!sourceBuffer || sourceBuffer.updating || internalAppendQueue.length === 0 || !isSourceOpen) {
      return; // Don't append if busy, no data, or MediaSource isn't open
    }

    try {
      const chunkToAppend = internalAppendQueue[0];
      sourceBuffer.appendBuffer(chunkToAppend);
      console.log('Player: Appending chunk:', chunkToAppend.byteLength, 'bytes');
      setInternalAppendQueue(prevQueue => prevQueue.slice(1)); // Remove from queue after starting append
    } catch (error) {
      console.error('Player: Error appending buffer:', error);
      // Handle specific errors, e.g., QuotaExceededError (if buffer is full)
      // You might need to implement logic to remove buffered ranges here.
    }
  }, [internalAppendQueue, isSourceOpen]);

  // --- Trigger processing when internal queue or source state changes ---
  useEffect(() => {
    processAppendQueue();
  }, [internalAppendQueue, isSourceOpen, processAppendQueue]);

  const handleSourceBufferUpdateEnd = useCallback(() => {
    console.log('Player: SourceBuffer update ended.');
    // Immediately try to append the next chunk if there's more in the internal queue
    processAppendQueue();

    // --- "1 or 2 chunks upfront" logic ---
    const audio = audioRef.current;
    const sourceBuffer = sourceBufferRef.current;

    const TARGET_BUFFER_SECONDS = 5; // Aim for 5 seconds of buffer ahead
    const REQUEST_THRESHOLD_SECONDS = 2; // Request more if less than 2 seconds ahead
    const MIN_INITIAL_CHUNKS = 3; 

    if (audio && sourceBuffer && sourceBuffer  && isSourceOpen && !sourceBuffer.updating) {
      const currentTime = audio.currentTime;
      let bufferedEnd = 0;
      if (sourceBuffer.buffered.length > 0) {
        // Get the last buffered range end point
        bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      }

      const bufferedAhead = bufferedEnd - currentTime;
      console.log(`Player: Buffered ahead: ${bufferedAhead.toFixed(2)} seconds`);

      // Request more if we're below the threshold AND we're not already buffering enough
      if (bufferedAhead < REQUEST_THRESHOLD_SECONDS || (bufferedAhead < TARGET_BUFFER_SECONDS && internalAppendQueue.length < 3)) {
        console.log('Player: Low buffer or few pending chunks. Requesting more data from parent...');
        onRequestMoreData(); // Call the parent callback to request more
      }
    }
  }, [processAppendQueue, onRequestMoreData, isSourceOpen, internalAppendQueue.length]); // Added internalAppendQueue.length

  const handleSourceBufferError = useCallback((event: Event) => {
    console.error('Player: SourceBuffer error:', event);
    // Handle source buffer errors
  }, []);

  // --- Playback Control (existing logic) ---
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.play().catch(e => console.error("Error playing audio:", e));
        setterIsPlaying(true)
      } else {
        audio.pause();
        setterIsPlaying(false)
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playSpeed;
    }
  }, [playSpeed]);


  useImperativeHandle(ref, () => ({
    skipForward: (e) => {
      e.preventDefault()
      if (audioRef.current) {
        audioRef.current.currentTime += 10;
      }
    },
    skipBackward: (e) => {
      e.preventDefault()
      if (audioRef.current) {
        audioRef.current.currentTime += 10;
      }
    },
    processIncomingChunk: (chunk: ArrayBuffer) => {
      setInternalAppendQueue(prevQueue => [...prevQueue, chunk]);
    },
    isAwaitingMoreData: () => {
      const audio = audioRef.current;
      const sourceBuffer = sourceBufferRef.current;
      if (!audio || !sourceBuffer || sourceBuffer.updating || !isSourceOpen) {
        return false; // Not ready for more if not setup, updating, or source not open
      }

      const currentTime = audio.currentTime;
      let bufferedEnd = 0;
      if (sourceBuffer.buffered.length > 0) {
        bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      }
      const bufferedAhead = bufferedEnd - currentTime;

      const TARGET_BUFFER_SECONDS = 5;
      // Player is awaiting more data if buffer is low AND internal queue is also low
      return bufferedAhead < TARGET_BUFFER_SECONDS && internalAppendQueue.length < 2;
    },
    setPlaybackRate: (speed) => {
      if (audioRef.current) {
        audioRef.current.playbackRate = speed;
      }
    }
  }))


  const formatTime = (ms: number): string => {
    if (isNaN(ms) || ms < 0) {
      return "00:00"; // Handle invalid or negative input
    }

    const totalSeconds = Math.floor(ms / 1000);

    const minutes = Math.floor(totalSeconds / 60);

    const seconds = totalSeconds % 60;

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
  };

  const handleSeekChange = () => {

  }
  const handleSeekEnd = () => {

  }

  return (
    <div className="flex flex-col items-center rounded-lg shadow-lg h-auto w-full">

      <audio ref={audioRef} controls>
      </audio>

      {/* Loadking circle */}
      {
        isSourceOpen ? (
          <div className="flex justify-center items-center w-10 h-10 rounded-full  bg-gradient-to-t from-purple-600 via-30% to-gray-900 animate-spin"></div>
        ) : (
          <></>
        )
      }



      {/* Progress Bar */}
      <div className="w-full h-2">
        <input type="range" min={0} max={100} className='w-full slider'
          value={duration ? (audioRef?.current?.currentTime || 0 / duration) * 100 : 0}
          onChange={handleSeekChange}
          onMouseDown={() => setIsSeeking(true)}
          onMouseUp={handleSeekEnd}
          onTouchStart={() => setIsSeeking(true)}
          onTouchEnd={handleSeekEnd}
          style={{
            background: `linear-gradient(to right, #9333ea ${duration ? (audioRef?.current?.currentTime || 0 / duration) * 100 : 0}%, #374151 ${duration ? (audioRef?.current?.currentTime || 0 / duration) * 100 : 0}%)`,
          }}
        />
      </div>

      {/* Current Progress Text */}
      <div className="flex justify-between w-full text-gray-400 text-sm mt-4">
        <span>{formatTime(audioRef?.current?.currentTime || 0)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
})

export default Player;
