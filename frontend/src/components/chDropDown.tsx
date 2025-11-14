import React, { HtmlHTMLAttributes } from "react";
import { LogOut, Settings } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {Book, BookCurrent, Chapter} from "../types"
import { useLibrary } from "../uttils/LibraryContext";
interface CategoryTabsProps {
  chList: Chapter[];
  currentChapterNumber?: number; // Accept current chapter as prop
}
export const ChDropDown = ( {chList, currentChapterNumber} :CategoryTabsProps ) => {
    const { p_id } = useParams() // Only get id from route params; chapter comes from prop
    const navigate = useNavigate()
    const {handleSetCurrentBook, getCurrentBook} = useLibrary()!
    // Only require chList for rendering; navigation to different chapters may or may not work
    // depending on whether we're in a routed context
    if (!chList || chList.length === 0) {
        return null;
    }

const handleUpdateCurrentCh = (e: React.MouseEvent<HTMLButtonElement>, ch: number) => {
    e.preventDefault();
    const book = getCurrentBook() as BookCurrent | null;
    if (!book) {
        navigate("/")
        return;
    }
    const newBook: BookCurrent = {
        ...book,
        currentChapter: ch+1
    }
    handleSetCurrentBook(newBook)
    navigate(`/play/${p_id}/${ch+1}`)
}


  return (
    <div className="left-0 top-0 h-full max-h-full w-full z-10    md:max-h-96 md:h-max md:top-10 md:w-auto   overflow-scroll overflow-x-hidden omt-auto border-t bg-opacity-20 bg-black backdrop-blur-md  border-b border-gray-700 pt-6 absolute">
    <div className="flex flex-col gap-2">
        <ul className="flex flex-col">
            {chList.map((ch, index) => (
                <li key={index+1} className="flex gap-2 text-center hover:bg-gray-700 p-3 rounded-lg transition-colors">
                    {/* <span className={`flex items-center font-medium text-gray-100 `}>
                        {index+1}
                        </span> */}
                        <button className={`flex items-center gap-3 ${currentChapterNumber === (index+1)? "text-purple-600" : "text-gray-400 hover:text-gray-500"}`} 
                        onClick={(e) => handleUpdateCurrentCh(e, index)}>
                        <span className="text-sm">{ch.title}</span>
                    </button>
                </li>
            ))}
        </ul>
    </div>
    </div>
  )
};