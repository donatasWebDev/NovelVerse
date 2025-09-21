import React from "react";
import { Menu } from "lucide-react";
export const TopNav = () => {
  return <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      <h1 className="text-xl font-bold text-gray-100">NovelVerse</h1>
      <button className="w-8 h-8 rounded-full overflow-hidden">
        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100" alt="User profile" className="w-full h-full object-cover" />
      </button>
    </div>;
};