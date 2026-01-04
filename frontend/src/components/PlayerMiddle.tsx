import React, { useEffect, useReducer, useState } from "react";
import { useLibrary } from "../uttils/LibraryContext";
import { useParams } from "react-router-dom";
import { AudioPlayerPage } from "../pages/AudioPlayerPage";
import { Book, BookCurrent } from "../types";

export const PlayerMiddle = () => {
    const { p_id } = useParams();
    const { nr } = useParams();
    let chapter = nr
    const { library, getCurrentBook, initializeAudioBook, getBookById } = useLibrary()
    const [book, setBook] = useState<BookCurrent | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        hanldeInitializeAudioBook()
    }, [])


    const hanldeInitializeAudioBook = async () => {
        let bookData = null
        let oldBook = getCurrentBook()

        if (library && p_id !== "" && chapter !== "" && !isNaN(Number(chapter))) {
            bookData = await getBookById(p_id);
            if (!bookData) {
                console.log("book not found in DB")
                return
            }
            if (oldBook && bookData && bookData.id === oldBook._id) {
                console.log("old book found")
                setLoading(false)
                setBook(oldBook)
            } else {
                let book: BookCurrent = await initializeAudioBook(bookData, chapter)
                setLoading(false)
                setBook(book)
            }
        }
    }


    if (loading || !library) {
        console.log("loading player middle", loading, library)
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
};