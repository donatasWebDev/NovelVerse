import React from "react";
import { AudioBookCard } from "../components/AudioBookCard";
export const LibraryPage = () => {

  return <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-100 mb-6">Your Library</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <span className="text-3xl text-white">Mkae the app remember your saved books here. 20 in a cycle or more idk or add a favorite mechanizm</span>
      </div>
    </div>;
};