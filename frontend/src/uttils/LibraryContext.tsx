import { ReactNode, createContext, useContext, useEffect, useState, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from 'js-cookie';
import { Book, BookCurrent, UserType } from "../types";
import { list } from "postcss";
import { useAuth } from "./AuthContex";
import { promises } from "dns";

const url = "http://localhost:4000/api/lib";
// const url = "https://chat-app-backend-shool-project.glitch.me";

interface LibraryType {
  books: Book[]
}

interface LibraryContextType {
  library: LibraryType | null;
  loading: boolean;
  currentBook: BookCurrent | null;
  streamKey: string | null;
  fetchLibrary: (page: number, q: string) => void;
  handleSetCurrentBook: (book: BookCurrent) => void;
  getBookChapters: (book: Book, currect_ch: String) => void
  getCurrentBook: () => BookCurrent | null;
  getChpaterAudioCurrent: (book: BookCurrent, chapterURl: string) => Promise<string> | null,
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
    if (library) {
      const token = Cookies.get("token");
      if (!token) {
        navigate("/login");
      }
      if (!user) {
        navigate("/login");
      }
    }
    if (!streamKey) {
      getStreamKey()
        .then((streamKey) => {
          setStreamKey(streamKey.token)
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

  const getBookChapters = async (book: Book, current_ch: String) => {
    console.log("old book not found")
    try {
      const bookUrl = book.bookURL;
      const id = book.id
      console.log("bookdid", id)
      const oldBook = library?.books.find((book) => book.id === id)
      if (oldBook?.chList && oldBook?.chList.length > 0) {
        const newCurrentBook: BookCurrent = {
          ...oldBook,
          progress: 0,
          currentChapter: Number(current_ch),
          currentChapterTitle: oldBook.chList[Number(current_ch)].title,
          isPlaying: false,
          speed: 1,
        }
        return { list: oldBook.chList, book: newCurrentBook };
      }

      if (!bookUrl || !id) return;
      console.log(`${url}/get/ch/${id}`, { bookURL: bookUrl, nr: current_ch })
      const response = await axios.put(`${url}/put/ch/${id}`, { bookURL: bookUrl, nr: current_ch });
      if (response.data.chapters) {
        if (oldBook?.chList) {
          const updatedBook = { ...oldBook, chList: response.data.chapters }
          const newCurrentBook: BookCurrent = {
            ...updatedBook,
            progress: 10,
            currentChapter: Number(current_ch),
            currentChapterTitle: response.data.chapters[Number(current_ch)].title,
            isPlaying: false,
            speed: 1
          }
          const updatedLibrary = {
            ...library,
            books: (library?.books ?? []).map((b) => (b.id === updatedBook.id ? updatedBook : b)),
          };
          setLibrary(updatedLibrary)
          handleSetCurrentBook(newCurrentBook)
          return response.data.chapters;
        }

      }
    }
    catch (err) {
      console.log(err);
    }
  }



  const getChpaterAudioCurrent = async (book: BookCurrent, chapterURl: string) => {
    try {
      if (!book) return undefined
      if (!book.chList || book.chList.length < 0 || book.audioURL) return undefined
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
            audioURL: res.data.audio.text
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
          console.log(res.data)
          return res.data
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
      handleSetCurrentBook,
      getBookChapters,
      getCurrentBook,
      getChpaterAudioCurrent,
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
