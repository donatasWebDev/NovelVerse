import React, { useEffect, useState } from "react";
import { useLibrary } from "../uttils/LibraryContext";
import { useParams } from "react-router-dom";
import { AudioPlayerPage } from "../pages/AudioPlayerPage";
import { Book, BookCurrent } from "../types";

export const PlayerMiddle = () => {
    const { p_id } = useParams();
    const { nr } = useParams();
    let chapter = nr
    const {getCurrentBook, handleSetCurrentBook, getBookById } = useLibrary()!
    const [book, setBook] = useState<BookCurrent | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        handleInitializeAudioBook()
    }, [])


    const handleInitializeAudioBook = async () => {
        let oldBook = getCurrentBook()
        if (oldBook) {
            setBook(oldBook)
            setLoading(false)
            return
        }
        if (p_id) {
            const newBook: any = await getBookById(p_id)
            if (!newBook) {
                setLoading(false)
                return
            }
            setBook(handleSetCurrentBook(newBook))
            setLoading(false)
        }
    }

    if (loading) {
        return <div className=" flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <h1 className="text-xl font-bold text-gray-100">Loading..</h1>
        </div>;
    }

    if (book) {
        return (
            <AudioPlayerPage book={book} chapter={Number(chapter)} />
        )
    }
    if (!book) {
        console.log("no book found", setBook)
    }
    
    return <div className=" flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-gray-100">Loading...</h1>
    </div>;
}