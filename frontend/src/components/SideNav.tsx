import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, Search, Library, Play } from "lucide-react";
import { UserProfile } from "./UserProfile";
import { RegisterLogin } from "./RegisterLogin.tsx";
import { useAuth } from "../uttils/AuthContex.tsx";
export const SideNav = () => {
  const {user} = useAuth()
  const navigate = useNavigate();
  return <div className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-gray-800 border-r border-gray-700 p-6">
    <h1 className="text-xl font-bold text-gray-100 mb-8">NovelVerse</h1>
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
      onClick={() => navigate("/")}>
        <Play className="w-6 h-6" />
        <span className="text-sm font-medium text-gray-300">Play</span>
      </button>
    </nav>
    {user ? <UserProfile /> : <RegisterLogin/>} 
  </div>;
};