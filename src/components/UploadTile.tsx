"use client";

import { useRef } from "react";
import { UploadCloud } from "lucide-react";

export default function UploadTile({
  onFiles,
}: {
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="aspect-[3/4] w-full">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-accent-soft/40 px-6 text-center transition-colors hover:border-accent/50 hover:bg-accent-soft/70"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-accent shadow-sm">
          <UploadCloud className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="font-serif text-base text-ink">Import a PDF</span>
        <span className="text-xs text-ink-soft">or drag &amp; drop anywhere</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
