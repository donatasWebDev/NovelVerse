import React, { useEffect, useRef, useState, useCallback } from "react";
import "../App.css"
import { BookCurrent } from "../types";
import {
  Play,
  Pause,
  Undo,
  Redo,
  Type,
  ChevronDown,
  SkipForward,
  SkipBack,
  X,
  Flashlight,
} from "lucide-react";
// import { useNavigate } from "react-router-dom";
import { ChDropDown } from "../components/chDropDown"
import Player, { PlayerCompRef } from "../components/Player"
import { useSocketContext } from "../uttils/socketContext";
import { useAuth } from "../uttils/AuthContex";
import { useLibrary } from "../uttils/LibraryContext";
import { Link } from "react-router-dom";
import { a, audio } from "framer-motion/client";
import { VolumeButton } from "../components/volumeBtn"
// import { useLibrary } from "../uttils/LibraryContext";

interface AudioPlayerPageProps {
  book: BookCurrent;
  chapter: number;
}
export const AudioPlayerPage = ({
  book,
  chapter
}: AudioPlayerPageProps) => {
  // const navigate = useNavigate()
  // const {getChpaterAudioCurrent} = useLibrary()!
  const [showText, setShowText] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showDropDown, setShowDropDown] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState<boolean>(false);
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playerRef = useRef<PlayerCompRef>(null); // Ref to access Player component
  const [loading, setLoading] = useState<boolean>(true);
  const [chapterInfo, setChapterInfo] = useState<any>(null)
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const [chapterNr, setChapterNr] = useState<number>(chapter)
  const [playerKey, setPlayerKey] = useState<string>('');
  const { user } = useAuth()
  const { getStreamKey, verifyStreamKey } = useLibrary()!
  const [lastChunkSentIndex, setLastChunkSentIndex] = useState(-1);
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeMenu, setShowVolumeMenu] = useState(false)



  const { connect, isConnected, messages, startJob, audio: socketAudioChunks, disconnect } = useSocketContext()

  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [retries, setRetries] = useState(0);
  const MAX_RETRIES = 2; // e.g. initial + 2 retries
  const QUEUE_SAFETY_TIMEOUT = 20 * 1000; // 20s — tune to ~1.5× your typical worst-case delay



  useEffect(() => {
    const initAuthAndSocket = async () => {
      try {
        const token = await getStreamKey() // Assuming this returns { token: string | null }

        if (!token) {
          return;
        }
        if (user?.id) {
          if (await verifyStreamKey(token, user.id)) {
            setStreamKey(token);
          }
        }
      } catch (err) {
        console.error("Auth init error in AudioPlayerPage:", err);
        // Handle UI error: toast or alert
      }
    };

    initAuthAndSocket();
  }, []); // Run once on mount

  useEffect(() => {
    console.log("can connect to stream ", (!isConnected && streamKey && user && isFirstLoad))
    const start = async () => {
      if (!isConnected && streamKey && user && isFirstLoad) {
        console.log("Connecting to socket with streamKey:", streamKey, "and userId:", user.id);
        setIsFirstLoad(false)
        startJobWithSafetyNet(streamKey, user.id, book.bookURL, chapter.toString())
      }
      // connect(streamKey, user.id, book.bookURL, chapter.toString());

    }
    start()
  }, [streamKey, isConnected, user, isFirstLoad]);

  useEffect(() => {
    if (!book && !chapter) {
      // navigate("/")
      return
    }
    const newKey = `${book.id || 'unknown'}-${chapter || '0'}`;
    console.log(`Chapter switched – forcing Player re-mount with new key: ${newKey}`);
    setPlayerKey(newKey);
    setIsFirstLoad(true)
    setPlaybackSpeed(book.speed)
    setLastChunkSentIndex(-1);
    const currentChapter = {
      ...book,
      chapterURL: `${book.bookURL.split(".html")[0]}_${chapter}.html`,
    }
    if (!currentChapter.chapterURL || currentChapter.chapterURL === "") {
      setLoading(false);
      return
    }
    handleGetCurrentChapterAudio(currentChapter.chapterURL)


  }, [chapter, book])

  useEffect(() => {

    console.log("messages Updated", messages)


    if (messages && messages.length > 0 && !chapterInfo) {
      let info = messages.find((m) => m.status === "audio-info")
      if (info) {
        setChapterInfo(info)
      }
    }

    if (messages?.some(m => m.status === "started") && messages.length > 0) {
      if (safetyTimerRef.current) {
        console.log("Progress detected — clearing safety timer");
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
        setRetries(0);
      }
    }
  }, [messages])

  useEffect(() => {
    if (socketAudioChunks.length > 2 && !audioLoaded) {
      setIsPlaying(true);
      setAudioLoaded(true);
    }
  }, [socketAudioChunks])


  const startJobWithSafetyNet = async (streamKey: string, userId: string, bookURL: string, chapter: string) => {
    try {
      const newJobId = await startJob(streamKey, userId, bookURL, chapter);
      connect(newJobId);

      // Single timeout: if no progress after X seconds, cancel & retry once
      safetyTimerRef.current = setTimeout(() => {
        console.log(`No progress after ${QUEUE_SAFETY_TIMEOUT / 1000}s — cancelling & retrying`);

        if (newJobId) {
          disconnect(newJobId);
        }

        if (retries < MAX_RETRIES) {
          startJobWithSafetyNet(streamKey, userId, bookURL, chapter); // recursive call, but only once or twice max
          setRetries(prev => prev + 1)
        }


      }, QUEUE_SAFETY_TIMEOUT);
    }
    catch (err) {
      console.log(err)
    }

  };

  const handlePlayerRequestsMoreData = useCallback(() => {
    // Check if there are new chunks available in socketAudioChunks
    // beyond what has already been sent (lastChunkSentIndex)

    if (lastChunkSentIndex >= socketAudioChunks.length) {
      console.warn(`Index out of sync with chunks (${lastChunkSentIndex} >= ${socketAudioChunks.length}) – resetting to -1`);
      setLastChunkSentIndex(-1);  // Auto-fix if fucked
    }

    if (socketAudioChunks.length > lastChunkSentIndex + 1) {
      const nextChunkIndex = lastChunkSentIndex + 1;
      const chunkToSend = socketAudioChunks[nextChunkIndex];
      // Ensure the Player ref is available and it has the method to process chunks
      if (chunkToSend && playerRef.current && playerRef.current.processIncomingChunk) {
        playerRef.current.processIncomingChunk(chunkToSend); // Send chunk to Player
        setLastChunkSentIndex(nextChunkIndex); // Update the index
      }
    } else {
      console.log(`AudioPlayerPage: No new chunks from socket (${socketAudioChunks.length}) yet. Last sent: ${lastChunkSentIndex}`);
    }
  }, [socketAudioChunks, lastChunkSentIndex])

  useEffect(() => {
    // Connect to the socket when the component mounts if not already connected
    if (!isPlaying && !playerRef.current?.isAwaitingMoreData()) return;

    const feederInterval = setInterval(() => {
      if (isConnected && playerRef.current?.isAwaitingMoreData(), isPlaying) {
        handlePlayerRequestsMoreData();
      }
    }, 100);
    return () => clearInterval(feederInterval);
  }, [isConnected, handlePlayerRequestsMoreData]);

  const handleGetCurrentChapterAudio = async (url: string) => {
    try {
      if (!url || url === "" || url === undefined) return
      setLoading(false);
    } catch (error) {
      console.error("Error getting audio", error);
    }
  }




  // Handle play/pause toggle
  const handlePlayPause = (value: boolean) => {
    setIsPlaying(value);
  };

  // Skip forward by 10 seconds
  const handleSkipForward = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log("handleSkipForward", playerRef)
    if (playerRef.current) {
      playerRef.current.skipForward(e); // Skip forward by 10 seconds
    }
  };

  const handleSkipBackward = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (playerRef.current) {
      playerRef.current.skipBackward(e); // Skip backward by 10 seconds
    }
  };


  const togglePlay = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setIsPlaying(!isPlaying);
  };

  const handleShowText = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setShowText(!showText)
  }
  const handleShowDropDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setShowDropDown(!showDropDown)
  }
  const handleShowSpeedMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    debugger
    setShowSpeedMenu(!showSpeedMenu)
  }
  const handleSetSpeed = (e: React.MouseEvent<HTMLButtonElement>, speed: number) => {
    e.preventDefault()
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  }
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
  };
  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };




  return (
    <div className="flex-1 min-h-full flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <button className="min-w-fit w-full text-gray-400 hover:text-gray-300 flex gap-3 md:relative"
          onClick={handleShowDropDown}
        >
          <ChevronDown className={`${showDropDown ? "rotate-180" : ""} transition-transform w-6 h-6`} />
          <span>Chapters</span>
          <div className={`${showDropDown ? "" : "hidden"}`}>
            <ChDropDown maxCh={book.numberOfChapters} currentChapterNumber={chapter} />
          </div>
        </button>
        <button
          onClick={handleShowText}
          className={`text-gray-400 hover:text-gray-300 ${showText ? "text-purple-500" : ""}`}
        >
          <Type className="w-6 h-6" />
        </button>
      </div>
      {/* Book Cover and Info */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-48 h-64 rounded-lg overflow-hidden mb-4">
          <img
            src={book.coverImg}
            alt="Book cover"
            className="w-full h-full object-cover"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-100 mb-1">{book.title}</h2>
        <span className="text-3xl my-2 font-bold text-white mb-1">Chapter {chapter}</span>
        <p className="text-sm text-gray-400 mb-2">{book.author}</p>
      </div>
      {/* Text Display (Conditional) */}
      {showText && (
        <div className="bg-gray-800 rounded-lg p-4 mb-8 h-80 overflow-y-auto scrollbar-thin resize scrollbar-track-gray-700 scrollbar-thumb-gray-600">
          <p className="text-gray-300 hyphens-auto text-2xl leading-9">
            {chapterInfo?.text || "loading.."}
          </p>
        </div>
      )}
      {/* Audio Controls */}
      <div className="flex flex-col items-center"
        onMouseLeave={() => {
          console.log("leaving controls")
          setShowVolumeMenu(false)
        }}
      >
        {
          chapterNr && !loading ? (
            <Player
              key={playerKey}  // Force remount on chapter change
              ref={playerRef}
              isPlaying={isPlaying}
              setterIsPlaying={handlePlayPause}
              playSpeed={playbackSpeed}
              loading={audioLoaded}
              onRequestMoreData={handlePlayerRequestsMoreData}
              duration={chapterInfo?.duration || 0}
              volume={volume}
              isMuted={isMuted}
            />
          )
            : (<div className="flex justify-center items-center h-24">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent border-solid rounded-full animate-spin"></div>
            </div>
            )
        }
        {/* Main Controls */}
        <div className=" w-full flex justify-center items-center gap-6 mb-4">
          {chapter != 1 ?
            <Link className="text-gray-400 hover:text-gray-300"
              to={`/play/${book.id}/${chapter - 1}`}
            >
              <SkipBack className="w-6 h-6" />
            </Link>
            :
            <div className="w-6 h-6"></div>
          }
          <button className="text-gray-400 hover:text-gray-300"
            onClick={handleSkipBackward}
          >
            <Undo className="w-6 h-6" />
          </button>
          {
            audioLoaded ? (
              <button
                className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" />
                )}
              </button>
            ) : (
              <button
                className="w-16 h-16 rounded-full bg-gray-600 cursor-default flex items-center justify-center"
              >
                <Pause className="w-8 h-8 text-white" />
              </button>
            )
          }
          <button className="text-gray-400 hover:text-gray-300"
            onClick={handleSkipForward}
          >
            <Redo className="w-6 h-6" />
          </button>    {chapter != book.numberOfChapters ? <Link className="text-gray-400 hover:text-gray-300"
            to={`/play/${book.id}/${chapter + 1}`}
          >
            <SkipForward className="w-6 h-6" />
          </Link> : <div className="w-6 h-6"></div>}
        </div>
        {/* Speed Control */}
        <div className="flex w-full gap-3">
          <div className="relative flex items-center">
            <button
              className="px-3 py-1 text-sm text-gray-300 bg-gray-700 rounded-full hover:bg-gray-600"
              onClick={handleShowSpeedMenu}
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-24 bg-gray-700 rounded-lg shadow-lg overflow-hidden">
                {speeds.map((speed) => (
                  <button
                    key={speed}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-600 ${speed === playbackSpeed ? "text-purple-500" : "text-gray-300"}`}
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleSetSpeed(e, speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            className="flex w-max justify-end"
            onMouseEnter={() => {
              console.log("leaving controls")
              setShowVolumeMenu(true)
            }}>
            <VolumeButton
              ref={playerRef}
              volume={isMuted ? 0 : volume}
              isMuted={isMuted}
              canShowSlider={showVolumeMenu}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
