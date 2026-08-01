"use client";

import { Loader2, Sparkles } from "lucide-react";

export interface ProcessingState {
  fileName: string;
  stage: "reading" | "typesetting" | "cover";
  current: number;
  total: number;
  queued: number;
}

const STAGE_LABEL: Record<ProcessingState["stage"], string> = {
  reading: "Reading pages",
  typesetting: "Cleaning up typography",
  cover: "Finishing up",
};

export default function ProcessingToast({ state }: { state: ProcessingState | null }) {
  if (!state) return null;

  const percent =
    state.stage === "reading" && state.total > 0
      ? Math.round((state.current / state.total) * 100)
      : state.stage === "typesetting"
      ? 90
      : 97;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[300px] animate-fade-in rounded-2xl bg-surface p-4 shadow-[0_16px_40px_-16px_rgba(34,31,28,0.35)] ring-1 ring-line">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          {percent >= 97 ? (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{state.fileName}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {STAGE_LABEL[state.stage]}
            {state.stage === "reading" && state.total > 0
              ? ` · page ${state.current} of ${state.total}`
              : ""}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          {state.queued > 0 && (
            <p className="mt-1.5 text-[11px] text-ink-faint">
              {state.queued} more queued
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
