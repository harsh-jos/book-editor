import "server-only";
import { createHash } from "node:crypto";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy, PageViewport } from "pdfjs-dist";

type PDFOperatorList = Awaited<ReturnType<PDFPageProxy["getOperatorList"]>>;
import { cleanExtractedPages, countWords } from "@/lib/textClean";
import type { BookImage, BookParagraph, ExtractedPage, PageLine } from "@/lib/types";

const IMAGE_RENDER_SCALE = 2;
const COVER_TARGET_WIDTH = 480;
const MIN_FIGURE_SIZE = 60;
const REPEAT_IMAGE_THRESHOLD_RATIO = 0.25;
const REPEAT_IMAGE_MIN_COUNT = 3;

type Matrix = [number, number, number, number, number, number];

interface CanvasAndContext {
  canvas: Canvas;
  context: SKRSContext2D;
}

/**
 * Lets pdf.js render into @napi-rs/canvas instead of a browser <canvas>. pdf.js instantiates this
 * itself (`new CanvasFactory(options)`) for its own internal use, so the constructor just needs to
 * tolerate whatever options object it's passed.
 */
class NodeCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }
  reset(canvasAndContext: CanvasAndContext, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: Partial<CanvasAndContext>) {
    canvasAndContext.canvas = undefined;
    canvasAndContext.context = undefined;
  }
}

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

interface RawTextItem {
  str: string;
  hasEOL?: boolean;
  transform: number[];
}

function isTextItem(item: unknown): item is RawTextItem {
  return typeof item === "object" && item !== null && "str" in item && "transform" in item;
}

async function extractLines(page: PDFPageProxy): Promise<PageLine[]> {
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
  return lines;
}

interface FigureBox {
  /** PDF-space y (origin bottom-left) of the image's top edge — comparable to BookParagraph.y. */
  pdfY: number;
  pixel: { x: number; y: number; width: number; height: number };
}

/**
 * Walks the page's content stream tracking the transform stack (save/restore/cm) to find where
 * each embedded image lands. An image XObject always paints into the unit square of whatever
 * transform is active, so its corners in PDF space (and, composed with the viewport, in canvas
 * pixel space) come from mapping (0,0)-(1,1) through the accumulated matrix — the same geometry
 * pdf.js's own renderer uses internally.
 */
function computeFigureBoxes(
  opList: PDFOperatorList,
  viewport: PageViewport,
  OPS: typeof pdfjsLib.OPS
): FigureBox[] {
  const stack: Matrix[] = [];
  let current: Matrix = [1, 0, 0, 1, 0, 0];
  const boxes: FigureBox[] = [];
  const viewportMatrix = viewport.transform as Matrix;

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];

    if (fn === OPS.save) {
      stack.push(current);
    } else if (fn === OPS.restore) {
      current = stack.pop() ?? current;
    } else if (fn === OPS.transform) {
      current = multiply(current, opList.argsArray[i] as Matrix);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const pdfCorners = [
        applyToPoint(current, 0, 0),
        applyToPoint(current, 1, 0),
        applyToPoint(current, 0, 1),
        applyToPoint(current, 1, 1),
      ];
      const pdfY = Math.max(...pdfCorners.map((c) => c[1]));

      const pixelMatrix = multiply(viewportMatrix, current);
      const pixelCorners = [
        applyToPoint(pixelMatrix, 0, 0),
        applyToPoint(pixelMatrix, 1, 0),
        applyToPoint(pixelMatrix, 0, 1),
        applyToPoint(pixelMatrix, 1, 1),
      ];
      const x0 = Math.min(...pixelCorners.map((c) => c[0]));
      const x1 = Math.max(...pixelCorners.map((c) => c[0]));
      const y0 = Math.min(...pixelCorners.map((c) => c[1]));
      const y1 = Math.max(...pixelCorners.map((c) => c[1]));

      boxes.push({
        pdfY,
        pixel: { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) },
      });
    }
  }

  return boxes;
}

function makeCover(pageCanvas: Canvas, targetWidth: number): string {
  const scale = targetWidth / pageCanvas.width;
  const width = Math.round(pageCanvas.width * scale);
  const height = Math.round(pageCanvas.height * scale);
  const coverCanvas = createCanvas(width, height);
  const ctx = coverCanvas.getContext("2d");
  ctx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, 0, 0, width, height);
  return `data:image/jpeg;base64,${coverCanvas.toBuffer("image/jpeg", 0.8).toString("base64")}`;
}

