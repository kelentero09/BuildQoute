import { useId, useState } from "react";

interface Point {
  day: string; // YYYY-MM-DD
  value: number;
}

interface Props {
  title: string;
  /** Unit shown in the tooltip and the table, e.g. "visitors". */
  unit: string;
  data: Point[];
}

const W = 560;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const label = (day: string) => shortDate.format(new Date(`${day}T00:00:00Z`));

/** Pick a "nice" axis maximum (1, 2, 5 x 10^n) at or above the largest value. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((multiple) => multiple * power >= value) ?? 10;
  return step * power;
}

/** Single-series daily line chart with a hover/keyboard readout and a table alternative. */
export function TrendChart({ title, unit, data }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const max = niceMax(Math.max(0, ...data.map((point) => point.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (data.length > 1 ? (index / (data.length - 1)) * innerW : innerW / 2);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;
  const path = data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const ticks = [0, max / 2, max];
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const current = active === null ? null : data[active];
  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter((index, position, list) => list.indexOf(index) === position);

  const pick = (clientX: number, rect: DOMRect) => {
    const ratio = (((clientX - rect.left) / rect.width) * W - PAD.left) / innerW;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  };

  return (
    <figure className="rounded-xl border border-line p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={titleId} className="text-sm font-semibold text-ink">
          {title}
        </span>
        <span className="text-xs tabular-nums text-muted" aria-live="polite">
          {current ? `${label(current.day)}: ${current.value.toLocaleString()} ${unit}` : `${total.toLocaleString()} in the last ${data.length} days`}
        </span>
      </figcaption>

      {total === 0 ? (
        <p className="flex h-[180px] items-center justify-center text-sm text-muted">No data recorded yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 w-full touch-none select-none"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerDown={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const from = active ?? data.length - 1;
            setActive(Math.max(0, Math.min(data.length - 1, from + (event.key === "ArrowLeft" ? -1 : 1))));
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick) + 3.5} textAnchor="end" fontSize={10} fill="#64748b">
                {tick.toLocaleString()}
              </text>
            </g>
          ))}
          {xLabels.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={H - 6}
              fontSize={10}
              fill="#64748b"
              textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
            >
              {label(data[index]!.day)}
            </text>
          ))}
          <path d={path} fill="none" stroke="#1e3a5f" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {current && active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth={1} />
              <circle cx={x(active)} cy={y(current.value)} r={4.5} fill="#1e3a5f" stroke="#ffffff" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none">View as table</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 text-right font-medium capitalize">{unit}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((point) => (
                <tr key={point.day} className="border-b border-line last:border-0">
                  <td className="py-1">{label(point.day)}</td>
                  <td className="py-1 text-right text-ink">{point.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
