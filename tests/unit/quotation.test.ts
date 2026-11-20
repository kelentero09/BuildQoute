import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  computeTotals,
  convertItems,
  emptyItem,
  formatDate,
  generateQuotationNumber,
  newQuotation,
  validateQuotation,
} from "../../src/shared/quotation";
import type { Quotation, QuoteItem } from "../../src/shared/types";

function item(patch: Partial<QuoteItem>): QuoteItem {
  return { ...emptyItem(), ...patch };
}

function quote(patch: Partial<Quotation>): Quotation {
  return { ...newQuotation(), projectName: "House", clientName: "Juan", ...patch };
}

describe("computeTotals", () => {
  it("adds simple-mode amounts (the example from the brief)", () => {
    const totals = computeTotals(
      quote({
        items: [item({ description: "Painting Works", amount: "25,000" }), item({ description: "Electrical Installation", amount: "15000" })],
      }),
    );
    expect(totals.subtotal).toBe(4_000_000);
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(4_000_000);
  });

  it("multiplies quantity by unit price in detailed mode", () => {
    const totals = computeTotals(
      quote({
        mode: "detailed",
        items: [
          item({ description: "Tiles", quantity: "12.5", unit: "sq.m", unitPrice: "850.75" }),
          item({ description: "Labor", quantity: "3", unit: "day", unitPrice: "1200" }),
        ],
      }),
    );
    expect(totals.items[0]?.amount).toBe(1_063_438); // 12.5 x 850.75 = 10,634.375 -> 10,634.38
    expect(totals.items[1]?.amount).toBe(360_000);
    expect(totals.total).toBe(1_423_438);
  });

  it("applies a fixed discount", () => {
    const totals = computeTotals(quote({ items: [item({ description: "A", amount: "1000" })], discountType: "fixed", discountValue: "150.50" }));
    expect(totals.discount).toBe(15_050);
    expect(totals.total).toBe(84_950);
  });

  it("applies a percentage discount", () => {
    const totals = computeTotals(quote({ items: [item({ description: "A", amount: "40000" })], discountType: "percent", discountValue: "7.5" }));
    expect(totals.discountPercentBp).toBe(750);
    expect(totals.discount).toBe(300_000);
    expect(totals.total).toBe(3_700_000);
  });

  it("never lets a discount exceed the subtotal", () => {
    const totals = computeTotals(quote({ items: [item({ description: "A", amount: "100" })], discountValue: "500" }));
    expect(totals.discount).toBe(10_000);
    expect(totals.total).toBe(0);
  });

  it("treats invalid rows as zero and does not add tax", () => {
    const totals = computeTotals(quote({ items: [item({ description: "A", amount: "abc" }), item({ description: "B", amount: "100" })] }));
    expect(totals.items[0]?.valid).toBe(false);
    expect(totals.total).toBe(10_000);
  });
});

describe("convertItems", () => {
  it("keeps amounts when switching simple -> detailed", () => {
    const [converted] = convertItems([item({ description: "Paint", amount: "25000", quantity: "1", unitPrice: "" })], "detailed");
    expect(converted).toMatchObject({ quantity: "1", unitPrice: "25000", amount: "25000" });
  });

  it("keeps quantity and unit price when the amount already matches", () => {
    const source = item({ description: "Tiles", amount: "2000", quantity: "4", unit: "pc", unitPrice: "500" });
    expect(convertItems([source], "detailed")[0]).toEqual(source);
  });

  it("carries the computed line total when switching detailed -> simple", () => {
    const [converted] = convertItems([item({ description: "Tiles", quantity: "4", unit: "pc", unitPrice: "500.25" })], "simple");
    expect(converted?.amount).toBe("2001");
    expect(converted?.quantity).toBe("4");
  });

  it("round-trips without changing the total", () => {
    const items = [item({ description: "A", quantity: "2.5", unitPrice: "199.99" }), item({ description: "B", quantity: "1", unitPrice: "50" })];
    const detailed = computeTotals(quote({ mode: "detailed", items })).total;
    const simple = convertItems(items, "simple");
    expect(computeTotals(quote({ mode: "simple", items: simple })).total).toBe(detailed);
    expect(computeTotals(quote({ mode: "detailed", items: convertItems(simple, "detailed") })).total).toBe(detailed);
  });
});

describe("validateQuotation", () => {
  const fields = (q: Quotation) => validateQuotation(q).map((issue) => issue.field);

  it("accepts a complete quotation", () => {
    expect(validateQuotation(quote({ items: [item({ description: "A", amount: "100" })] }))).toEqual([]);
  });

  it("requires project name and client name", () => {
    const result = fields(quote({ projectName: " ", clientName: "", items: [item({ description: "A", amount: "1" })] }));
    expect(result).toContain("projectName");
    expect(result).toContain("clientName");
  });

  it("requires at least one filled item and ignores blank rows", () => {
    expect(fields(quote({ items: [emptyItem()] }))).toContain("items");
    expect(validateQuotation(quote({ items: [item({ description: "A", amount: "1" }), emptyItem()] }))).toEqual([]);
  });

  it("flags invalid prices and quantities", () => {
    const bad = item({ description: "A", amount: "-5" });
    expect(fields(quote({ items: [bad] }))).toContain(`item:${bad.id}`);
    const badQty = item({ description: "A", quantity: "x", unitPrice: "10" });
    expect(fields(quote({ mode: "detailed", items: [badQty] }))).toContain(`item:${badQty.id}`);
  });

  it("flags an amount with no description", () => {
    const orphan = item({ description: "", amount: "100" });
    expect(fields(quote({ items: [orphan] }))).toContain(`item:${orphan.id}`);
  });

  it("flags an invalid discount and a validity date before the quotation date", () => {
    const base = { items: [item({ description: "A", amount: "100" })] };
    expect(fields(quote({ ...base, discountValue: "abc" }))).toContain("discount");
    expect(fields(quote({ ...base, discountType: "percent", discountValue: "150" }))).toContain("discount");
    expect(fields(quote({ ...base, date: "2026-11-20", validUntil: "2026-11-01" }))).toContain("validUntil");
  });
});

describe("helpers", () => {
  it("generates a dated reference number", () => {
    expect(generateQuotationNumber(new Date(2026, 10, 20))).toMatch(/^BQ-20261120-[2-9A-HJ-NP-Z]{4}$/);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2026-11-20", 30)).toBe("2026-12-20");
    expect(addDaysIso("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDaysIso("", 30)).toBe("");
  });

  it("formats dates for the PDF", () => {
    expect(formatDate("2026-11-20")).toBe("November 20, 2026");
    expect(formatDate("")).toBe("");
  });
});
