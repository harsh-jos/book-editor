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

type PageItem =
  | { kind: "paragraph"; text: string; y: number }
  | { kind: "image"; dataUrl: string; width: number; height: number; y: number };

interface PageGroup {
  page: number;
  items: PageItem[];
}

/** Tolerates books saved before per-paragraph page/position tracking existed (plain string paragraphs). */
function normalizeParagraph(p: unknown): { text: string; page: number; y: number } {
  if (typeof p === "string") return { text: p, page: 1, y: 0 };
  const obj = p as { text?: unknown; page?: unknown; y?: unknown };
  return {
    text: typeof obj.text === "string" ? obj.text : "",
    page: typeof obj.page === "number" ? obj.page : 1,
    y: typeof obj.y === "number" ? obj.y : 0,
  };
}

/** Groups paragraphs and figures by source PDF page, ordered top-to-bottom within each page. */
function buildPageGroups(book: Book): PageGroup[] {
  const items: (PageItem & { page: number })[] = [
    ...book.paragraphs.map(normalizeParagraph).map(
      (p): PageItem & { page: number } => ({ kind: "paragraph", text: p.text, y: p.y, page: p.page })
    ),
    ...(book.images ?? []).map(
      (img): PageItem & { page: number } => ({
        kind: "image",
        dataUrl: img.dataUrl,
        width: img.width,
        height: img.height,
        y: img.y,
        page: img.page,
      })
    ),
  ];

  const byPage = new Map<number, (PageItem & { page: number })[]>();
  for (const item of items) {
    const list = byPage.get(item.page);
    if (list) list.push(item);
    else byPage.set(item.page, [item]);
  }

  return [...byPage.keys()]
    .sort((a, b) => a - b)
    .map((page) => ({
      page,
      // PDF y-space has its origin at the bottom, so a higher y is higher up the page.
      items: [...byPage.get(page)!].sort((a, b) => b.y - a.y),
    }));
}

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
  const pageGroups = buildPageGroups(book);

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
        <h1 className="mb-12 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          {book.title}
        </h1>
        {pageGroups.map((group, groupIndex) => (
          <section
            key={groupIndex}
            className="relative mb-14 rounded-[1.5rem] border border-line/80 px-6 py-9 shadow-[0_1px_1px_rgba(34,31,28,0.03)] sm:px-12 sm:py-12"
          >
            <div
              className={fontClass}
              style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
            >
              {group.items.map((item, i) =>
                item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={item.dataUrl}
                    alt=""
                    width={item.width}
                    height={item.height}
                    className="mx-auto mb-[1.1em] max-w-full rounded-lg shadow-[0_2px_10px_rgba(34,31,28,0.12)] last:mb-0"
                  />
                ) : (
                  <p key={i} className="mb-[1.1em] text-ink last:mb-0">
                    {item.text}
                  </p>
                )
              )}
            </div>
            <span className="absolute bottom-3 right-5 text-xs tabular-nums text-ink-faint">
              {group.page}
            </span>
          </section>
        ))}
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
