"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import type { BookSummary } from "@/lib/types";
import { estimateReadingMinutes, formatWordCount } from "@/lib/deriveTitle";

const COVER_PALETTE = [
  "from-[#e7d9c4] to-[#cbb896]",
  "from-[#d9c9b8] to-[#b39a7e]",
  "from-[#e3d4b8] to-[#c2a878]",
  "from-[#dccdb0] to-[#a98f6a]",
];

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_PALETTE[hash % COVER_PALETTE.length];
}

export default function BookCard({
  book,
  onDelete,
}: {
  book: BookSummary;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const progressPercent = Math.round(book.progress * 100);

  return (
    <div className="group relative animate-fade-in overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(34,31,28,0.06)] ring-1 ring-line/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(34,31,28,0.22)]">
      <Link href={`/book/${book.id}`} className="block">
        <div className="relative w-full overflow-hidden">
          {book.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover}
              alt=""
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className={`flex aspect-[3/4] w-full items-center justify-center bg-gradient-to-br ${paletteFor(
                book.id
              )}`}
            >
              <BookOpen className="h-9 w-9 text-white/70" strokeWidth={1.5} />
            </div>
          )}

          {progressPercent > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
              <div
                className="h-full bg-accent"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="px-4 pt-3 pb-4">
          <h3 className="font-serif text-[1.05rem] leading-snug text-ink line-clamp-2">
            {book.title}
          </h3>
          <p className="mt-1.5 text-xs text-ink-soft">
            {formatWordCount(book.wordCount)} · {estimateReadingMinutes(book.wordCount)} min read
          </p>
          {progressPercent > 0 && (
            <p className="mt-1 text-xs font-medium text-accent">
              {progressPercent}% read
            </p>
          )}
        </div>
      </Link>

      <button
        type="button"
        aria-label={confirming ? "Confirm delete" : "Delete book"}
        onClick={(e) => {
          e.preventDefault();
          if (confirming) {
            onDelete(book.id);
          } else {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 2500);
          }
        }}
        className={`absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-all ${
          confirming
            ? "bg-accent text-white opacity-100"
            : "bg-white/85 text-ink-soft opacity-0 group-hover:opacity-100 hover:text-accent"
        }`}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        {confirming && "Confirm"}
      </button>
    </div>
  );
}
