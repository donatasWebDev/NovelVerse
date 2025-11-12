import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../uttils/socketConnection";
import { useAuth } from "../uttils/AuthContex";

export const Test = () => {
  const { connect, isConnected, socket, sendMessage, audio: audioChunks } = useSocket(); // Renamed to audioChunks
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [user] = useAuth()

  useEffect(() => {
    if (!isConnected && user) {
      connect(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZDcyODk1MTNjMjMyMTI4MWI4NjY1OSIsImlhdCI6MTc0Njg5MjM4NCwiZXhwIjoxNzQ5NDg0Mzg0fQ.j5sKNP-nz2l9xeejWMXePxNjefiJhJfKo5iEMLPcwdk",
        user?.id
      );
    }
  }, [connect, isConnected, socket, user]);

  useEffect(() => {
    if (audioRef.current && !mediaSourceRef.current) {
      mediaSourceRef.current = new MediaSource();
      audioRef.current.src = URL.createObjectURL(mediaSourceRef.current);

      mediaSourceRef.current.addEventListener('sourceopen', () => {
        console.log('MediaSource opened');
        setIsSourceOpen(true);
        setMimeType('audio/mpeg')  // Try AAC in MP4
      });

      mediaSourceRef.current.addEventListener('sourceended', () => {
        console.log('MediaSource ended');
      });

      mediaSourceRef.current.addEventListener('error', (error) => {
        console.error('MediaSource error:', error);
      });
    }

    return () => {
      if (mediaSourceRef.current) {
        mediaSourceRef.current.removeEventListener('sourceopen', () => { });
        mediaSourceRef.current.removeEventListener('sourceended', () => { });
        mediaSourceRef.current.removeEventListener('error', () => { });
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.src);
        }
        mediaSourceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isSourceOpen && mimeType && audioChunks && audioChunks.length > 0) {
      const latestChunk = audioChunks[audioChunks.length - 1]; // Get ArrayBuffer

      if (!sourceBufferRef.current) {
        try {
          sourceBufferRef.current = mediaSourceRef.current?.addSourceBuffer(mimeType) || null;
          if (sourceBufferRef.current) {
            sourceBufferRef.current.addEventListener('updateend', () => {
              //  append the next chunk here if you have more
            });

            sourceBufferRef.current.addEventListener('error', (error) => {
              console.error('SourceBuffer error:', error);
            });
          }
        } catch (e) {
          console.error("Error adding SourceBuffer", e);
          sourceBufferRef.current = null;
        }
      }

      if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
        sourceBufferRef.current.appendBuffer(latestChunk); // Append ArrayBuffer
      }
    }
  }, [audioChunks, isSourceOpen, mimeType]);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(error => console.error("Playback failed:", error));
    }
  };

  const handleSendMessagePlay = () => {
    sendMessage("play https://novelbin.me/novel-book/starting-my-cultivation-with-time-management 1");
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-100 mb-6">Your Audio Stream</h2>
      <audio ref={audioRef} controls />
      <button
        className="text-white text-2xl font-thin p-3 py-1 border border-white mr-2"
        onClick={handlePlay}
        disabled={!audioRef.current || !mediaSourceRef.current}
      >
        Play
      </button>
      <button
        className="text-white text-2xl font-thin p-3 py-1 border border-white "
        onClick={handleSendMessagePlay}
      >
        Send Play Command
      </button>
      {mimeType && <p className="text-gray-400 mt-2">MIME Type: {mimeType}</p>}
      {!isSourceOpen && <p className="text-yellow-500 mt-2">MediaSource not yet open...</p>}
    </div>
  );
};

