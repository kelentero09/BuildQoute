import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, TINY_PNG } from "./helpers";

/** Browser tests of the real pages: guest flow, validation, uploads, accounts, responsive layouts. */

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1366, height: 900 },
] as const;

async function fillBasics(page: Page) {
  await page.getByLabel("Project name").fill("Kitchen Renovation");
  await page.getByLabel("Client name").fill("Ana Reyes");
}

/** Clicks the first visible "Download PDF" button and returns the downloaded bytes. */
async function downloadPdf(page: Page): Promise<{ name: string; bytes: Buffer }> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).first().click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: readFileSync(path) };
}

for (const viewport of VIEWPORTS) {
  test.describe(`guest flow — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("create a quotation, preview it and download the PDF without an account", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Professional Construction Quotations in Minutes." })).toBeVisible();
      await page.getByRole("link", { name: /Create Quotation — Free/ }).click();

      await fillBasics(page);
      const first = page.locator("ol > li").first();
      await first.getByRole("textbox", { name: /description/ }).fill("Painting Works");
      await first.getByLabel("Amount (₱)").fill("25,000");
      await page.getByRole("button", { name: "Add item" }).click();
      const second = page.locator("ol > li").nth(1);
      await second.getByRole("textbox", { name: /description/ }).fill("Electrical Installation");
      await second.getByLabel("Amount (₱)").fill("15000");

      // The example from the brief: 25,000 + 15,000 = 40,000.
      await expect(page.getByText("₱40,000.00").first()).toBeVisible();

      // No horizontal scrolling at this width.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      // Preview: beside the form on desktop, full screen on smaller devices.
      if (viewport.width < 1024) await page.getByRole("button", { name: "Preview" }).click();
      await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
      const size = await page.locator("canvas").first().boundingBox();
      expect(size!.width).toBeGreaterThan(250);
      expect(size!.height / size!.width).toBeCloseTo(1.414, 1); // A4 proportions

      const pdf = await downloadPdf(page);
      expect(pdf.name).toMatch(/^BQ-\d{8}-[A-Z0-9]{4} - Kitchen Renovation\.pdf$/);
      expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.bytes.length).toBeGreaterThan(10_000);
    });
  });
}

test.describe("builder", () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test("required fields and invalid prices block the download with clear messages", async ({ page }) => {
    await page.goto("/");
    let downloads = 0;
    page.on("download", () => downloads++);

    await page.getByRole("button", { name: "Download PDF" }).first().click();
    await expect(page.getByText("Project name is required.").first()).toBeVisible();
    await expect(page.getByText("Client name is required.").first()).toBeVisible();
    await expect(page.getByText("Add at least one item.").first()).toBeVisible();

    await fillBasics(page);
    const row = page.locator("ol > li").first();
    await row.getByRole("textbox", { name: /description/ }).fill("Flooring");
    await row.getByLabel("Amount (₱)").fill("-500");
    await expect(page.getByText(/"Flooring" has an invalid amount/)).toBeVisible();
    await row.getByLabel("Amount (₱)").fill("12abc");
    await expect(page.getByText(/"Flooring" has an invalid amount/)).toBeVisible();

    await page.getByRole("button", { name: "detailed" }).click();
    await row.getByLabel("Unit price (₱)").fill("100");
    await row.getByLabel("Qty").fill("two");
    await expect(page.getByText(/"Flooring" has an invalid amount/)).toBeVisible();
    await row.getByLabel("Qty").fill("2");
    await expect(page.getByText("Please fix the following first:")).toHaveCount(0);
    expect(downloads).toBe(0);
  });

  test("edit, duplicate, reorder and delete items; totals and discounts update", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "detailed" }).click();
    const rows = page.locator("ol > li");
    await rows.nth(0).getByRole("textbox", { name: /description/ }).fill("Tiles");
    await rows.nth(0).getByLabel("Qty").fill("12.5");
    await rows.nth(0).getByLabel("Unit price (₱)").fill("850.75");
    await expect(rows.nth(0).locator("output")).toHaveText("₱10,634.38");

    await page.getByRole("button", { name: "Duplicate Item 1" }).click();
    await expect(rows).toHaveCount(2);
    await rows.nth(1).getByRole("textbox", { name: /description/ }).fill("Labor");
    await rows.nth(1).getByLabel("Qty").fill("3");
    await rows.nth(1).getByLabel("Unit price (₱)").fill("1200");
    await expect(page.getByText("₱14,234.38").first()).toBeVisible();

    await page.getByRole("button", { name: "Move Item 2 up" }).click();
    await expect(rows.nth(0).getByRole("textbox", { name: /description/ })).toHaveValue("Labor");

    await page.getByLabel("Discount type").selectOption("percent");
    await page.locator("#discount").fill("10");
    await expect(page.getByText("− ₱1,423.44")).toBeVisible();
    await expect(page.getByText("₱12,810.94").first()).toBeVisible();

    await page.getByLabel("Discount type").selectOption("fixed");
    await page.locator("#discount").fill("234.38");
    await expect(page.getByText("₱14,000.00").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete Item 1" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).getByRole("textbox", { name: /description/ })).toHaveValue("Tiles");
  });

  test("switching between Simple and Detailed keeps what was entered", async ({ page }) => {
    await page.goto("/");
    const row = page.locator("ol > li").first();
    await row.getByRole("textbox", { name: /description/ }).fill("Painting Works");
    await row.getByLabel("Amount (₱)").fill("25000");

    await page.getByRole("button", { name: "detailed" }).click();
    await expect(row.getByRole("textbox", { name: /description/ })).toHaveValue("Painting Works");
    await expect(row.getByLabel("Unit price (₱)")).toHaveValue("25000");
    await row.getByLabel("Qty").fill("2");
    await row.getByLabel("Unit", { exact: true }).fill("lot");

    await page.getByRole("button", { name: "simple" }).click();
    await expect(row.getByLabel("Amount (₱)")).toHaveValue("50000");
    await page.getByRole("button", { name: "detailed" }).click();
    await expect(row.getByLabel("Qty")).toHaveValue("2");
    await expect(row.getByLabel("Unit", { exact: true })).toHaveValue("lot");
  });

  test("the draft survives a reload and is described as stored on this device only", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Draft saved on this device only.")).toBeVisible();
    await fillBasics(page);
    const reference = await page.getByText(/^Reference BQ-/).textContent();
    await page.waitForTimeout(700); // autosave delay
    await page.reload();
    await expect(page.getByLabel("Project name")).toHaveValue("Kitchen Renovation");
    await expect(page.getByText(reference!)).toBeVisible();
  });

  test("very long descriptions are capped and still produce a PDF", async ({ page }) => {
    await page.goto("/");
    await fillBasics(page);
    const row = page.locator("ol > li").first();
    await row.getByRole("textbox", { name: /description/ }).fill("Supply and installation ".repeat(60) + "W".repeat(300));
    const value = await row.getByRole("textbox", { name: /description/ }).inputValue();
    expect(value.length).toBe(500);
    await row.getByLabel("Amount (₱)").fill("1000");
    await expect(page.locator("aside canvas").first()).toBeVisible({ timeout: 30_000 });
    const pdf = await downloadPdf(page);
    expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("logo and signature uploads: valid images accepted, bad files refused, signature is opt-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Branding & signature/ }).click();
    const include = page.getByLabel("Include Signature in PDF");
    await expect(include).not.toBeChecked();
    await expect(include).toBeDisabled();

    const inputs = page.locator("input[type=file]");
    await inputs.nth(0).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.getByAltText("Company logo preview")).toBeVisible();

    // Wrong format.
    await inputs.nth(1).setInputFiles({ name: "sig.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(page.getByText("Please choose a PNG, JPG or WebP image.")).toBeVisible();
    // Right extension and type, but not actually an image.
    await inputs.nth(1).setInputFiles({ name: "sig.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
    await expect(page.getByText("That file does not look like a valid PNG, JPG or WebP image.")).toBeVisible();
    // Too large.
    await inputs.nth(1).setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([TINY_PNG, Buffer.alloc(5 * 1024 * 1024)]) });
    await expect(page.getByText(/larger than 5 MB/)).toBeVisible();
    await expect(include).toBeDisabled();

    await inputs.nth(1).setInputFiles({ name: "sig.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.getByAltText("Signature preview")).toBeVisible();
    await expect(include).toBeEnabled();
    await expect(include).not.toBeChecked(); // uploading never switches it on
    await include.check();

    // The choice is not remembered: after a reload the signature is off again.
    await page.waitForTimeout(700);
    await page.reload();
    await page.getByRole("button", { name: /Branding & signature/ }).click();
    await expect(page.getByAltText("Signature preview")).toBeVisible();
    await expect(page.getByLabel("Include Signature in PDF")).not.toBeChecked();
  });

  test("user-entered HTML is shown as text, never executed", async ({ page }) => {
    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs++;
      void dialog.dismiss();
    });
    await page.goto("/");
    const payload = `<img src=x onerror=alert(1)>"><script>alert(2)</script>`;
    await page.getByLabel("Project name").fill(payload);
    await page.getByLabel("Client name").fill(payload);
    await page.locator("ol > li").first().getByRole("textbox", { name: /description/ }).fill(payload);
    await page.locator("ol > li").first().getByLabel("Amount (₱)").fill("100");
    await expect(page.locator("aside canvas").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByLabel("Project name")).toHaveValue(payload);
    expect(await page.locator("img[src='x']").count()).toBe(0);
    expect(dialogs).toBe(0);
  });
});

