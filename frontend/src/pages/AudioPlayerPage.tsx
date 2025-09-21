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
  X,
} from "lucide-react";
// import { useNavigate } from "react-router-dom";
import { ChDropDown } from "../components/chDropDown"
import Player, { PlayerCompRef } from "../components/Player"
import { useSocket } from "../uttils/socketConnection";
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
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playerRef = useRef<PlayerCompRef>(null); // Ref to access Player component
  const [loading, setLoading] = useState<boolean>(true);

  const [lastChunkSentIndex, setLastChunkSentIndex] = useState(-1);

  const { connect, isConnected, socket, sendMessage, audio: socketAudioChunks } = useSocket()

  useEffect(() => {
    if (!isConnected) {
      connect(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZDcyODk1MTNjMjMyMTI4MWI4NjY1OSIsImlhdCI6MTc1MjkzODA4OCwiZXhwIjoxNzU1NTMwMDg4fQ.XMtn3qSk5uWjP6CdjbYEUcltnDJAs0clYupkyxhRVEU",
        "67d7289513c2321281b86659"
      );
    }
  }, []);

  // useEffect(() => {
  //   if (!isConnected) {
  //     connect(
  //       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3ZDcyODk1MTNjMjMyMTI4MWI4NjY1OSIsImlhdCI6MTc0OTkzMjAxOSwiZXhwIjoxNzUyNTI0MDE5fQ.9vyzvLNRI-kfBmdwm6ZMHTefYQJe-0ywVRlJrLwxogk",
  //       "67d7289513c2321281b86659"
  //     );
  //   }
  // }, [connect, isConnected, socket]);

  useEffect(() => {
    if (!book && !chapter) {
      // navigate("/")
      return
    }
    setPlaybackSpeed(book.speed)

    const currentChapter = book.chList[chapter - 1]
    console.log("page test", book, currentChapter.chapterURL, (book.audioURL && book.audioURL !== ""))
    if (!currentChapter.chapterURL || currentChapter.chapterURL === "") {
      setLoading(false);
      return
    }
    handleGetCurrentChapterAudio(currentChapter.chapterURL)

  }, [chapter, book])


  const handlePlayerRequestsMoreData = useCallback(() => {
    // Check if there are new chunks available in socketAudioChunks
    // beyond what has already been sent (lastChunkSentIndex)
    if (socketAudioChunks.length > lastChunkSentIndex + 1) {
      const nextChunkIndex = lastChunkSentIndex + 1;
      const chunkToSend = socketAudioChunks[nextChunkIndex];

      // Ensure the Player ref is available and it has the method to process chunks
      if (chunkToSend && playerRef.current && playerRef.current.processIncomingChunk) {
        playerRef.current.processIncomingChunk(chunkToSend); // Send chunk to Player
        setLastChunkSentIndex(nextChunkIndex); // Update the index
        console.log(`AudioPlayerPage: Sent chunk index ${nextChunkIndex} to Player.`);
      }
    } else {
      console.log(`AudioPlayerPage: No new chunks from socket (${socketAudioChunks.length}) yet. Last sent: ${lastChunkSentIndex}`);
    }
  }, [socketAudioChunks, lastChunkSentIndex])

  useEffect(() => {
    // Connect to the socket when the component mounts if not already connected
    if (!isConnected) {
      return
    }
    const feederInterval = setInterval(() => {
      if (isConnected && playerRef.current?.isAwaitingMoreData(), isPlaying) {
        handlePlayerRequestsMoreData();
      }
    }, 100);
    return () => clearInterval(feederInterval);
  }, [isConnected, handlePlayerRequestsMoreData, connect]);

  const handleGetCurrentChapterAudio = async (url: string) => {
    try {
      if (!url || url === "" || url === undefined) return
      // const response = await getChpaterAudioCurrent(book, url)
      // if (response) {
      //   setLoading(false);
      //   return response
      // }
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
  const handleSendMessagePlay = () => {
    sendMessage("play https://novelbin.me/novel-book/soul-emperor-martial-god 1");
  };





  return (
    <div className="flex-1 min-h-full flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <button className="min-w-fit w-full text-gray-400 hover:text-gray-300 flex gap-3 md:relative"
          onClick={handleShowDropDown}
        >
          <ChevronDown className="w-6 h-6" />
          <span>Chpaters</span>
          <div className={`${showDropDown ? "" : "hidden"}`}>
            <ChDropDown chList={book.chList} />
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
        <p className="text-sm text-gray-400 mb-2">{book.author}</p>
        <p className="text-sm text-purple-500">{book.chList[chapter - 1].title}</p>
      </div>
      {/* Text Display (Conditional) */}
      {showText && (
        <div className="bg-gray-800 rounded-lg p-4 mb-8 max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-gray-700 scrollbar-thumb-gray-600">
          <p className="text-gray-300 leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat...
          </p>
        </div>
      )}

      <button onClick={handleSendMessagePlay} className='px-4 py-2 border-2 my-4 border-white text-white font-bold'>Send Play</button>
      {/* Audio Controls */}
      <div className="">
        {/* Progress Bar */}
        <Player
          ref={playerRef}
          isPlaying={isPlaying}
          setterIsPlaying={handlePlayPause}
          playSpeed={playbackSpeed}
          loading={loading}
          onRequestMoreData={handlePlayerRequestsMoreData}
          duration={200}
        />
        {/* Main Controls */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <button className="text-gray-400 hover:text-gray-300"
            onClick={handleSkipBackward}
          >
            <Undo className="w-6 h-6" />
          </button>
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
          <button className="text-gray-400 hover:text-gray-300"
            onClick={handleSkipForward}
          >
            <Redo className="w-6 h-6" />
          </button>
        </div>
        {/* Speed Control */}
        <div className="flex justify-center">
          <div className="relative">
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
        </div>
      </div>
    </div>
  );
};
