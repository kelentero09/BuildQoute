import type { TemplateId } from "../../shared/types";

/** Visual differences between the three templates. Layout is shared in QuotationDocument. */
export interface Theme {
  header: "split" | "minimal" | "band";
  text: string;
  muted: string;
  rule: string;
  accent: string;
  /** Small section labels ("CLIENT", "PAYMENT TERMS"). */
  label: string;
  tableHeadBg: string | null;
  tableHeadText: string;
  tableHeadRule: string | null;
  zebra: string | null;
  totalBg: string | null;
  totalText: string;
  titleWeight: 400 | 600 | 700;
}

export const THEMES: Record<TemplateId, Theme> = {
  modern: {
    header: "split",
    text: "#0f172a",
    muted: "#64748b",
    rule: "#e2e8f0",
    accent: "#1e3a5f",
    label: "#1e3a5f",
    tableHeadBg: "#eef2f7",
    tableHeadText: "#1e3a5f",
    tableHeadRule: null,
    zebra: null,
    totalBg: "#1e3a5f",
    totalText: "#ffffff",
    titleWeight: 700,
  },
  minimalist: {
    header: "minimal",
    text: "#111111",
    muted: "#6b6b6b",
    rule: "#d4d4d4",
    accent: "#111111",
    label: "#6b6b6b",
    tableHeadBg: null,
    tableHeadText: "#111111",
    tableHeadRule: "#111111",
    zebra: null,
    totalBg: null,
    totalText: "#111111",
    titleWeight: 400,
  },
  corporate: {
    header: "band",
    text: "#111827",
    muted: "#4b5563",
    rule: "#d1d5db",
    accent: "#c2410c",
    label: "#c2410c",
    tableHeadBg: "#1f2937",
    tableHeadText: "#ffffff",
    tableHeadRule: null,
    zebra: "#f3f4f6",
    totalBg: "#1f2937",
    totalText: "#ffffff",
    titleWeight: 700,
  },
};
