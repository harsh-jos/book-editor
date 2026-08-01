export function deriveTitleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.pdf$/i, "");
  const spaced = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!spaced) return "Untitled";
  if (/[a-z]/.test(spaced) && !/[A-Z]/.test(spaced)) {
    return spaced
      .split(" ")
      .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
      .join(" ");
  }
  return spaced;
}

export function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k words`;
  }
  return `${count} words`;
}

export function estimateReadingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 220));
}
