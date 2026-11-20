import { useId, useState } from "react";
import { ChevronDown, Copy, FolderOpen, Trash2 } from "lucide-react";
import { formatPeso } from "../../../shared/money";
import type { SavedQuotationSummary } from "../../../shared/types";
import { IconButton, cx } from "../ui";

interface Props {
  items: SavedQuotationSummary[];
  currentId?: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (item: SavedQuotationSummary) => void;
}

const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

/** Compact list of the user's saved quotations, shown inside the builder. */
export function SavedQuotations({ items, currentId, busy, onOpen, onDuplicate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="rounded-xl border border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">
          Saved quotations <span className="font-normal text-muted">({items.length})</span>
        </span>
        <ChevronDown className={cx("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div id={id} hidden={!open} className="border-t border-line">
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Nothing saved yet. Use “Save” to keep a quotation in your account.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className={cx("flex items-center gap-2 px-4 py-2.5", item.id === currentId && "bg-surface")}>
                <button type="button" disabled={busy} onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left disabled:opacity-50">
                  <span className="block truncate text-sm font-medium text-ink">
                    {item.projectName || "Untitled project"}
                    {item.id === currentId && <span className="ml-2 text-xs font-normal text-muted">(open)</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.clientName || "No client"} · {item.number} · {formatPeso(item.totalAmount)} · {dateFormat.format(item.updatedAt)}
                  </span>
                </button>
                <IconButton label={`Open ${item.projectName || item.number}`} disabled={busy} onClick={() => onOpen(item.id)}>
                  <FolderOpen className="h-4 w-4" aria-hidden />
                </IconButton>
                <IconButton label={`Duplicate ${item.projectName || item.number}`} disabled={busy} onClick={() => onDuplicate(item.id)}>
                  <Copy className="h-4 w-4" aria-hidden />
                </IconButton>
                <IconButton label={`Delete ${item.projectName || item.number}`} disabled={busy} className="hover:text-danger" onClick={() => onDelete(item)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
