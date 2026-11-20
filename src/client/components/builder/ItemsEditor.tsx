import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { formatPeso } from "../../../shared/money";
import { computeItem, convertItems, emptyItem, newId } from "../../../shared/quotation";
import type { ItemMode, Quotation, QuoteItem } from "../../../shared/types";
import { Button, IconButton, Section, cx, inputClass } from "../ui";

interface Props {
  quotation: Quotation;
  errors: Record<string, string>;
  onChange: (patch: Partial<Quotation>) => void;
}

const UNIT_SUGGESTIONS = ["lot", "pc", "pcs", "set", "sq.m", "cu.m", "ln.m", "m", "kg", "bag", "day", "hr", "unit"];
export const MAX_ITEMS = 200;

const fieldLabel = "mb-1 block text-xs font-medium text-muted";
const numeric = "text-right tabular-nums";

export function ItemsEditor({ quotation, errors, onChange }: Props) {
  const { items, mode } = quotation;
  const detailed = mode === "detailed";

  const setItems = (next: QuoteItem[]) => onChange({ items: next });
  const update = (id: string, patch: Partial<QuoteItem>) =>
    setItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next.length ? next : [emptyItem()]);
  };
  const duplicate = (index: number) => {
    const source = items[index];
    if (!source || items.length >= MAX_ITEMS) return;
    setItems([...items.slice(0, index + 1), { ...source, id: newId() }, ...items.slice(index + 1)]);
  };
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    const a = items[index];
    const b = items[target];
    if (!a || !b) return;
    const next = [...items];
    next[index] = b;
    next[target] = a;
    setItems(next);
  };
  const switchMode = (to: ItemMode) => {
    if (to !== mode) onChange({ mode: to, items: convertItems(items, to) });
  };

  return (
    <Section
      title="Quotation items"
      action={
        <div role="group" aria-label="Item entry mode" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(["simple", "detailed"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                mode === option ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      }
    >
      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>

      {!detailed && (
        <div className="mb-2 hidden grid-cols-[1fr_10rem_9rem] gap-2 px-1 text-xs font-medium text-muted sm:grid" aria-hidden>
          <span>Description</span>
          <span className="text-right">Amount (₱)</span>
          <span />
        </div>
      )}

      <ol className="space-y-3">
        {items.map((item, index) => {
          const computed = computeItem(item, mode);
          const hasError = Boolean(errors[`item:${item.id}`]);
          const label = `Item ${index + 1}`;
          const bad = (invalid: boolean) => hasError && invalid && "border-danger";

          const description = (
            <label className={cx("block", detailed && "col-span-full")}>
              <span className={cx(fieldLabel, !detailed && "sm:sr-only")}>{label} description</span>
              <textarea
                rows={1}
                value={item.description}
                maxLength={500}
                placeholder={index === 0 ? "Painting works" : "Description"}
                aria-invalid={(hasError && !item.description.trim()) || undefined}
                onChange={(event) => update(item.id, { description: event.target.value })}
                className={cx(inputClass, "min-h-[2.5rem] resize-y", bad(!item.description.trim()))}
              />
            </label>
          );

          const actions = (
            <div className="flex items-center justify-end">
              <IconButton label={`Move ${label} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton label={`Move ${label} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton label={`Duplicate ${label}`} onClick={() => duplicate(index)}>
                <Copy className="h-4 w-4" aria-hidden />
              </IconButton>
              <IconButton label={`Delete ${label}`} className="hover:text-danger" onClick={() => remove(item.id)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </IconButton>
            </div>
          );

          if (!detailed) {
            return (
              <li
                key={item.id}
                className={cx(
                  "grid grid-cols-1 gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_10rem_9rem] sm:items-start sm:rounded-none sm:border-0 sm:p-0",
                  hasError && "border-danger",
                )}
              >
                {description}
                <label className="block">
                  <span className={cx(fieldLabel, "sm:sr-only")}>Amount (₱)</span>
                  <input
                    inputMode="decimal"
                    value={item.amount}
                    placeholder="0.00"
                    aria-invalid={(hasError && !computed.valid) || undefined}
                    onChange={(event) => update(item.id, { amount: event.target.value })}
                    className={cx(inputClass, numeric, bad(!computed.valid))}
                  />
                </label>
                {actions}
              </li>
            );
          }

          return (
            <li
              key={item.id}
              className={cx(
                "grid grid-cols-[1fr_1fr_1.4fr] gap-2 rounded-xl border border-line p-3 sm:grid-cols-[5rem_6rem_9rem_1fr]",
                hasError && "border-danger",
              )}
            >
              {description}
              <label className="block">
                <span className={fieldLabel}>Qty</span>
                <input
                  inputMode="decimal"
                  value={item.quantity}
                  placeholder="1"
                  aria-invalid={(hasError && computed.quantityMilli === null) || undefined}
                  onChange={(event) => update(item.id, { quantity: event.target.value })}
                  className={cx(inputClass, numeric, bad(computed.quantityMilli === null))}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Unit</span>
                <input
                  list="unit-suggestions"
                  value={item.unit}
                  maxLength={20}
                  placeholder="lot"
                  onChange={(event) => update(item.id, { unit: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Unit price (₱)</span>
                <input
                  inputMode="decimal"
                  value={item.unitPrice}
                  placeholder="0.00"
                  aria-invalid={(hasError && computed.unitPrice === null) || undefined}
                  onChange={(event) => update(item.id, { unitPrice: event.target.value })}
                  className={cx(inputClass, numeric, bad(computed.unitPrice === null))}
                />
              </label>
              <div className="col-span-full flex items-end justify-between gap-2 sm:col-span-1">
                <div className="min-w-0 sm:pl-2">
                  <span className={fieldLabel}>Amount</span>
                  <output className="block truncate py-2 text-sm font-medium tabular-nums text-ink">{formatPeso(computed.amount)}</output>
                </div>
                {actions}
              </div>
            </li>
          );
        })}
      </ol>

      {errors.items && <p className="mt-2 text-sm text-danger">{errors.items}</p>}

      <Button className="mt-4" onClick={() => setItems([...items, emptyItem()])} disabled={items.length >= MAX_ITEMS}>
        <Plus className="h-4 w-4" aria-hidden />
        Add item
      </Button>
    </Section>
  );
}
