import type { BookParagraph, ExtractedPage, PageLine } from "./types";

const PAGE_NUMBER_RE = /^[ivxlcdm]+$|^\d{1,4}$|^[-–—]?\s*\d{1,4}\s*[-–—]?$/i;
const INDENT_THRESHOLD = 8;
const GAP_MULTIPLIER = 1.45;

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z#]+/g, " ")
    .trim();
}

/** Detects lines that repeat across many pages (running headers/footers) and strips them. */
function stripRunningBoilerplate(pages: ExtractedPage[]): ExtractedPage[] {
  if (pages.length < 6) return pages;

  const frequency = new Map<string, number>();
  for (const page of pages) {
    const candidates = new Set<string>();
    const first = page.lines[0];
    const last = page.lines[page.lines.length - 1];
    const secondLast = page.lines[page.lines.length - 2];
    if (first) candidates.add(normalizeForCompare(first.text));
    if (last) candidates.add(normalizeForCompare(last.text));
    if (secondLast) candidates.add(normalizeForCompare(secondLast.text));
    for (const c of candidates) {
      if (!c) continue;
      frequency.set(c, (frequency.get(c) ?? 0) + 1);
    }
  }

  const threshold = Math.max(4, Math.floor(pages.length * 0.3));
  const boilerplate = new Set(
    [...frequency.entries()].filter(([, count]) => count >= threshold).map(([k]) => k)
  );

  if (boilerplate.size === 0) return pages;

  return pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => !boilerplate.has(normalizeForCompare(line.text))),
  }));
}

/** Removes lines that are just a lone page number. */
function stripPageNumbers(pages: ExtractedPage[]): ExtractedPage[] {
  return pages.map((page) => ({
    ...page,
    lines: page.lines.filter((line) => !PAGE_NUMBER_RE.test(line.text.trim())),
  }));
}

interface MergedLine {
  x: number;
  /** y of the first physical line in this merge — compared against the previous line's yEnd. */
  y: number;
  /** y of the last physical line in this merge — becomes the next comparison's prevY. */
  yEnd: number;
  text: string;
  joinNext: boolean;
}

/**
 * Merges words that were hyphenated across a line break, e.g. "beauti-" + "ful" -> "beautiful".
 * A merge can span multiple physical lines, so each merged line tracks both its starting y
 * (yEnd of the line before it) and ending y (used as the next line's reference point) —
 * collapsing them into a single y would make the vertical gap either side of the merge look
 * doubled, which would be misread as a paragraph break by the gap heuristic below.
 */
function dehyphenate(lines: PageLine[]): MergedLine[] {
  const merged: MergedLine[] = [];

  for (const line of lines) {
    const trimmed = line.text.replace(/\s+$/, "");
    const previous = merged[merged.length - 1];

    if (previous?.joinNext) {
      previous.text = previous.text.replace(/-$/, "") + trimmed.replace(/^\s+/, "");
      previous.joinNext = /[a-z]-$/.test(trimmed);
      previous.yEnd = line.y;
      continue;
    }

    merged.push({
      x: line.x,
      y: line.y,
      yEnd: line.y,
      text: trimmed,
      joinNext: /[a-z]-$/.test(trimmed),
    });
  }

  return merged;
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 0;
  let bestCount = -1;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = v;
    }
  }
  return best;
}

/**
 * Reconstructs paragraphs using left-margin indentation and vertical gaps as paragraph-break
 * cues, tagging each paragraph with the source PDF page its first line came from — this is what
 * lets the reader show a sense of the original page boundaries.
 */
function buildParagraphs(pages: ExtractedPage[]): BookParagraph[] {
  const mergedByPage = pages.map((p) => dehyphenate(p.lines));
  const allLines = mergedByPage.flat();
  if (allLines.length === 0) return [];

  const bodyX = mostCommon(allLines.map((l) => Math.round(l.x / 2) * 2));

  const paragraphs: BookParagraph[] = [];
  let current = "";
  let currentPage = pages[0]?.pageNum ?? 1;
  let currentY = 0;
  let prevYEnd: number | null = null;
  let typicalGap = 0;

  pages.forEach((page, pageIndex) => {
    // Typical single-line gap is measured on the raw, pre-merge lines: a merged line can span
    // several physical lines, which would skew the gap statistic if measured post-merge.
    const gaps: number[] = [];
    for (let i = 1; i < page.lines.length; i++) {
      const gap = Math.abs(page.lines[i - 1].y - page.lines[i].y);
      if (gap > 0 && gap < 60) gaps.push(Math.round(gap));
    }
    typicalGap = gaps.length ? mostCommon(gaps) : typicalGap;
    prevYEnd = null;

    for (const line of mergedByPage[pageIndex]) {
      const text = collapseSpaces(line.text);
      if (!text) continue;

      const isIndented = line.x - bodyX > INDENT_THRESHOLD;
      const gapFromPrev = prevYEnd === null ? 0 : Math.abs(prevYEnd - line.y);
      const isBigGap = typicalGap > 0 && gapFromPrev > typicalGap * GAP_MULTIPLIER;
      prevYEnd = line.yEnd;

      const startsNewParagraph = current === "" || isIndented || isBigGap;

      if (startsNewParagraph && current) {
        paragraphs.push({ text: current, page: currentPage, y: currentY });
        current = text;
        currentPage = page.pageNum;
        currentY = line.y;
      } else if (!current) {
        current = text;
        currentPage = page.pageNum;
        currentY = line.y;
      } else {
        current += " " + text;
      }
    }
  });

  if (current) paragraphs.push({ text: current, page: currentPage, y: currentY });

  return paragraphs.filter((p) => p.text.length > 1);
}

export function cleanExtractedPages(pages: ExtractedPage[]): BookParagraph[] {
  const withoutBoilerplate = stripRunningBoilerplate(pages);
  const withoutPageNumbers = stripPageNumbers(withoutBoilerplate);
  return buildParagraphs(withoutPageNumbers);
}

export function countWords(paragraphs: BookParagraph[]): number {
  return paragraphs.reduce((sum, p) => sum + p.text.split(/\s+/).filter(Boolean).length, 0);
}
