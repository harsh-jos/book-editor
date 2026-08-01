let loaded: Promise<typeof import("pdfjs-dist")> | null = null;

/** Lazily loads pdfjs-dist on the client only — the module touches browser globals
 * (DOMMatrix, canvas) at evaluation time, which breaks Next.js server prerendering
 * if imported statically. */
export function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (typeof window === "undefined") {
    throw new Error("pdfjs-dist can only be loaded in the browser");
  }
  if (!loaded) {
    loaded = import("pdfjs-dist").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjsLib;
    });
  }
  return loaded;
}
