import React, { useEffect, useState } from "react";
import { AudioBookCard } from "../components/AudioBookCard";
import { useLibrary } from "../uttils/LibraryContext";
import { Book } from "../types";
export const LibraryPage = () => {
  const { handleGetFavoriteBooks } = useLibrary()!; // Assumed library context
  const [books, setBooks] = useState<Book[]>([])
  
  useEffect(() => {
    const firstCall = async () => {
      const favoriteBooks = await handleGetFavoriteBooks()
      if (favoriteBooks && favoriteBooks.length > 0) {
        const allBooks = favoriteBooks.map(fav => fav.book)
        console.log(allBooks)
        setBooks(allBooks)
      }
    }
    firstCall()
  }, [])
  const handleRemoveFavorite = (bookId: string) => {
    if (!bookId) {
      return
    }
    const filteredBooks = books.filter(book => book.id != bookId)
    setBooks(filteredBooks)
  }

  return <div className="p-4">
    <h1 className="text-2xl font-bold text-gray-100 mb-4">My Library</h1>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books?.length === 0 ? (
        <p className="text-gray-400">No books found.</p>
      ) : (
        books.map((book) => (
          <AudioBookCard
            key={book.id}
            id={book.id}
            title={book.title}
            author={book.author}
            coverImg={book.coverImg}
            categoryList={book.categoryList}
            numberOfChapters={book.numberOfChapters}
            bookURL={book.bookURL}
            isComplete={book.isComplete}
            chList={book.chList}
            favoriteBooks={books}
            removeBook={handleRemoveFavorite}
          />
        ))
      )}
    </div>
  </div>

};