export type ReaderFont = "literata" | "source-serif" | "sans";
export type ReaderWidth = "narrow" | "normal" | "wide";
export type ReaderPaper = "white" | "cream" | "sepia";

export interface ReaderSettings {
  font: ReaderFont;
  fontSize: number;
  lineHeight: number;
  width: ReaderWidth;
  paper: ReaderPaper;
}

export interface PageLine {
  x: number;
  y: number;
  text: string;
}

export interface ExtractedPage {
  pageNum: number;
  lines: PageLine[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  pageCount: number;
  wordCount: number;
  cover: string;
  paragraphs: string[];
  progress: number;
}

export interface BookSummary {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  pageCount: number;
  wordCount: number;
  cover: string;
  progress: number;
}
