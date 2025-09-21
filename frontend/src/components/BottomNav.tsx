import React from "react";
import { Home, Search, Library } from "lucide-react";
export const BottomNav = () => {
  return <nav className="fixed lg:hidden bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-3">
      <div className="container mx-auto flex justify-around items-center max-w-lg">
        <button className="flex flex-col items-center gap-1">
          <Home className="w-6 h-6 text-purple-600" />
          <span className="text-xs text-gray-300">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Search className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-300">Search</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Library className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-300">Library</span>
        </button>
      </div>
    </nav>;
};