import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { PdfStatus } from "../../lib/usePdf";

interface Props {
  blob: Blob | null;
  status: PdfStatus;
}

/** Shows the generated PDF as page images. */
export function PdfPreview({ blob, status }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const target = container.current;
    if (!blob || !target) return;
    let cancelled = false;
    import("../../lib/pdfPreview")
      .then(({ renderPdfToCanvases }) => renderPdfToCanvases(blob, Math.max(280, target.clientWidth)))
      .then((canvases) => {
        if (cancelled) return;
        canvases.forEach((canvas) => {
          canvas.className = "block rounded-sm bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12),0_8px_24px_rgba(15,23,42,0.06)]";
        });
        target.replaceChildren(...canvases);
        setFailed(false);
        setRendered(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const busy = status === "working" || (status === "ready" && !rendered);

  return (
    <div className="relative">
      <div ref={container} className="space-y-4" />
      {!rendered && !failed && status !== "error" && (
        <div className="flex aspect-[1/1.414] items-center justify-center rounded-sm bg-white text-sm text-muted shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Preparing preview…
        </div>
      )}
      {(failed || status === "error") && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
          The preview could not be generated. Please check your entries and try again.
        </p>
      )}
      {busy && rendered && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs text-muted shadow-sm">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Updating
        </span>
      )}
    </div>
  );
}
