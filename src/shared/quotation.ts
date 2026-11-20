import { lineTotal, parseMoney, parsePercent, parseQuantity, percentOf, centavosToInput } from "./money";
import type { ItemMode, Quotation, QuoteItem, TemplateId } from "./types";

export interface ComputedItem {
  id: string;
  description: string;
  quantityMilli: number | null;
  unit: string;
  unitPrice: number | null;
  /** Centavos; 0 when the inputs are empty or invalid. */
  amount: number;
  valid: boolean;
}

export interface Totals {
  items: ComputedItem[];
  subtotal: number;
  discount: number;
  /** Basis points when the discount is a percentage, otherwise null. */
  discountPercentBp: number | null;
  total: number;
}

export function computeItem(item: QuoteItem, mode: ItemMode): ComputedItem {
  if (mode === "simple") {
    const amount = parseMoney(item.amount);
    return {
      id: item.id,
      description: item.description,
      quantityMilli: null,
      unit: "",
      unitPrice: null,
      amount: amount ?? 0,
      valid: amount !== null,
    };
  }
  const qty = parseQuantity(item.quantity);
  const price = parseMoney(item.unitPrice);
  const valid = qty !== null && price !== null;
  return {
    id: item.id,
    description: item.description,
    quantityMilli: qty,
    unit: item.unit,
    unitPrice: price,
    amount: valid ? lineTotal(qty, price) : 0,
    valid,
  };
}

export function computeTotals(q: Pick<Quotation, "items" | "mode" | "discountType" | "discountValue">): Totals {
  const items = q.items.map((item) => computeItem(item, q.mode));
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  let discount = 0;
  let discountPercentBp: number | null = null;
  if (q.discountValue.trim() !== "") {
    if (q.discountType === "percent") {
      const bp = parsePercent(q.discountValue);
      if (bp !== null) {
        discountPercentBp = bp;
        discount = percentOf(subtotal, bp);
      }
    } else {
      discount = parseMoney(q.discountValue) ?? 0;
    }
  }
  discount = Math.min(discount, subtotal);
  return { items, subtotal, discount, discountPercentBp, total: subtotal - discount };
}

/**
 * Carry values across when the user switches mode so nothing typed is lost.
 * Simple -> Detailed: an amount with no matching qty x price becomes 1 x amount.
 * Detailed -> Simple: the amount becomes the computed line total.
 */
export function convertItems(items: QuoteItem[], to: ItemMode): QuoteItem[] {
  return items.map((item) => {
    if (to === "detailed") {
      const amount = parseMoney(item.amount);
      if (amount === null) return item;
      const detailed = computeItem(item, "detailed");
      if (detailed.valid && detailed.amount === amount) return item;
      return { ...item, quantity: "1", unitPrice: centavosToInput(amount) };
    }
    const detailed = computeItem(item, "detailed");
    return detailed.valid ? { ...item, amount: centavosToInput(detailed.amount) } : item;
  });
}

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyItem(): QuoteItem {
  return { id: newId(), description: "", amount: "", quantity: "1", unit: "", unitPrice: "" };
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d + days);
  return todayIso(date);
}

/** Reference such as BQ-20261120-7K3F. Random suffix avoids confusable characters. */
export function generateQuotationNumber(now = new Date()): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `BQ-${todayIso(now).replaceAll("-", "")}-${suffix}`;
}

export function newQuotation(template: TemplateId = "modern", validityDays = 30): Quotation {
  const date = todayIso();
  return {
    number: generateQuotationNumber(),
    projectName: "",
    clientName: "",
    location: "",
    date,
    validUntil: addDaysIso(date, validityDays),
    mode: "simple",
    items: [emptyItem()],
    discountType: "fixed",
    discountValue: "",
    paymentTerms: "",
    duration: "",
    scopeNotes: "",
    exclusions: "",
    remarks: "",
    template,
  };
}

/** "2026-11-20" -> "November 20, 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export interface QuotationIssue {
  field: string;
  message: string;
}

/** Checks that block PDF generation or saving. Rows left completely blank are ignored. */
export function validateQuotation(q: Quotation): QuotationIssue[] {
  const issues: QuotationIssue[] = [];
  if (!q.projectName.trim()) issues.push({ field: "projectName", message: "Project name is required." });
  if (!q.clientName.trim()) issues.push({ field: "clientName", message: "Client name is required." });

  const filled = q.items.filter((item) => !isBlankItem(item, q.mode));
  if (filled.length === 0) issues.push({ field: "items", message: "Add at least one item." });
  filled.forEach((item) => {
    const computed = computeItem(item, q.mode);
    if (!item.description.trim()) issues.push({ field: `item:${item.id}`, message: "An item is missing a description." });
    else if (!computed.valid) {
      issues.push({ field: `item:${item.id}`, message: `"${truncate(item.description, 40)}" has an invalid amount.` });
    }
  });

  if (q.discountValue.trim() !== "") {
    const ok = q.discountType === "percent" ? parsePercent(q.discountValue) !== null : parseMoney(q.discountValue) !== null;
    if (!ok) issues.push({ field: "discount", message: "Discount is not a valid number." });
  }
  if (q.validUntil && q.date && q.validUntil < q.date) {
    issues.push({ field: "validUntil", message: "Valid-until date is before the quotation date." });
  }
  return issues;
}

export function isBlankItem(item: QuoteItem, mode: ItemMode): boolean {
  if (item.description.trim()) return false;
  return mode === "simple" ? !item.amount.trim() : !item.unitPrice.trim();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
