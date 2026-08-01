"use client";

import { useEffect, useRef, useState } from "react";
import UploadTile from "@/components/UploadTile";
import BookCard from "@/components/BookCard";
import ProcessingToast, { type ProcessingState } from "@/components/ProcessingToast";
import { getAllBookSummaries, saveBook, deleteBook } from "@/lib/db";
import { deriveTitleFromFilename } from "@/lib/deriveTitle";
import type { Book, BookSummary, ProcessPdfResponse } from "@/lib/types";

function uploadAndProcess(
  file: File,
  onUploadProgress: (loaded: number, total: number) => void
): Promise<ProcessPdfResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onUploadProgress(e.loaded, e.total);
    });

    xhr.addEventListener("load", () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as ProcessPdfResponse);
        } else {
          reject(new Error(body.error ?? "Processing failed."));
        }
      } catch {
        reject(new Error("Processing failed."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed.")));

    xhr.open("POST", "/api/process");
    xhr.send(formData);
  });
}

export default function LibraryPage() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const queueRef = useRef<File[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    getAllBookSummaries()
      .then(setBooks)
      .catch(() => setBooks([]));
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4500);
    return () => clearTimeout(timer);
  }, [error]);

  async function processFile(file: File) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError(`"${file.name}" isn't a PDF.`);
      return;
    }

    setProcessing({
      fileName: file.name,
      stage: "uploading",
      current: 0,
      total: 0,
      queued: queueRef.current.length,
    });

    try {
      const result = await uploadAndProcess(file, (loaded, total) => {
        setProcessing((p) => (p ? { ...p, stage: "uploading", current: loaded, total } : p));
      });

      setProcessing((p) => (p ? { ...p, stage: "processing" } : p));

      const book: Book = {
        id: crypto.randomUUID(),
        title: deriveTitleFromFilename(file.name),
        author: "",
        createdAt: Date.now(),
        pageCount: result.pageCount,
        wordCount: result.wordCount,
        cover: result.cover,
        paragraphs: result.paragraphs,
        images: result.images,
        progress: 0,
      };

      setProcessing((p) => (p ? { ...p, stage: "done" } : p));
      await saveBook(book);
      setBooks((prev) => {
        const summary: BookSummary = {
          id: book.id,
          title: book.title,
          author: book.author,
          createdAt: book.createdAt,
          pageCount: book.pageCount,
          wordCount: book.wordCount,
          cover: book.cover,
          progress: book.progress,
        };
        return prev ? [summary, ...prev] : [summary];
      });
    } catch (err) {
      console.error(err);
      setError(
        `Couldn't process "${file.name}". It may be scanned images without a text layer, or corrupted.`
      );
    }
  }

  async function processQueue() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    while (queueRef.current.length > 0) {
      const file = queueRef.current.shift();
      if (file) await processFile(file);
    }
    isProcessingRef.current = false;
    setProcessing(null);
  }

  function enqueueFiles(fileList: FileList) {
    queueRef.current.push(...Array.from(fileList));
    void processQueue();
  }

  async function handleDelete(id: string) {
    await deleteBook(id);
    setBooks((prev) => prev?.filter((b) => b.id !== id) ?? null);
  }

  return (
    <div
      className="relative flex-1"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (e.dataTransfer.files.length > 0) enqueueFiles(e.dataTransfer.files);
      }}
    >
      <header className="mx-auto max-w-6xl px-6 pt-14 pb-8 sm:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          Reframe
        </p>
        <h1 className="mt-3 font-serif text-3xl text-ink sm:text-4xl">Your library</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
          Import a rough PDF scan and Reframe re-typesets it into clean, readable
          pages &mdash; fixed hyphens, stripped running headers, and proper paragraphs.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        {books === null ? (
          <div className="py-24 text-center text-sm text-ink-faint">
            Loading your library…
          </div>
        ) : (
          <div className="masonry">
            <UploadTile onFiles={enqueueFiles} />
            {books.map((book) => (
              <BookCard key={book.id} book={book} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {isDraggingOver && (
        <div className="pointer-events-none fixed inset-4 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent bg-accent-soft/60 backdrop-blur-sm">
          <p className="font-serif text-xl text-accent">Drop your PDF to import</p>
        </div>
      )}

      {error && (
        <div className="animate-fade-in fixed bottom-5 left-5 z-50 max-w-xs rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {error}
        </div>
      )}

      <ProcessingToast state={processing} />
    </div>
  );
}
