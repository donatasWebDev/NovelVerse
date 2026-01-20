import React, { useEffect, useState } from "react";
import { Play, Pause, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Book } from "../types";
import { useLibrary } from "../uttils/LibraryContext";
import { useAuth } from "../uttils/AuthContex";
import { start } from "repl";

interface AudioBookCardProps extends Book {
  removeBook?: (id: string) => void;
  favoriteBooks?: Book[]
}

export const AudioBookCard = ({
  title,
  author,
  categoryList,
  coverImg,
  numberOfChapters,
  id,
  isComplete,
  favoriteBooks,
  removeBook
}: AudioBookCardProps) => {
  const [isHover, setIsHover] =  useState<boolean>(false)
  const [userFavorite, setUserFavorite] = useState<boolean>(false)
  const {toggleFavoriteBook} = useLibrary()!

  useEffect(() => {
    if (!favoriteBooks) {
      return
    }
    const isFavorite = favoriteBooks.some( book => book.id === id)
    setUserFavorite(isFavorite)
  },[]) 

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setUserFavorite(!userFavorite)
    setIsHover(!isHover)
    toggleFavoriteBook(id)
    if (removeBook) {
      removeBook(id)
    }
  }
  return <Link className="relative group rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gray-800 border border-gray-700" to={`/play/${id}/1`}>
    <div className="aspect-[4/4] relative">
      <img src={coverImg} alt={`${title} cover`} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
        <button className="transform scale-0 group-hover:scale-100 transition-transform duration-300 w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center">
        <Play className="w-4 h-4 text-white ml-0.5" />
        </button>
        <button className="absolute z-50 top-0 right-0 m-4"
        onMouseEnter={() => setIsHover(!isHover)}
        onMouseLeave={() => {
          if (userFavorite) {
            setIsHover(true)
            return
          }
          setIsHover(false)
        }}
        onClick={handleClick}
        >
          <Star className="transition-all duration-200" color="white" fill={(isHover || userFavorite) ? "white" : "transparent"}></Star>
        </button>
      </div>
    </div>
    <div className="p-4">
      <h3 className="font-medium text-gray-100 truncate">{title}</h3>
      <div className="mt-2 mb-2 flex flex-col">
        <p className="text-sm text-gray-100">{author}</p>
        <span className="text-sm text-gray-400">{categoryList.length > 4 ? categoryList.slice(0, 4).join(", ") + "..." : categoryList?.join(', ')}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="w-full flex items-center gap-2 justify-between">
          <span>Ch. {numberOfChapters}</span>
          {
            isComplete ? <span className="px-2 py-1 bg-green-600 text-white rounded-full text-xs">Completed</span> 
            : <span className="px-2 py-1 bg-yellow-600 text-white rounded-full text-xs">Ongoing</span>
          }
        </div>
      </div>
    </div>
  </Link>;
};