test.describe("pages and access", () => {
  test("legal pages exist and unknown pages show not found", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
    await page.goto("/nope");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("guests cannot see the admin dashboard or settings", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText("Website traffic")).toHaveCount(0);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("registered user", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1366, height: 900 } });
  const email = "ui-user@example.com";

  test("register, save, reopen, duplicate and delete a quotation; settings feed the builder", async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());

    await page.goto("/register");
    await page.getByLabel("Name").fill("Uma Ibarra");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/at least 10 characters/).first()).toBeVisible();
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    // Straight to the builder: no dashboard, just Settings and Log out.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByText("Saved quotations (0)")).toBeVisible();

    // Settings: company, signature and preferences.
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByLabel("Company name").fill("Ibarra Construction");
    await page.getByLabel("Signatory name").fill("Engr. Uma Ibarra");
    await page.locator("input[type=file]").nth(1).setInputFiles({ name: "sig.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.getByAltText("Signature preview")).toBeVisible();
    await page.getByLabel("Default PDF template").selectOption("corporate");
    await page.getByLabel("Quotation validity (days)").fill("15");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.").last()).toBeVisible();

    // Builder picks up the account details; the saved signature stays off until ticked.
    await page.getByRole("link", { name: "BuildQuote home" }).click();
    await expect(page.getByText("Ibarra Construction")).toBeVisible();
    await expect(page.getByLabel("Include Signature in PDF")).toBeEnabled();
    await expect(page.getByLabel("Include Signature in PDF")).not.toBeChecked();
    await expect(page.locator("input[name=template][value=corporate]")).toBeChecked();

    // Save.
    await fillBasics(page);
    const row = page.locator("ol > li").first();
    await row.getByRole("textbox", { name: /description/ }).fill("Cabinets");
    await row.getByLabel("Amount (₱)").fill("43750");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Quotation saved to your account.")).toBeVisible();
    await expect(page.getByText("Saved quotations (1)")).toBeVisible();
    await expect(page.getByText("All changes saved to your account.")).toBeVisible();

    // Edit and save again: still one quotation.
    await page.getByLabel("Project name").fill("Kitchen Renovation Phase 2");
    await expect(page.getByText("Unsaved changes.")).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("All changes saved to your account.")).toBeVisible();
    await expect(page.getByText("Saved quotations (1)")).toBeVisible();

    // New, then load the saved one back.
    await page.getByRole("button", { name: "New quotation" }).click();
    await expect(page.getByLabel("Project name")).toHaveValue("");
    await page.getByText("Saved quotations (1)").click();
    await page.getByRole("button", { name: "Open Kitchen Renovation Phase 2" }).click();
    await expect(page.getByLabel("Project name")).toHaveValue("Kitchen Renovation Phase 2");
    await expect(page.locator("ol > li").first().getByLabel("Amount (₱)")).toHaveValue("43750");

    // Duplicate gets a new reference number and is a separate quotation once saved.
    const original = await page.getByText(/^Reference BQ-/).textContent();
    await page.getByRole("button", { name: "Duplicate Kitchen Renovation Phase 2" }).click();
    await expect(page.getByText(/Copy created/)).toBeVisible();
    expect(await page.getByText(/^Reference BQ-/).textContent()).not.toBe(original);
    await page.getByLabel("Project name").fill("Kitchen Copy");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved quotations (2)")).toBeVisible();

    // Delete the copy.
    await page.getByRole("button", { name: "Delete Kitchen Copy" }).click();
    await expect(page.getByText("Saved quotations (1)")).toBeVisible();

    // A normal user sees "not found" at /admin.
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("log out clears the screen; log in brings the saved quotation back", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Saved quotations (1)")).toBeVisible();
    await page.getByText("Saved quotations (1)").click();
    await page.getByRole("button", { name: "Open Kitchen Renovation Phase 2" }).click();
    await expect(page.getByLabel("Client name")).toHaveValue("Ana Reyes");

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Project name")).toHaveValue("");
    await expect(page.getByText(/Saved quotations/)).toHaveCount(0);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
  });
});
