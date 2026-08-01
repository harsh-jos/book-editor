"use client";

import { X, Minus, Plus } from "lucide-react";
import clsx from "clsx";
import type { ReaderSettings } from "@/lib/types";
import { FONT_OPTIONS, PAPER_OPTIONS, WIDTH_OPTIONS } from "@/lib/readerSettings";

export default function ReaderSettingsPanel({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: ReaderSettings;
  onChange: (next: ReaderSettings) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px] transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={clsx(
          "fixed right-0 top-0 z-50 h-full w-[300px] overflow-y-auto bg-surface shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-serif text-lg text-ink">Display</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft hover:bg-paper hover:text-ink"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-7 px-5 py-6">
          <section>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Typeface
            </p>
            <div className="flex gap-2">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...settings, font: opt.value })}
                  className={clsx(
                    "flex-1 rounded-xl border px-2 py-2.5 text-sm transition-colors",
                    opt.className,
                    settings.font === opt.value
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line text-ink-soft hover:border-ink-faint"
                  )}
                >
                  Ag
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Text size
            </p>
            <Stepper
              value={settings.fontSize}
              unit="px"
              onDecrease={() =>
                onChange({ ...settings, fontSize: Math.max(14, settings.fontSize - 1) })
              }
              onIncrease={() =>
                onChange({ ...settings, fontSize: Math.min(28, settings.fontSize + 1) })
              }
            />
          </section>

          <section>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Line spacing
            </p>
            <Stepper
              value={settings.lineHeight.toFixed(1)}
              onDecrease={() =>
                onChange({
                  ...settings,
                  lineHeight: Math.max(1.3, +(settings.lineHeight - 0.1).toFixed(1)),
                })
              }
              onIncrease={() =>
                onChange({
                  ...settings,
                  lineHeight: Math.min(2.1, +(settings.lineHeight + 0.1).toFixed(1)),
                })
              }
            />
          </section>

          <section>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Column width
            </p>
            <div className="flex gap-2">
              {WIDTH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...settings, width: opt.value })}
                  className={clsx(
                    "flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                    settings.width === opt.value
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line text-ink-soft hover:border-ink-faint"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Paper
            </p>
            <div className="flex gap-2">
              {PAPER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...settings, paper: opt.value })}
                  className={clsx(
                    "flex h-10 flex-1 items-center justify-center rounded-xl border text-xs font-medium text-ink-soft transition-colors",
                    opt.className,
                    settings.paper === opt.value ? "border-accent ring-2 ring-accent/30" : "border-line"
                  )}
                >
                  {settings.paper === opt.value ? opt.label : ""}
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Stepper({
  value,
  unit,
  onDecrease,
  onIncrease,
}: {
  value: string | number;
  unit?: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-1.5 py-1.5">
      <button
        type="button"
        onClick={onDecrease}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-paper hover:text-ink"
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="text-sm text-ink">
        {value}
        {unit ?? ""}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-paper hover:text-ink"
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
