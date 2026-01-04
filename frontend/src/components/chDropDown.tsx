import React, { HtmlHTMLAttributes } from "react";
import { LogOut, Settings } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Book, BookCurrent, Chapter } from "../types"
import { useLibrary } from "../uttils/LibraryContext";
interface CategoryTabsProps {
    maxCh: number;
    currentChapterNumber?: number; // Accept current chapter as prop
}
export const ChDropDown = ({ maxCh, currentChapterNumber }: CategoryTabsProps) => {
    const { p_id } = useParams() // Only get id from route params; chapter comes from prop
    const navigate = useNavigate()
    const { handleSetCurrentBook, getCurrentBook } = useLibrary()!
    // Only require chList for rendering; navigation to different chapters may or may not work
    // depending on whether we're in a routed context
    if (!maxCh) {
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
            currentChapter: ch + 1
        }
        handleSetCurrentBook(newBook)
        navigate(`/play/${p_id}/${ch + 1}`)
    }


    return (
        <div className="left-0 top-0 h-full max-h-full w-full z-10    md:max-h-96 md:h-max md:top-10 md:w-auto   overflow-scroll overflow-x-hidden omt-auto border-t bg-opacity-20 bg-black backdrop-blur-md  border-b border-gray-700 pt-6 absolute">
            <div className="flex flex-col gap-2">
                <ul className="flex flex-col">
                    {Array.from({ length: maxCh }, (_, i) => i + 1).map((chapterNumber) => (
                        <li
                            key={chapterNumber}
                            className="flex gap-2 text-center hover:bg-gray-700 p-3 rounded-lg transition-colors"
                        >
                            <button
                                className={`flex items-center gap-3 w-full justify-center font-medium ${currentChapterNumber === chapterNumber
                                        ? "text-purple-600"
                                        : "text-gray-400 hover:text-gray-100"
                                    }`}
                                onClick={(e) => handleUpdateCurrentCh(e, chapterNumber-1)}
                            >
                                <span className="text-sm">Chapter {chapterNumber}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
};