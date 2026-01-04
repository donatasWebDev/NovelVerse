export interface Book {
    title: string;
    author: string;
    coverImg: string;
    categoryList: string[];
    chList: Chapter[];
    numberOfChapters: number;
    bookURL: string;
    isComplete: boolean;
    id: string;
}
export interface Chapter {
    bookId: string;
    nr: number;
    text?: string | null;

}
export interface UserType {
    email: string;
    name: string;
    id: string;
    token: string;
    avatarUrl?: string; // Optional if not always present
  }
  export interface BookCurrent extends Book{
    progress: number;
    currentChapter: number;
    speed: number;
    isPlaying: boolean;
  }