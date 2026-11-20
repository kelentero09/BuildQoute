/**
 * Entry point of the lazily loaded PDF chunk. Nothing outside this folder should
 * import @react-pdf/renderer directly, so the library stays out of the main bundle.
 */
import { Font, pdf } from "@react-pdf/renderer";
import { QuotationDocument, type PdfData } from "./QuotationDocument";

export type { PdfData };

let fontsRegistered = false;

function registerFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  // Inter is embedded because the built-in PDF fonts have no peso sign (₱).
  Font.register({
    family: "Inter",
    fonts: [
      { src: "/fonts/Inter_400Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Inter_500Medium.ttf", fontWeight: 500 },
      { src: "/fonts/Inter_600SemiBold.ttf", fontWeight: 600 },
      { src: "/fonts/Inter_700Bold.ttf", fontWeight: 700 },
    ],
  });
  // No automatic hyphenation; only very long unbroken strings are split so they cannot overflow.
  Font.registerHyphenationCallback((word) => (word.length > 24 ? (word.match(/.{1,12}/g) ?? [word]) : [word]));
}

export async function renderPdf(data: PdfData): Promise<Blob> {
  registerFonts();
  return pdf(<QuotationDocument {...data} />).toBlob();
}
