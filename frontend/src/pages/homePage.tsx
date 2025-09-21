import React, { useEffect, useState } from "react";
import { AudioBookCard } from "../components/AudioBookCard";
import { CategoryTabs } from "../components/CategoryTabs";
import { ContinueReading } from "../components/ContinueReading";
import { useLibrary } from "../uttils/LibraryContext";
import {Book, BookCurrent} from "../types";
import { useAuth } from "../uttils/AuthContex";
import { useSocket } from "../uttils/socketConnection";
import { useNavigate } from "react-router-dom";
const categories = [
  "All Books",
  "Isekai",
  "Romance",
  "Action",
  "Fantasy",
  "Slice of Life",
];

 export const HomePage = () => {
  const { library, getCurrentBook, streamKey } = useLibrary()!; // Assumed library context
  // const {connect, isConnected, socket, sendMessage} = useSocket();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookCurrent, setBookCurrent] = useState<BookCurrent | null>(null)
  const [activeCategory, setActiveCategory] = useState("All Books");
  const [loading, setLoading] = useState(true); // Track loading state
  const {user} = useAuth()!
  const navigate = useNavigate()


  useEffect(() => {
    if (library) {
      setBooks(library.books || []); // Set books once library is available
      setLoading(false); // Mark loading as false when library is set
    }
    console.log("Library", library)
  }, [library]); // Re-run effect when library changes

  useEffect(() => {
    const book = getCurrentBook();

    if (!user) {
      navigate("/login")
    }

    if (book) {
      setBookCurrent(book);
    }

  }, []);

//   useEffect(() => {
//     console.log(user?.id && streamKey && !isConnected && !socket)
//     if (user?.id && streamKey && !isConnected) {
//         connect(streamKey, user.id);
//     }
// }, [connect, user, streamKey, isConnected, socket]);

// useEffect( () => {
//   console.log(bookCurrent, isConnected , socket)
//   if (bookCurrent && isConnected && socket) {
//     sendMessage(`play ${bookCurrent.bookURL} ${bookCurrent.currentChapter} `)
//   }
// },[bookCurrent, isConnected, socket])

  if (loading || !library ) {
    return <div>Loading...</div>; // Display loading state until library is set
  }
  // const filteredBooks = books.filter((book) =>
  //   activeCategory === "All Books" ? true : book.categorys === activeCategory
  // );
  return (
    <div className="flex flex-col w-full">
    {bookCurrent ? <ContinueReading book={bookCurrent} /> : <></>}
      <CategoryTabs
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {
        books.map((book) => (
          <AudioBookCard
            key={book.id}
            id = {book.id}
            title={book.title}
            author={book.author}
            coverImg={book.coverImg}
            categoryList={book.categoryList}
            numberOfChapters={book.numberOfChapters}
            bookURL={book.bookURL}
            isComplete={book.isComplete}
            chList={book.chList}
          />
        ))}
      </div>
    </div>
  );
};