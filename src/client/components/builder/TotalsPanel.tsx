import { formatPeso } from "../../../shared/money";
import type { Totals } from "../../../shared/quotation";
import type { DiscountType, Quotation } from "../../../shared/types";
import { cx, inputClass } from "../ui";

interface Props {
  quotation: Quotation;
  totals: Totals;
  error?: string;
  onChange: (patch: Partial<Quotation>) => void;
}

export function TotalsPanel({ quotation, totals, error, onChange }: Props) {
  return (
    <div className="ml-auto w-full max-w-sm space-y-3 border-t border-line pt-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="tabular-nums text-ink">{formatPeso(totals.subtotal)}</span>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor="discount" className="text-muted">
            Discount <span className="text-slate-400">(optional)</span>
          </label>
          <div className="flex w-44 gap-1.5">
            <select
              aria-label="Discount type"
              value={quotation.discountType}
              onChange={(event) => onChange({ discountType: event.target.value as DiscountType })}
              className={cx(inputClass, "w-16 px-2")}
            >
              <option value="fixed">₱</option>
              <option value="percent">%</option>
            </select>
            <input
              id="discount"
              inputMode="decimal"
              value={quotation.discountValue}
              placeholder="0"
              aria-invalid={error ? true : undefined}
              onChange={(event) => onChange({ discountValue: event.target.value })}
              className={cx(inputClass, "text-right tabular-nums", error && "border-danger")}
            />
          </div>
        </div>
        {error && <p className="mt-1 text-right text-xs text-danger">{error}</p>}
        {totals.discount > 0 && (
          <p className="mt-1 text-right text-xs tabular-nums text-muted">− {formatPeso(totals.discount)}</p>
        )}
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-base font-semibold text-ink">Total</span>
        <span className="text-xl font-semibold tabular-nums text-ink">{formatPeso(totals.total)}</span>
      </div>
      <p className="text-right text-xs text-muted">No taxes are added automatically.</p>
    </div>
  );
}
