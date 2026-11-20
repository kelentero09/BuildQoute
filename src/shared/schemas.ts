import { z } from "zod";

/** Validation shared by the browser and the Worker. Lengths match the form's maxLength values. */

const text = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const templateSchema = z.enum(["modern", "minimalist", "corporate"]);

export const quoteItemSchema = z.object({
  id: z.string().min(1).max(64),
  description: text(500),
  amount: text(30),
  quantity: text(30),
  unit: text(20),
  unitPrice: text(30),
});

export const quotationSchema = z.object({
  number: z.string().regex(/^[A-Za-z0-9-]{4,40}$/),
  projectName: text(150),
  clientName: text(150),
  location: text(200),
  date: isoDate.or(z.literal("")),
  validUntil: isoDate.or(z.literal("")),
  mode: z.enum(["simple", "detailed"]),
  items: z.array(quoteItemSchema).min(1).max(200),
  discountType: z.enum(["fixed", "percent"]),
  discountValue: text(30),
  paymentTerms: text(2000),
  duration: text(150),
  scopeNotes: text(2000),
  exclusions: text(2000),
  remarks: text(2000),
  template: templateSchema,
});

export const preferencesSchema = z.object({
  defaultTemplate: templateSchema,
  validityDays: z.number().int().min(1).max(365),
});

export const settingsSchema = z.object({
  companyName: text(150),
  companyAddress: text(300),
  contactNumber: text(150),
  signatoryName: text(100),
  signatoryPosition: text(100),
  preferences: preferencesSchema,
});

export const eventSchema = z.object({
  type: z.enum(["page_view", "pdf_download", "quote_started"]),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type EventType = z.infer<typeof eventSchema>["type"];

/** Limits enforced by the Worker. */
export const LIMITS = {
  quotationsPerUser: 500,
  quotationBodyBytes: 256 * 1024,
  assetBytes: 600 * 1024,
} as const;
