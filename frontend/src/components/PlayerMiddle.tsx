import React, { useEffect, useReducer, useState } from "react";
import { useLibrary } from "../uttils/LibraryContext";
import { useParams } from "react-router-dom";
import { AudioPlayerPage } from "../pages/AudioPlayerPage";
import { Book, BookCurrent } from "../types";

export const PlayerMiddle = () => {
    const { p_id } = useParams();
    const { nr } = useParams();
    let chapter = nr
    const { library, getCurrentBook, getBookChapters, handleSetCurrentBook } = useLibrary()
    const [book, setBook] = useState<BookCurrent | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendBook, setSendBook] = useState<BookCurrent | null>(null)


    useEffect(() => {

         // finds book that is currently selected from library (20 books only not the full DB) 
         //TODO: FIX need to check the whole DB some how
         
        if (library && p_id !== "" && chapter !== "" && !isNaN(Number(chapter))) {
            const findBook = library.books.find((book: Book) => book.id === p_id)
            console.log(p_id)
            if (findBook) {
                setBook(findBook)
            }
        }
    }, [library])

    useEffect(() => {
        let oldBook = getCurrentBook()
        if (book && book.id === p_id) {
            if (oldBook && book && book.id === oldBook._id) {
                console.log("old book found")
                setLoading(false)
                setSendBook(oldBook)
            }else{
                handleGetChapters()
            }
        }
    }, [book])


    const handleGetChapters = async () => {
        let res = await getBookChapters(book, chapter)
        if (res) {
            if (book && book.id === p_id) {
                setSendBook(res.book)
                handleSetCurrentBook(res.book)
            }
            setLoading(false)
        }
    }


    if (loading || !library  || !getBookChapters) {
        return <div className=" flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
            <h1 className="text-xl font-bold text-gray-100">Loading..</h1>
        </div>;
    }
 
    if (sendBook && sendBook.chList && sendBook.chList.length > 0) {
        return (
            <AudioPlayerPage book={sendBook} chapter={Number(chapter)} />
        )
    }
    return <div className=" flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-xl font-bold text-gray-100">Loading..</h1>
    </div>;
};