import { describe, expect, it } from "vitest";
import { ImageError, MAX_UPLOAD_BYTES, checkImageFile, fitWithin, sniffImageType } from "../../src/client/lib/images";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const SVG = new TextEncoder().encode("<svg onload=alert(1)>");

describe("sniffImageType", () => {
  it("recognises PNG, JPEG and WebP by content", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("rejects other content", () => {
    expect(sniffImageType(GIF)).toBeNull();
    expect(sniffImageType(SVG)).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});

describe("checkImageFile", () => {
  it("accepts valid images", () => {
    expect(() => checkImageFile({ type: "image/png", size: 1000 }, PNG)).not.toThrow();
    expect(() => checkImageFile({ type: "image/jpeg", size: 1000 }, JPEG)).not.toThrow();
    expect(() => checkImageFile({ type: "image/webp", size: 1000 }, WEBP)).not.toThrow();
  });

  it("rejects unsupported formats", () => {
    expect(() => checkImageFile({ type: "image/gif", size: 1000 }, GIF)).toThrow(ImageError);
    expect(() => checkImageFile({ type: "image/svg+xml", size: 1000 }, SVG)).toThrow(ImageError);
    expect(() => checkImageFile({ type: "application/pdf", size: 1000 }, PNG)).toThrow(ImageError);
  });

  it("rejects oversized images", () => {
    expect(() => checkImageFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }, PNG)).toThrow(/5 MB/);
  });

  it("rejects files whose content does not match an image, whatever the declared type", () => {
    expect(() => checkImageFile({ type: "image/png", size: 1000 }, SVG)).toThrow(ImageError);
    expect(() => checkImageFile({ type: "image/jpeg", size: 0 }, new Uint8Array())).toThrow(ImageError);
  });
});

describe("fitWithin", () => {
  it("scales large images down and keeps the aspect ratio", () => {
    expect(fitWithin(2400, 1200, 600)).toEqual({ width: 600, height: 300 });
    expect(fitWithin(1000, 4000, 600)).toEqual({ width: 150, height: 600 });
  });

  it("does not enlarge small images", () => {
    expect(fitWithin(200, 100, 600)).toEqual({ width: 200, height: 100 });
  });
});
