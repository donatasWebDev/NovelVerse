import React from "react";
import { AudioBookCard } from "../components/AudioBookCard";
export const LibraryPage = () => {
  const savedBooks = [{
    title: "Sword Art Online",
    author: "Reki Kawahara",
    duration: "6h 20m",
    progress: 75,
    cover: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=800",
    categoryList: "Isekai"
  }
  // Add more saved books as needed
  ];
  return <div className="p-4">
      <h2 className="text-2xl font-bold text-gray-100 mb-6">Your Library</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {savedBooks.map(book => <AudioBookCard key={book.title} {...book} />)}
      </div>
    </div>;
};