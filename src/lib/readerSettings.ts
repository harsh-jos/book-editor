import type { ReaderFont, ReaderPaper, ReaderSettings, ReaderWidth } from "./types";

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  font: "literata",
  fontSize: 19,
  lineHeight: 1.7,
  width: "normal",
  paper: "cream",
};

const STORAGE_KEY = "reframe:reader-settings";

export const FONT_OPTIONS: { value: ReaderFont; label: string; className: string }[] = [
  { value: "literata", label: "Literata", className: "font-serif" },
  { value: "source-serif", label: "Source Serif", className: "font-serif-alt" },
  { value: "sans", label: "Sans", className: "font-sans" },
];

export const WIDTH_OPTIONS: { value: ReaderWidth; label: string; maxWidth: number }[] = [
  { value: "narrow", label: "Narrow", maxWidth: 640 },
  { value: "normal", label: "Normal", maxWidth: 860 },
  { value: "wide", label: "Wide", maxWidth: 1320 },
];

export const PAPER_OPTIONS: { value: ReaderPaper; label: string; className: string }[] = [
  { value: "white", label: "White", className: "bg-white" },
  { value: "cream", label: "Cream", className: "bg-[#faf3e6]" },
  { value: "sepia", label: "Sepia", className: "bg-[#f0e4cc]" },
];

export function loadReaderSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_READER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READER_SETTINGS;
    return { ...DEFAULT_READER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