interface RawFigure {
  page: number;
  y: number;
  width: number;
  height: number;
  buffer: Buffer;
}

/** Drops recurring images (logos/watermarks printed on many pages) the same way running headers are stripped. */
function dedupeAndFilterFigures(raw: RawFigure[]): BookImage[] {
  const withHash = raw.map((r) => ({
    ...r,
    hash: createHash("sha1").update(r.buffer).digest("hex"),
  }));

  const hashCounts = new Map<string, number>();
  for (const r of withHash) hashCounts.set(r.hash, (hashCounts.get(r.hash) ?? 0) + 1);

  const pagesSeen = new Set(raw.map((r) => r.page)).size;
  const repeatThreshold = Math.max(
    REPEAT_IMAGE_MIN_COUNT,
    Math.ceil(pagesSeen * REPEAT_IMAGE_THRESHOLD_RATIO)
  );

  return withHash
    .filter((r) => (hashCounts.get(r.hash) ?? 0) < repeatThreshold)
    .map((r) => ({
      page: r.page,
      y: r.y,
      width: r.width,
      height: r.height,
      dataUrl: `data:image/jpeg;base64,${r.buffer.toString("base64")}`,
    }));
}

export interface ProcessedBook {
  pageCount: number;
  wordCount: number;
  cover: string;
  paragraphs: BookParagraph[];
  images: BookImage[];
}

export async function processPdfBuffer(buffer: Buffer): Promise<ProcessedBook> {
  // Separate from the `CanvasFactory` class handed to getDocument below (which pdf.js
  // instantiates itself internally) — this instance is what we call .create() on directly
  // for each page's render target and figure crops.
  const canvasFactory = new NodeCanvasFactory();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    CanvasFactory: NodeCanvasFactory,
  }).promise;

  const OPS = pdfjsLib.OPS;
  const pageCount = pdf.numPages;
  const extractedPages: ExtractedPage[] = [];
  const rawFigures: RawFigure[] = [];
  let cover = "";

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    extractedPages.push({ pageNum, lines: await extractLines(page) });

    const opList = await page.getOperatorList();
    const hasImages = opList.fnArray.some(
      (fn) => fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject
    );

    // Rendering a full page is the expensive part — skip it for the (usual) text-only page.
    if (pageNum === 1 || hasImages) {
      const viewport = page.getViewport({ scale: IMAGE_RENDER_SCALE });
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
      // pdf.js's DOM-oriented types don't know about @napi-rs/canvas, but it implements the same
      // 2D canvas surface pdf.js actually calls into — the cast is safe for what render() uses.
      await page.render({
        canvasContext: canvasAndContext.context as unknown as CanvasRenderingContext2D,
        canvas: canvasAndContext.canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      if (pageNum === 1) {
        cover = makeCover(canvasAndContext.canvas, COVER_TARGET_WIDTH);
      }

      if (hasImages) {
        for (const box of computeFigureBoxes(opList, viewport, OPS)) {
          const x = Math.max(0, box.pixel.x);
          const y = Math.max(0, box.pixel.y);
          const width = Math.min(canvasAndContext.canvas.width - x, box.pixel.width);
          const height = Math.min(canvasAndContext.canvas.height - y, box.pixel.height);
          if (width < MIN_FIGURE_SIZE || height < MIN_FIGURE_SIZE) continue;

          const cropCanvas = createCanvas(width, height);
          const cropCtx = cropCanvas.getContext("2d");
          cropCtx.drawImage(canvasAndContext.canvas, x, y, width, height, 0, 0, width, height);
          rawFigures.push({
            page: pageNum,
            y: box.pdfY,
            width,
            height,
            buffer: cropCanvas.toBuffer("image/jpeg", 0.82),
          });
        }
      }

      canvasFactory.destroy(canvasAndContext);
    }

    page.cleanup();
  }

  const paragraphs = cleanExtractedPages(extractedPages);
  const wordCount = countWords(paragraphs);
  const images = dedupeAndFilterFigures(rawFigures);

  return { pageCount, wordCount, cover, paragraphs, images };
}
