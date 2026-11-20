import { newQuotation } from "../../shared/quotation";
import type { Branding, Quotation } from "../../shared/types";

/**
 * Guest persistence. Everything here stays in this browser only.
 * The "include signature" choice is deliberately never stored: it must be
 * ticked again for every quotation.
 */

const DRAFT_KEY = "bq:draft:v1";
const BRANDING_KEY = "bq:branding:v1";

export const EMPTY_BRANDING: Branding = {
  companyName: "",
  companyAddress: "",
  contactNumber: "",
  signatoryName: "",
  signatoryPosition: "",
  logo: null,
  signature: null,
};

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused the write (private mode, quota full). */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function loadDraft(): Quotation | null {
  const stored = read<unknown>(DRAFT_KEY);
  if (!isObject(stored) || !Array.isArray(stored.items) || typeof stored.number !== "string") return null;
  // Merge over a fresh quotation so drafts saved by an older version still have every field.
  return { ...newQuotation(), ...(stored as Partial<Quotation>) } as Quotation;
}

export function saveDraft(quotation: Quotation): boolean {
  return write(DRAFT_KEY, quotation);
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function loadLocalBranding(): Branding {
  const stored = read<unknown>(BRANDING_KEY);
  return isObject(stored) ? { ...EMPTY_BRANDING, ...(stored as Partial<Branding>) } : EMPTY_BRANDING;
}

export function saveLocalBranding(branding: Branding): boolean {
  return write(BRANDING_KEY, branding);
}
