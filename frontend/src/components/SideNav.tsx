import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Search, Library, Play } from "lucide-react";
import { UserProfile } from "./UserProfile";
import { RegisterLogin } from "./RegisterLogin.tsx";
import { useAuth } from "../uttils/AuthContex.tsx";
import { useLibrary } from "../uttils/LibraryContext.tsx";
import { NovelVerseLogo } from "./scalableLogo.tsx"
import { get } from "http";
import { BookCurrent } from "../types.ts";
export const SideNav = () => {
  const { user } = useAuth()!
  const { getCurrentBook } = useLibrary()!
  const [book, setBook] = useState<BookCurrent>();
  useEffect(() => {
    let book = getCurrentBook();
    if (book) {
      setBook(book);
    }
  }, []);
  const navigate = useNavigate();

  const handleNavigateToPlayer = () => {
    if (book) {
      navigate(`/play/${book.id}/${book.currentChapter}`);
    } else {
      navigate("");
    }
  };

  return <div className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-gray-800 border-r border-gray-700 p-6">
    <span className="flex items-center mb-8 cursor-pointer" onClick={() => navigate("/")}>
      <NovelVerseLogo color="#DDE0ED" size={45} />
      <h1 className="text-xl h-min font-bold text-gray-100 mt-3">NovelVerse</h1>
    </span>
    <nav className="flex flex-col gap-4">
      <button className="flex items-center gap-3 text-purple-600 hover:bg-gray-700 p-3 rounded-lg transition-colors"
        onClick={() => navigate("/")}
      >
        <Home className="w-6 h-6" />
        <span className="text-sm font-medium text-gray-100">Home</span>
      </button>
      <button className="flex items-center gap-3 text-gray-400 hover:bg-gray-700 p-3 rounded-lg transition-colors"
        onClick={() => navigate("/search")}
      >
        <Search className="w-6 h-6" />
        <span className="text-sm font-medium text-gray-300">Search</span>
      </button>
      <button className="flex items-center gap-3 text-gray-400 hover:bg-gray-700 p-3 rounded-lg transition-colors"
        onClick={() => navigate("/library")}>
        <Library className="w-6 h-6" />
        <span className="text-sm font-medium text-gray-300">Library</span>
      </button>
      <button className="flex items-center gap-3 text-gray-400 hover:bg-gray-700 p-3 rounded-lg transition-colors"
        onClick={handleNavigateToPlayer}>
        <Play className="w-6 h-6" />
        <span className="text-sm font-medium text-gray-300">Play</span>
      </button>
    </nav>
    {user ? <UserProfile /> : <RegisterLogin />}
  </div>;
}