import { describe, expect, it } from "vitest";
import {
  centavosToInput,
  formatAmount,
  formatPeso,
  formatQuantity,
  lineTotal,
  parseMoney,
  parsePercent,
  parseQuantity,
  percentOf,
} from "../../src/shared/money";

describe("parseMoney", () => {
  it("parses whole and decimal amounts into centavos", () => {
    expect(parseMoney("25000")).toBe(2_500_000);
    expect(parseMoney("25,000.50")).toBe(2_500_050);
    expect(parseMoney("₱ 1,234.5")).toBe(123_450);
    expect(parseMoney(".75")).toBe(75);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("10.")).toBe(1000);
  });

  it("rejects invalid prices", () => {
    for (const bad of ["", "  ", "abc", "-5", "1.234", "1e5", "12..3", "1,2,3.4.5", "+5", "NaN", "Infinity", "0x10"]) {
      expect(parseMoney(bad), bad).toBeNull();
    }
  });

  it("rejects amounts beyond the supported range", () => {
    expect(parseMoney("99999999999.99")).toBe(9_999_999_999_999);
    expect(parseMoney("100000000000")).toBeNull();
    expect(parseMoney("9".repeat(40))).toBeNull();
  });
});

describe("parseQuantity and parsePercent", () => {
  it("parses quantities to thousandths", () => {
    expect(parseQuantity("2.5")).toBe(2500);
    expect(parseQuantity("1")).toBe(1000);
    expect(parseQuantity("0.125")).toBe(125);
  });

  it("rejects invalid quantities", () => {
    for (const bad of ["", "-1", "1.2345", "two", "1000000"]) expect(parseQuantity(bad), bad).toBeNull();
  });

  it("limits percentages to 0–100", () => {
    expect(parsePercent("12.5")).toBe(1250);
    expect(parsePercent("100")).toBe(10000);
    expect(parsePercent("100.01")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("arithmetic", () => {
  it("avoids floating point drift", () => {
    // 0.1 + 0.2 style cases: 3 x 0.10 must be exactly 0.30
    expect(lineTotal(parseQuantity("3")!, parseMoney("0.10")!)).toBe(30);
    // 1.15 x 100.35 = 115.4025 -> 115.40
    expect(lineTotal(parseQuantity("1.15")!, parseMoney("100.35")!)).toBe(11540);
    // 19.99 x 3 = 59.97
    expect(lineTotal(3000, 1999)).toBe(5997);
  });

  it("rounds half up to the nearest centavo", () => {
    // 0.5 x 0.01 = 0.005 -> 0.01
    expect(lineTotal(500, 1)).toBe(1);
    // 0.333 x 1.00 = 0.333 -> 0.33
    expect(lineTotal(333, 100)).toBe(33);
  });

  it("stays exact for very large products", () => {
    expect(lineTotal(999_999_999, 9_999_999_999_999)).toBe(Number((999_999_999n * 9_999_999_999_999n + 500n) / 1000n));
  });

  it("computes percentages", () => {
    expect(percentOf(4_000_000, 1000)).toBe(400_000); // 10% of 40,000.00
    expect(percentOf(999, 3333)).toBe(333); // 33.33% of 9.99 = 3.329667 -> 3.33
  });
});

describe("formatting", () => {
  it("formats Philippine peso amounts", () => {
    expect(formatPeso(2_500_000)).toBe("₱25,000.00");
    expect(formatPeso(4_000_050)).toBe("₱40,000.50");
    expect(formatPeso(5)).toBe("₱0.05");
    expect(formatPeso(0)).toBe("₱0.00");
    expect(formatPeso(123_456_789_012)).toBe("₱1,234,567,890.12");
    expect(formatPeso(-150)).toBe("-₱1.50");
    expect(formatAmount(100_000)).toBe("1,000.00");
  });

  it("formats quantities and editable values", () => {
    expect(formatQuantity(2500)).toBe("2.5");
    expect(formatQuantity(1000)).toBe("1");
    expect(formatQuantity(1_234_125)).toBe("1,234.125");
    expect(centavosToInput(2_500_000)).toBe("25000");
    expect(centavosToInput(2_500_050)).toBe("25000.50");
    expect(centavosToInput(5)).toBe("0.05");
  });
});
