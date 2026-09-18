export { cn } from "cn";

import type { TextSegment } from "@/types";

const PDF_WORKER_SRC = "/pdf.worker.min.mjs";

// Words per stored segment. Segments are the retrieval unit for the voice
// assistant, so they need to be small enough to send a few to the model but
// large enough to carry a complete thought.
const WORDS_PER_SEGMENT = 200;

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * Loads pdfjs-dist on demand and points it at the worker served from /public.
 * The module is imported dynamically so it never ends up in a server bundle.
 */
const loadPdfJs = async (): Promise<PdfJs> => {
  if (typeof window === "undefined") {
    throw new Error("parsePDFFile can only run in the browser");
  }

  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      return pdfjs;
    });
  }

  return pdfjsPromise;
};

const toSegments = (text: string, pageNumber: number, startIndex: number): TextSegment[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const segments: TextSegment[] = [];

  for (let offset = 0; offset < words.length; offset += WORDS_PER_SEGMENT) {
    const chunk = words.slice(offset, offset + WORDS_PER_SEGMENT);

    segments.push({
      text: chunk.join(" "),
      segmentIndex: startIndex + segments.length,
      pageNumber,
      wordCount: chunk.length,
    });
  }

  return segments;
};

/**
 * Extracts text (segmented per page) from a PDF and renders page 1 to a PNG
 * data URL so it can be used as a fallback cover image.
 */
export const parsePDFFile = async (
  file: File,
): Promise<{ content: TextSegment[]; cover: string; numPages: number }> => {
  const pdfjs = await loadPdfJs();

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  const numPages = pdf.numPages;
  const content: TextSegment[] = [];

  for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      content.push(...toSegments(pageText, pageNumber, content.length));
    }
  }

  // Render the first page as the fallback cover.
  const firstPage = await pdf.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1.5 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create a canvas context to render the cover");
  }

  await firstPage.render({ canvas, canvasContext: context, viewport }).promise;

  const cover = canvas.toDataURL("image/png");

  await loadingTask.destroy();

  return { content, cover, numPages };
};

