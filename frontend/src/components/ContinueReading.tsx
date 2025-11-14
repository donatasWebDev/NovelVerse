import { Play, Pause } from "lucide-react";
import { Book, BookCurrent } from "../types";
import { useNavigate } from "react-router-dom";
import Player from "../components/Player";
import { useEffect, useRef, useState } from "react";

interface props {
  book: BookCurrent;
}
export const ContinueReading = ({ book }: props) => {
  const navigate = useNavigate();
  let playerUrl = `/play/${book.id}/${book.currentChapter}`
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  
  useEffect( () => {
    setIsPlaying(false);
  },[])

  useEffect(() => {
    console.log(isPlaying)
  },[isPlaying])

  // Handle play/pause toggle
  const handlePlayPause = (value: boolean) => {
    setIsPlaying(value);
  };




  return <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg mb-8 border border-gray-700 cursor-pointer" onClick={() => navigate(playerUrl)}>
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">
        Continue Reading
      </h2>
      <div className="flex gap-5 items-center">
        <img src={book.coverImg} alt={book.title} className="w-32 h-52 object-fit rounded-md cursor-pointer"
          onClick={() => navigate(playerUrl)}
        />
        <div className="flex-1">
          <h3 className="font-medium text-gray-100 cursor-pointer"
            onClick={() => navigate(playerUrl)}
          >{book.title}</h3>
          <p className="text-sm text-gray-400 mb-2">{book.author}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-400">
              Chapter {book.currentChapter}
            </span>
            <button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full p-1"
              onClick={() => handlePlayPause(!isPlaying)}
            >
              {isPlaying ? (<Pause className="w-4 h-4" strokeWidth={0.1} fill="#FFF" />) : (<Play className="w-4 h-4" />)}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
}