import React, { useEffect, useRef, useState } from "react";
import { AudioBookCard } from "../components/AudioBookCard";
import { CategoryTabs } from "../components/CategoryTabs";
import { ContinueReading } from "../components/ContinueReading";
import { useLibrary } from "../uttils/LibraryContext";
import { Book, BookCurrent } from "../types";
import { useAuth } from "../uttils/AuthContex";
import { useNavigate } from "react-router-dom";
import { get } from "http";
import { SearchIcon } from "lucide-react";
import InfiniteScroll from "react-infinite-scroll-component";
const categories = [
  "All Books",
  "Isekai",
  "Romance",
  "Action",
  "Fantasy",
  "Slice of Life",
];

export const HomePage = () => {
  const { library, getCurrentBook, streamKey, fetchLibrary } = useLibrary()!; // Assumed library context
  // const {connect, isConnected} = useSocket();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookCurrent, setBookCurrent] = useState<BookCurrent | null>(null)
  const [activeCategory, setActiveCategory] = useState("All Books");
  const [loading, setLoading] = useState(true); // Track loading state
  const [page, setPage] = useState<number>(getCurrentPage());
  const [hasMore, setHasMore] = useState(true);
  const { user } = useAuth()!
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [totalBooks, setTotalBooks] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate()
  const limit = 20

  useEffect(() => {
    if (library) {
      if (searchQuery === "") {
        setBooks(library.books);
      } else {
        setBooks(prev => [...prev, ...library.books]); // ← THIS NOW ACTUALLY ADDS
      }
      setLoading(false); // Mark loading as false when library is set

      setHasMore(library.books.length === limit);
      setTotalBooks(library.totalBooks || null);
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

  // Reset on query change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchBooks(true);
    setBooks([]);
  }, [searchQuery]);

  const fetchBooks = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    fetchLibrary(currentPage, encodeURIComponent(searchQuery));

    // If we got less than limit, no more to load
    if (!reset) setPage(prev => prev + 1);
  };


  function getCurrentPage(): number {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  }

  function getPageWindow(page: number, window = 5) {
    const half = Math.floor(window / 2);

    let start = page - half;
    if (start < 1) start = 1;

    return Array.from({ length: window }, (_, i) => start + i);
  }

  const handlePageSelect = (selectedPage: number) => {
    setPage(selectedPage);
    navigate(`/?page=${selectedPage}`);
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      fetchLibrary(page, q);
    }, 300);

  }

  return (
    <div className="flex flex-col w-full">
      {bookCurrent ? <ContinueReading book={bookCurrent} /> : <></>}
      <div className="flex flex-col-reverse sm:flex-row  w-full gap-4">
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
        <div className="flex-1 w-full max-h-12 flex items-center relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 " />
          <input
            type="text"
            placeholder="Search books..."
            className="p-2 ps-10 rounded-md w-full  bg-gray-800 text-white focus:border focus:border-purple-700 focus:outline-none"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e)}
          />
        </div>
      </div>

      {
        searchQuery === "" ? (
          // Normal pagination mode
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books?.length === 0 ? (
                <p className="text-gray-400">No books found.</p>
              ) : (
                books.map((book: any, index: number) => (
                  <AudioBookCard
                    key={index}
                    id={book.id}
                    title={book.title}
                    author={book.author}
                    coverImg={book.coverImg}
                    categoryList={book.categoryList}
                    numberOfChapters={book.numberOfChapters}
                    bookURL={book.bookURL}
                    isComplete={book.isComplete}
                    chList={book.chList}
                  />
                ))
              )}
            </div>

            {/* Pagination controls */}
            <div className="flex flex-col items-center mt-6">
              <div className="flex items-center gap-1">
                {/* Previous button */}
                <div className="flex justify-center text-center items-center gap-0">
                  <svg
                    width="1.5em"
                    height="1.5em"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    color="white"
                    className="mr-1.5 h-4 w-4 stroke-2"
                  >
                    <path
                      d="M15 6L9 12L15 18"
                      stroke="white"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                  <button className="sm:inline-flex hidden items-center justify-center border align-middle select-none font-sans font-medium text-center transition-all duration-300 ease-in disabled:cursor-not-allowed focus:shadow-none text-sm rounded-md py-2 px-4 pl-0 bg-transparent border-transparent text-white hover:bg-purple-800/5 hover:border-stone-800/5 shadow-none hover:shadow-none">
                    Previous
                  </button>
                </div>

                {/* Page numbers */}
                {getPageWindow(page).map((index: number) => (
                  <button
                    key={index}
                    className={`
                  inline-flex items-center justify-center border align-middle select-none font-sans font-medium text-center transition-all duration-300 ease-in disabled:cursor-not-allowed focus:shadow-none text-sm rounded-md py-2 px-4 border-transparent text-white hover:bg-purple-800/5 hover:border-stone-800/5 shadow-none hover:shadow-none
                  ${page === index ? "bg-purple-600" : ""}
                  `}
                    onClick={() => handlePageSelect(index)}
                  >
                    {index}
                  </button>
                ))}

                {/* Next button */}
                <div className="flex justify-center text-center items-center gap-0">
                  <button className="sm:inline-flex hidden items-center justify-center border align-middle select-none font-sans font-medium text-center transition-all duration-300 ease-in disabled:cursor-not-allowed focus:shadow-none text-sm rounded-md py-2 px-4 pr-0 bg-transparent border-transparent text-white hover:bg-purple-800/5 hover:border-stone-800/5 shadow-none hover:shadow-none">
                    Next
                  </button>
                  <svg
                    width="1.5em"
                    height="1.5em"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    color="white"
                    className="ml-1.5 h-4 w-4 stroke-2 items-center"
                  >
                    <path
                      d="M9 6L15 12L9 18"
                      stroke="white"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>
          </>
        ) : (
          // Infinite scroll mode
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
                No more results for "<span className="text-purple-400">{searchQuery}</span>" — time to cultivate a new search
              </p>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map((book: any, index: number) => (
                <AudioBookCard
                  key={index}
                  id={book.id}
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
          </InfiniteScroll>
        )
      }

    </div >
  );
};