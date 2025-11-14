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

const Player = forwardRef<PlayerCompRef, Props>(({ isPlaying, duration, setterIsPlaying, playSpeed, loading, onRequestMoreData }, ref) => {

  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isSeeking, setIsSeeking] = useState(false)
  const isSeekingRef = useRef<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0); // seconds
  const [localDuration, setLocalDuration] = useState<number>(duration || 0); // seconds
  const [bufferedEnd, setBufferedEnd] = useState<number>(0); // seconds - end of the last buffered range

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


  // Sync prop duration into localDuration and log for debugging when prop changes
  useEffect(() => {
    setLocalDuration(duration || 0);
  }, [duration]);

  // Attach audio element event listeners to update currentTime and duration reliably
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Only update state when not actively seeking (seeking uses direct set)
      if (!isSeekingRef.current) setCurrentTime(audio.currentTime);

      // Update buffered end time from the source buffer if available
      try {
        const sourceBuffer = sourceBufferRef.current;
        if (sourceBuffer && sourceBuffer.buffered && sourceBuffer.buffered.length > 0) {
          const bEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
          setBufferedEnd(bEnd);
        }
      } catch (e) {
        // ignore any exceptions when reading buffered ranges
      }
    };

    const handleLoadedMetadata = () => {
      // If parent didn't provide a duration, use the audio's metadata duration
      if (!duration || duration === 0) {
        setLocalDuration(audio.duration || 0);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    // initialize
    setCurrentTime(audio.currentTime || 0);
    if (!duration || duration === 0) setLocalDuration(audio.duration || 0);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioRef, duration]);

  // Keep a ref in sync with isSeeking state so event handlers see the latest value
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

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

    if (audio && sourceBuffer && sourceBuffer  && isSourceOpen && !sourceBuffer.updating) {
      const currentTime = audio.currentTime;
      let bufferedEnd = 0;
      if (sourceBuffer.buffered.length > 0) {
        // Get the last buffered range end point
        bufferedEnd = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
      }

      // Publish buffered end to state so UI can display it
      setBufferedEnd(bufferedEnd);

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
        audioRef.current.currentTime = Math.max(0, (audioRef.current.currentTime || 0) - 10);
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

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!localDuration || localDuration === 0) return;
    const percent = Number(e.target.value);
    const newTime = (percent / 100) * localDuration;
    setCurrentTime(newTime);
  }

  const handleSeekEnd = () => {
    setIsSeeking(false);
    if (audioRef.current) {
      // Apply the seek to the underlying audio element
      audioRef.current.currentTime = currentTime;
    }
  }

  return (
    <div className="flex flex-col items-center rounded-lg shadow-lg h-auto w-full">

      {/* add controls to make it visible */}
      <audio ref={audioRef} >
      </audio>

      {/* Loadking circle */}
      {
        !loading ? (
          <div className="flex justify-center items-center w-10 h-10 rounded-full  bg-gradient-to-t from-purple-600 via-30% to-gray-900 animate-spin"></div>
        ) : (
          <></>
        )
      }



      {/* Progress Bar */}
      <div className="w-full h-2">
        {
            (() => {
            const pct = localDuration && localDuration > 0 ? (currentTime / localDuration) * 100 : 0;
            const clampedPct = Math.max(0, Math.min(100, pct));
            const bufPct = localDuration && localDuration > 0 ? (bufferedEnd / localDuration) * 100 : 0;
            const clampedBufPct = Math.max(0, Math.min(100, bufPct));
            // Gradient: played color up to clampedPct, buffered color from clampedPct to clampedBufPct, remainder gray
            const gradient = `linear-gradient(to right, #9333ea 0% ${clampedPct}%, rgba(147,51,234,0.35) ${clampedPct}% ${clampedBufPct}%, #374151 ${clampedBufPct}% 100%)`;
            return (
              <input
                type="range"
                min={0}
                max={100}
                className='w-full slider'
                value={clampedPct}
                onChange={handleSeekChange}
                onMouseDown={() => { setIsSeeking(true); isSeekingRef.current = true; }}
                onMouseUp={() => { setIsSeeking(false); isSeekingRef.current = false; handleSeekEnd(); }}
                onTouchStart={() => { setIsSeeking(true); isSeekingRef.current = true; }}
                onTouchEnd={() => { setIsSeeking(false); isSeekingRef.current = false; handleSeekEnd(); }}
                style={{
                  background: gradient,
                }}
              />
            )
          })()
        }
      </div>

      {/* Current Progress Text */}
      <div className="flex justify-between w-full text-gray-400 text-sm mt-4">
        <span>{formatTime((currentTime || 0) * 1000)}</span>
        <span>{formatTime((localDuration || 0) * 1000)}</span>
      </div>
      {/* Buffer status text (optional) */}
      <div className="w-full text-xs text-gray-500 mt-1">
        Buffered: {Math.floor(bufferedEnd)}s
      </div>
    </div>
  );
})

export default Player;
