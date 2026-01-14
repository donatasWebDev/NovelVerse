import { ReactNode, createContext, useContext, useEffect, useState, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from 'js-cookie';
import { Book, BookCurrent, UserType } from "../types";
import { list } from "postcss";
import { useAuth } from "./AuthContex";
import { promises } from "dns";

// const isDev = import.meta.env.DEV;
// const url = isDev
//   ? (import.meta.env.VITE_API_BASE_URL + "/lib" || 'http://localhost:8001')
//   : '' + "/api/lib";

const url = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001"

interface LibraryType {
  books: Book[]
  totalBooks: number
  totalPages: number
  currentPage: number

}

interface LibraryContextType {
  library: LibraryType | null;
  loading: boolean;
  currentBook: BookCurrent | null;
  streamKey: string | null;
  fetchLibrary: (page: number, q: string) => void;
  getBookById: (id: string) => Promise<Book | undefined>;
  handleSetCurrentBook: (book: BookCurrent) => void;
  initializeAudioBook: (book: Book, currect_ch: String) => void
  getCurrentBook: () => BookCurrent | null;
  getChapterAudioCurrent: (book: BookCurrent, chapterURl: string) => Promise<string> | null,
  getStreamKey: () => Promise<string> | null,
  verifyStreamKey: (streamKey: string, id: string) => Promise<any> | null,
}

const LibraryContex = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [library, setLibrary] = useState<LibraryType | null>(null);
  const [currentBook, setCurrentBook] = useState<BookCurrent | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [streamKey, setStreamKey] = useState<string | null>(null)
  const navigate = useNavigate();
  const { user } = useAuth()!

  useEffect(() => {
    const token = Cookies.get("userToken");
    if (!token) {
      navigate("/login");
    }
    if (!user) {
      navigate("/login");
    }
    if (!streamKey && token) {
      getStreamKey()
        .then((token: string | null) => {
          setStreamKey(token)
        })
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageQuery = params.get("page");
    const q = params.get("q") || "";


    const newPage = pageQuery ? parseInt(pageQuery, 10) : 1;

    // Only update if changed
    if (newPage !== page) {
      setPage(newPage);
      fetchLibrary(newPage, q);
    }
    else {
      fetchLibrary(page, q)
    }
  }, [location.search]);

  useEffect(() => {
    if (streamKey) {
      if (!user) {
        navigate("/login");
        return;
      }
      verifyStreamKey(streamKey, user.id)
        .then((res: any) => {
          console.log(res)
        })
        .catch((err: any) => {
          console.log(err)
          setStreamKey(null)
        })
    }
  }, [streamKey])



  const fetchLibrary = async (page: number, q: string = "") => {
    try {
      console.log("fetching library page", page)
      const response = await axios.get(`${url}/get/books?page=${page}&q=${q}`);
      if (response.data) {
        setLibrary(response.data as LibraryType)
        // navigate("/")
      }
      setLoading(false);
    }
    catch (err) {
      console.log(err);
    }
  }

  const getBookById = async (id: string): Promise<Book | undefined> => {
    try {
      if (!id) {
        return undefined;
      }
      console.log("fetching book by id", `${url}/get/book/${id}`)
      const res: any = await axios.get(`${url}/get/book/${id}`);
      console.log("getBookById", res.data);
      if (res) {
        return res.data as Book;
      }
      return undefined;
    } catch (error) {
      console.error("Error fetching book by ID:", error);
    }
  }

  const handleSetCurrentBook = (book: BookCurrent) => {
    Cookies.set("currentBook", JSON.stringify(book));
    localStorage.setItem("currentBook", JSON.stringify(book));
    setCurrentBook(book);
    return book
    // Cookies.set("currentBook", JSON.stringify(book));
  }

  const getCurrentBook = (): BookCurrent | null => {
    const bookLocal = localStorage.getItem("currentBook");
    // Check if bookLocal is not null, undefined, or an empty string
    if (bookLocal && bookLocal !== "undefined" && bookLocal !== "null" && bookLocal !== "") {
      try {
        return JSON.parse(bookLocal);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    }
    return null;
  };

  const initializeAudioBook = async (book: Book, current_ch: String) => {
    try {
      const newCurrentBook: BookCurrent = {
        ...book,
        progress: 0,
        currentChapter: Number(current_ch),
        isPlaying: false,
        speed: 1
      }
      const updatedLibrary = {
        ...library,
        books: (library?.books ?? []).map((b) => (b.id === book.id ? book : b)),
      };
      setLibrary(updatedLibrary)
      handleSetCurrentBook(newCurrentBook)
      return newCurrentBook;
    }
    catch (err) {
      console.log(err);
    }
  }



  const getChapterAudioCurrent = async (book: BookCurrent, chapterURl: string) => {
    try {
      if (!book) return undefined
      if (!book.chList || book.chList.length < 0) return undefined
      const exists = book?.chList?.some(ch => 'chapterURL' in ch) ?? false;
      if (!exists) return undefined

      const token = Cookies.get("userToken");
      if (!token) {
        navigate("/login");
        return undefined
      }
      const res = await axios.post(`${url}/get/ch/audio/`, { chUrl: chapterURl }, {
        headers: {
          Authorization: "Bearer " + token
        }
      })

      if (res) {
        if (res.data.audio) {
          const newCurrentBook: BookCurrent = {
            ...book,
          }
          handleSetCurrentBook(newCurrentBook)
          console.log("axios got chpter audio")
          return res.data.audio.text
        }
      }
    }
    catch (err) {
      console.log(err);
      return;
    }
  }

  const getStreamKey = async () => {
    try {
      const token = Cookies.get("userToken");
      if (!token) {
        navigate("/login");
        return undefined
      }
      const res = await axios.get(`${url}/get/audio/key`, {
        headers: {
          Authorization: "Bearer " + token
        }
      })
      if (res) {
        if (res.data) {
          setStreamKey(res.data.token)
          return res.data.token
        }
      }
    }
    catch (err) {
      console.log(err);
      return;
    }
  }

  const verifyStreamKey = async (streamKey: string, id: string) => {
    try {
      console.log("verifyStreamKey", { streamKey: streamKey, userId: id, message: "front" })
      const res = await axios.post(`${url}/verify/`, { streamKey: streamKey, userId: id, message: "front" })
      if (res.data) {
        console.log("streamKey verified")
        return true;
      }
    } catch (error) {
      console.error("Error verifying streamKey:", error);
      return false;
    }

  }

  const contextData: LibraryContextType = useMemo(
    () => ({
      library,
      loading,
      streamKey,
      currentBook,
      fetchLibrary,
      getBookById,
      handleSetCurrentBook,
      initializeAudioBook,
      getCurrentBook,
      getChapterAudioCurrent,
      getStreamKey,
      verifyStreamKey
    }),
    [library, loading]
  );

  return (
    <LibraryContex.Provider value={contextData}>
      {loading ? (
        <div className="w-8 aspect-square animate-spin bg-gradient-to-t from-black to-fuchsia-500">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      ) : (
        children
      )}
    </LibraryContex.Provider>
  )
};
export const useLibrary = () => {
  return useContext(LibraryContex);
};
export default LibraryContex;
