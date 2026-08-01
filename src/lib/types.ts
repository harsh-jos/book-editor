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

export interface BookParagraph {
  text: string;
  /** Source PDF page this paragraph started on — used to show page boundaries in the reader. */
  page: number;
  /** PDF-space y of the paragraph's first line (origin bottom-left) — used to interleave figures. */
  y: number;
}

export interface BookImage {
  page: number;
  /** PDF-space y of the image's top edge (origin bottom-left) — used to interleave with paragraphs. */
  y: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  createdAt: number;
  pageCount: number;
  wordCount: number;
  cover: string;
  paragraphs: BookParagraph[];
  images: BookImage[];
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

export interface ProcessPdfResponse {
  pageCount: number;
  wordCount: number;
  cover: string;
  paragraphs: BookParagraph[];
  images: BookImage[];
}
