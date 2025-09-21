import React from "react";
import { Search as SearchIcon } from "lucide-react";
export const SearchPage = () => {
  return <div className="p-4">
      <div className="relative mb-6">
        <input type="text" placeholder="Search novels..." className="w-full bg-gray-700 text-gray-100 rounded-lg pl-10 pr-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none" />
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      </div>
      <div className="text-center text-gray-400 mt-12">
        <SearchIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Search for your favorite light novels</p>
      </div>
    </div>;
};