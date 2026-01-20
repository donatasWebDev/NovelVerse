export interface Book {
  title: string
  author: string
  coverImg: string
  categoryList: string[]
  chList: Chapter[]
  numberOfChapters: number
  bookURL: string
  isComplete: boolean
  id: string
  isFavorite?: boolean
}
export interface FavoriteBook {
  book: Book
  bookId: string
  id: string
  latestChapter: number
  userId: string
}
export interface Chapter {
  bookId: string
  nr: number
  text?: string | null
}
export interface UserType {
  email: string
  name: string
  id: string
  token: string
  avatarUrl?: string
}
export interface BookCurrent extends Book {
  progress: number
  currentChapter: number
  speed: number
  isPlaying: boolean
}

export interface LoginInfo {
  email: {
    text: string
    err: string
  }
  password: {
    text: string
    err: string
  }
}
