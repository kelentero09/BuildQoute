export type ItemMode = "simple" | "detailed";
export type TemplateId = "modern" | "minimalist" | "corporate";
export type DiscountType = "fixed" | "percent";

/** Form values are kept as strings exactly as typed; parsing happens in calculations. */
export interface QuoteItem {
  id: string;
  description: string;
  /** Used in Simple mode. */
  amount: string;
  /** Used in Detailed mode. */
  quantity: string;
  unit: string;
  unitPrice: string;
}

export interface Quotation {
  /** Server id once saved to an account; absent for guest drafts. */
  id?: string;
  number: string;
  projectName: string;
  clientName: string;
  location: string;
  date: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD or ""
  mode: ItemMode;
  items: QuoteItem[];
  discountType: DiscountType;
  discountValue: string;
  paymentTerms: string;
  duration: string;
  scopeNotes: string;
  exclusions: string;
  remarks: string;
  template: TemplateId;
}

/** Company and signatory details printed on the PDF. */
export interface Branding {
  companyName: string;
  companyAddress: string;
  contactNumber: string;
  signatoryName: string;
  signatoryPosition: string;
  /** Data URLs (already validated and re-encoded in the browser). */
  logo: string | null;
  signature: string | null;
}

export interface Preferences {
  defaultTemplate: TemplateId;
  validityDays: number;
}

export interface SavedQuotationSummary {
  id: string;
  number: string;
  projectName: string;
  clientName: string;
  totalAmount: number;
  updatedAt: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  { id: "modern", name: "Modern Professional", description: "White with subtle navy accents" },
  { id: "minimalist", name: "Architectural Minimalist", description: "Elegant black and white" },
  { id: "corporate", name: "Corporate Construction", description: "Structured, strong typography" },
];

export const DEFAULT_PREFERENCES: Preferences = { defaultTemplate: "modern", validityDays: 30 };
