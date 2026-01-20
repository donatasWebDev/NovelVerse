import React, { useEffect, useRef, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { useLibrary } from "../uttils/LibraryContext";
import { Book } from "../types";
import { useAuth } from "../uttils/AuthContex"; // Typo? Probably AuthContext
import { useNavigate } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { AudioBookCard } from "../components/AudioBookCard";

export const SearchPage = () => {
  const { library, fetchLibrary, handleGetFavoriteBooks } = useLibrary()!;
  const [books, setBooks] = useState<Book[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[] | null>(null);
  const [page, setPage] = useState<number>(getCurrentPage());
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuth()!;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [totalBooks, setTotalBooks] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const limit = 20;

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    // Reset on search change
    setPage(1);
    setHasMore(true);
    setBooks([]);
    fetchBooks(true);
  }, [searchQuery]);

  useEffect(() => {
    if (library) {
      if (searchQuery === "") {
        setBooks(library.books);
      } else {
        setBooks((prev) => [...prev, ...library.books]);
      }

      setHasMore(library.books.length === limit);
      setTotalBooks(library.totalBooks || null);
    }
  }, [library, searchQuery]);

  function getCurrentPage(): number {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  }

  const fetchBooks = async (reset = false) => {
    const currentPage = reset ? 1 : page;

    // Fetch library books
    fetchLibrary(currentPage, encodeURIComponent(searchQuery));

    // Fetch favorites separately
    const newFavoriteBooks = await handleGetFavoriteBooks();
    if (newFavoriteBooks) {
      const allBooks: Book[] = newFavoriteBooks.map((fav) => fav.book);
      console.log("Favorites loaded:", allBooks);
      setFavoriteBooks(allBooks);
    } else {
      setFavoriteBooks([]);
    }

    if (!reset) setPage((prev) => prev + 1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      fetchBooks(true);
    }, 300);
  };

  return (
    <div className="p-4">
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search novels..."
          className="w-full bg-gray-700 text-gray-100 rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none"
          onChange={handleSearchChange}
          value={searchQuery}
        />
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      </div>

      {searchQuery  ? (
        <InfiniteScroll
          dataLength={books.length}
          next={() => fetchBooks()}
          hasMore={hasMore}
          loader={
            <div className="text-center py-8">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-4 text-gray-400">Loading more novels...</p>
            </div>
          }
          endMessage={
            <p className="text-center py-8 text-gray-500">
              No more results for "
              <span className="text-purple-400">{searchQuery}</span>" — time to
              cultivate a new search
            </p>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book, index) => (
              <AudioBookCard
                key={book.id || index}
                id={book.id}
                title={book.title}
                author={book.author}
                coverImg={book.coverImg}
                categoryList={book.categoryList}
                numberOfChapters={book.numberOfChapters}
                bookURL={book.bookURL}
                isComplete={book.isComplete}
                chList={book.chList}
                favoriteBooks={favoriteBooks ?? []} 
              />
            ))}
          </div>
        </InfiniteScroll>
      ) : (
        <div className="text-center text-gray-400 mt-12">
          <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Search for your favorite light novels</p>
        </div>
      )}
    </div>
  );
};