import { useId, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { ACCEPT_ATTR, ImageError, processImage } from "../../lib/images";
import { Button } from "../ui";

interface Props {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

/** Upload control for a logo or signature. Shows a preview and validates before accepting. */
export function ImageUpload({ label, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await processImage(file));
    } catch (cause) {
      setError(cause instanceof ImageError ? cause.message : "That image could not be used.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface">
          {value ? (
            <img src={value} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            aria-describedby={`${id}-hint`}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            {busy ? "Processing…" : value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove
            </Button>
          )}
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
        PNG, JPG or WebP, up to 5 MB.
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
