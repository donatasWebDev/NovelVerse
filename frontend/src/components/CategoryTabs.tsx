import React from "react";
interface CategoryTabsProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}
export const CategoryTabs = ({
  categories,
  activeCategory,
  onCategoryChange
}: CategoryTabsProps) => {
  return <div className="flex flex-1 gap-2 mb-8 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
      {categories.map(category => <button key={category} onClick={() => onCategoryChange(category)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${activeCategory === category ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"}`}>
          {category}
        </button>)}
    </div>;
};