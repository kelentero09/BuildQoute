/**
 * Decimal-safe money helpers. All monetary values are integer centavos.
 * Quantities are integers in thousandths (3 decimal places).
 * Percentages are integers in basis points (2 decimal places).
 */

export const MAX_CENTAVOS = 99_999_999_999_99; // ₱99,999,999,999.99
export const MAX_QTY_MILLI = 999_999_999; // 999,999.999

/** Parse a user-entered decimal string into a scaled integer. Returns null if invalid. */
function parseScaled(input: string, decimals: number, max: number): number | null {
  const cleaned = input.replace(/[,\s₱]/g, "");
  if (cleaned === "") return null;
  const pattern = new RegExp(`^\\d{1,15}(\\.\\d{0,${decimals}})?$|^\\.\\d{1,${decimals}}$`);
  if (!pattern.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  const scaled = Number((whole || "0") + frac.padEnd(decimals, "0"));
  if (!Number.isSafeInteger(scaled) || scaled > max) return null;
  return scaled;
}

/** "25,000.50" -> 2500050. Null for empty, negative, malformed or out-of-range input. */
export function parseMoney(input: string): number | null {
  return parseScaled(input, 2, MAX_CENTAVOS);
}

/** "2.5" -> 2500. Null for empty, negative, malformed or out-of-range input. */
export function parseQuantity(input: string): number | null {
  return parseScaled(input, 3, MAX_QTY_MILLI);
}

/** "12.5" (percent) -> 1250 basis points. Null if invalid or above 100%. */
export function parsePercent(input: string): number | null {
  return parseScaled(input, 2, 100_00);
}

/** Rounded (half-up) integer division using BigInt so large products stay exact. */
function mulDivRound(a: number, b: number, divisor: number): number {
  const product = BigInt(a) * BigInt(b);
  const d = BigInt(divisor);
  return Number((product + d / 2n) / d);
}

/** Line total in centavos for a quantity (thousandths) and unit price (centavos). */
export function lineTotal(qtyMilli: number, unitPriceCentavos: number): number {
  return mulDivRound(qtyMilli, unitPriceCentavos, 1000);
}

/** Percentage of an amount, with the percentage given in basis points. */
export function percentOf(amountCentavos: number, basisPoints: number): number {
  return mulDivRound(amountCentavos, basisPoints, 100_00);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 2500050 -> "25,000.50" */
export function formatAmount(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(centavos));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${groupThousands(String(whole))}.${frac}`;
}

/** 2500050 -> "₱25,000.50" */
export function formatPeso(centavos: number): string {
  const text = formatAmount(centavos);
  return text.startsWith("-") ? `-₱${text.slice(1)}` : `₱${text}`;
}

/** Centavos -> plain editable string, e.g. 2500050 -> "25000.50", 2500000 -> "25000". */
export function centavosToInput(centavos: number): string {
  const whole = Math.floor(centavos / 100);
  const frac = centavos % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

/** Quantity in thousandths -> shortest display string, e.g. 2500 -> "2.5". */
export function formatQuantity(qtyMilli: number): string {
  const whole = Math.floor(qtyMilli / 1000);
  const frac = String(qtyMilli % 1000).padStart(3, "0").replace(/0+$/, "");
  const wholeText = groupThousands(String(whole));
  return frac ? `${wholeText}.${frac}` : wholeText;
}
