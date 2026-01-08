import React from "react";
import { Home, Search, Library } from "lucide-react";
import { Link } from "react-router-dom";

export const BottomNav = () => {
  return <nav className="fixed lg:hidden bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-3">
      <div className="container mx-auto flex justify-around items-center max-w-lg">
        <Link to={"/"} className="flex flex-col items-center gap-1">
          <Home className="w-6 h-6 text-purple-600" />
          <span className="text-xs text-gray-300">Home</span>
        </Link>
        <Link to={"/search"} className="flex flex-col items-center gap-1">
          <Search className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-300">Search</span>
        </Link>
        <Link to={"/library"} className="flex flex-col items-center gap-1">
          <Library className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-300">Library</span>
        </Link>
      </div>
    </nav>;
};