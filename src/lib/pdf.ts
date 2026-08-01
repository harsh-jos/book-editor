import { loadPdfjs } from "./pdfjs";
import type { ExtractedPage, PageLine } from "./types";
import type { PDFDocumentProxy } from "pdfjs-dist";

export interface ExtractResult {
  pages: ExtractedPage[];
  pageCount: number;
  cover: string;
}

interface RawTextItem {
  str: string;
  hasEOL?: boolean;
  transform: number[];
}

function isTextItem(item: unknown): item is RawTextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

export async function extractPdf(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<ExtractResult> {
  const pdfjsLib = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = pdf.numPages;
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lines: PageLine[] = [];

    let currentX: number | null = null;
    let currentY: number | null = null;
    let currentText = "";

    for (const item of textContent.items) {
      if (!isTextItem(item)) continue;
      if (currentX === null) {
        currentX = item.transform[4];
        currentY = item.transform[5];
      }
      currentText += item.str;
      if (item.hasEOL) {
        lines.push({ x: currentX ?? 0, y: currentY ?? 0, text: currentText });
        currentX = null;
        currentY = null;
        currentText = "";
      }
    }
    if (currentText.trim()) {
      lines.push({ x: currentX ?? 0, y: currentY ?? 0, text: currentText });
    }

    pages.push({ pageNum, lines });
    onProgress?.(pageNum, pageCount);

    if (pageNum < pageCount) {
      page.cleanup();
    }
  }

  const cover = await renderCover(pdf);

  return { pages, pageCount, cover };
}

async function renderCover(pdf: PDFDocumentProxy): Promise<string> {
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 480;
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return "";
  }
}
