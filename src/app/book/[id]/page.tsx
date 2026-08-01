"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { getBook, updateBookProgress } from "@/lib/db";
import {
  FONT_OPTIONS,
  PAPER_OPTIONS,
  WIDTH_OPTIONS,
  loadReaderSettings,
  saveReaderSettings,
} from "@/lib/readerSettings";
import type { Book, ReaderSettings } from "@/lib/types";
import ReaderSettingsPanel from "@/components/ReaderSettingsPanel";

export default function ReaderPage() {
  const params = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null | undefined>(undefined);
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const restoredScroll = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getBook(params.id).then((b) => setBook(b ?? null));
  }, [params.id]);

  useEffect(() => {
    if (!book || restoredScroll.current) return;
    restoredScroll.current = true;
    const frame = requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && book.progress > 0) {
        window.scrollTo(0, book.progress * max);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [book]);

  useEffect(() => {
    if (!book) return;

    function handleScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateBookProgress(params.id, progress);
      }, 700);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [book, params.id]);

  function updateSettings(next: ReaderSettings) {
    setSettings(next);
    saveReaderSettings(next);
  }

  if (book === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">
        Opening book…
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="font-serif text-xl text-ink">This book isn&apos;t in your library.</p>
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  const fontClass = FONT_OPTIONS.find((f) => f.value === settings.font)?.className ?? "font-serif";
  const paperClass = PAPER_OPTIONS.find((p) => p.value === settings.paper)?.className ?? "bg-white";
  const measurePx = WIDTH_OPTIONS.find((w) => w.value === settings.width)?.maxWidth ?? 860;

  return (
    <div className={`min-h-screen ${paperClass} transition-colors duration-300`}>
      <div className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div
          className="mx-auto flex items-center justify-between px-5 py-3 transition-[max-width] duration-300"
          style={{ maxWidth: `${measurePx}px` }}
        >
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Library
          </Link>
          <p className="truncate px-4 font-serif text-sm text-ink-soft">{book.title}</p>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-black/5 hover:text-ink"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Aa
          </button>
        </div>
      </div>

      <article
        className="mx-auto px-6 pb-32 pt-10 transition-[max-width] duration-300 sm:pt-16 sm:px-10"
        style={{ maxWidth: `${measurePx}px` }}
      >
        <h1 className="mb-10 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          {book.title}
        </h1>
        <div
          className={fontClass}
          style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
        >
          {book.paragraphs.map((paragraph, i) => (
            <p key={i} className="mb-[1.1em] text-ink">
              {paragraph}
            </p>
          ))}
        </div>
      </article>

      <ReaderSettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
