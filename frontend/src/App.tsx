import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { SideNav } from "./components/SideNav";
import { TopNav } from "./components/TopNav";

import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { PlayerMiddle } from "./components/PlayerMiddle";
import { HomePage } from "./pages/homePage";

import {AuthProvider} from "./uttils/AuthContex";
import {LibraryProvider} from "./uttils/LibraryContext";

//!testing
import { Book, BookCurrent } from "../types";
// import { Test } from "./pages/test";
import { AudioPlayerPage } from "./pages/AudioPlayerPage";

const book: BookCurrent = {
    chList: [
        {
            chapterNumber: 1,
            chapterURL: "https://novelbin.me/novel-book/starting-my-cultivation-with-time-management/chapter-1-1-the-junior-sister-always-challenges-me",
            title: "Chapter 1 - 1 The Junior Sister Always Challenges Me",
            text: null
        },
    ],
    id: "67d6dd5785c385d9cc3e8f99",
    v: 0,
    author: "Ghostly Blessing",
    bookURL: "https://novelbin.me/novel-book/starting-my-cultivation-with-time-management",
    categoryList: [
        "Game",
        "Xianxia"
    ],
    coverImg: "https://novelbin.me/media/novel/starting-my-cultivation-with-time-management.jpg",
    isComplete: false,
    numberOfChapters: "Chapter 726 - 60 Rescue, but not all can be saved",
    title: "Starting My Cultivation With Time Management",
    categorysIds: [],
    progress: 0,
    currentChapter: 1,
    currentChapterTitle: "Chapter 2 - 2 Hurry up and get married, you two",
    isPlaying: false,
    speed: 1
}

export function App() {
  return (
    <AuthProvider>
      <LibraryProvider>
      <div className="min-h-screen min-w-screen bg-gray-900">
        <SideNav />
        <TopNav />
        <div className="lg:ml-64 min-h-screen ">
          <main className="container mx-auto px-10 flex flex-col py-8 relative min-w-full min-h-screen">
            <Routes>
              <Route path="/test" element={<AudioPlayerPage book={book} chapter={1} />} />
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />


              <Route path="/play/:p_id/:nr" element={<PlayerMiddle />} />
            </Routes>
          </main>
        </div>
        <BottomNav />
      </div>
    </LibraryProvider>
    </AuthProvider>
  );
}
