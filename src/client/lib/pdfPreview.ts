/**
 * Renders a generated PDF to canvases with pdf.js, so the preview is the real
 * document on every device (mobile browsers cannot show PDFs inside a page).
 * Loaded lazily, only when a preview is shown.
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PREVIEW_PAGES = 30;

export async function renderPdfToCanvases(blob: Blob, cssWidth: number): Promise<HTMLCanvasElement[]> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const canvases: HTMLCanvasElement[] = [];
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pageCount = Math.min(doc.numPages, MAX_PREVIEW_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Quotation preview, page ${pageNumber} of ${doc.numPages}`);
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) throw new Error("Canvas is not available");
      await page.render({ canvas, canvasContext, viewport }).promise;
      canvases.push(canvas);
    }
    return canvases;
  } finally {
    void task.destroy();
  }
}
