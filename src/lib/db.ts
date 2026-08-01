import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Book, BookSummary } from "./types";

interface ReframeDB extends DBSchema {
  books: {
    key: string;
    value: Book;
    indexes: { "by-createdAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<ReframeDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<ReframeDB>("reframe-library", 1, {
      upgrade(db) {
        const store = db.createObjectStore("books", { keyPath: "id" });
        store.createIndex("by-createdAt", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDB();
  await db.put("books", book);
}

export async function getAllBookSummaries(): Promise<BookSummary[]> {
  const db = await getDB();
  const books = await db.getAllFromIndex("books", "by-createdAt");
  return books
    .map((book): BookSummary => {
      const { id, title, author, createdAt, pageCount, wordCount, cover, progress } = book;
      return { id, title, author, createdAt, pageCount, wordCount, cover, progress };
    })
    .reverse();
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await getDB();
  return db.get("books", id);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("books", id);
}

export async function updateBookProgress(id: string, progress: number): Promise<void> {
  const db = await getDB();
  const book = await db.get("books", id);
  if (!book) return;
  book.progress = progress;
  await db.put("books", book);
}
