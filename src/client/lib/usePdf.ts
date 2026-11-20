import { useEffect, useRef, useState } from "react";
import type { PdfData } from "../pdf";

export type PdfStatus = "idle" | "working" | "ready" | "error";

/** Generate a PDF blob. The PDF library is fetched on first use. */
export async function generatePdf(data: PdfData): Promise<Blob> {
  const { renderPdf } = await import("../pdf");
  return renderPdf(data);
}

/**
 * Keeps a PDF blob in step with the form, regenerating shortly after the user stops typing.
 * `enabled` lets callers skip the work while no preview is visible.
 */
export function useLivePdf(data: PdfData, enabled: boolean, delayMs = 500): { blob: Blob | null; status: PdfStatus } {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<PdfStatus>("idle");
  const run = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const id = ++run.current;
    setStatus("working");
    const timer = window.setTimeout(() => {
      generatePdf(data)
        .then((result) => {
          if (run.current !== id) return;
          setBlob(result);
          setStatus("ready");
        })
        .catch(() => {
          if (run.current === id) setStatus("error");
        });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [data, enabled, delayMs]);

  return { blob, status };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function pdfFileName(number: string, projectName: string): string {
  const safe = projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return safe ? `${number} - ${safe}.pdf` : `${number}.pdf`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Print a PDF blob. Desktop browsers print from a hidden frame; where that is not
 * supported (most phones) the PDF opens in a new tab so the system print dialog can be used.
 */
export function printBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const release = () => window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse) {
    window.open(url, "_blank", "noopener");
    release();
    return;
  }
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
    release();
    window.setTimeout(() => frame.remove(), 5 * 60_000);
  };
  document.body.appendChild(frame);
}
