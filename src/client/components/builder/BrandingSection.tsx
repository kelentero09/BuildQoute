import type { ReactNode } from "react";
import type { Branding } from "../../../shared/types";
import { Collapsible, TextAreaField, TextField } from "../ui";
import { ImageUpload } from "./ImageUpload";

interface Props {
  branding: Branding;
  includeSignature: boolean;
  onBrandingChange: (patch: Partial<Branding>) => void;
  onIncludeSignatureChange: (value: boolean) => void;
  /** Explains where the branding is kept (this device, or the user's account). */
  note: ReactNode;
}

export function BrandingSection({ branding, includeSignature, onBrandingChange, onIncludeSignatureChange, note }: Props) {
  return (
    <Collapsible title="Branding & signature" description="Optional — your company details, logo and signature">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Company name"
          value={branding.companyName}
          maxLength={150}
          onChange={(event) => onBrandingChange({ companyName: event.target.value })}
        />
        <TextField
          label="Contact information"
          value={branding.contactNumber}
          maxLength={150}
          placeholder="0917 123 4567 · hello@company.ph"
          onChange={(event) => onBrandingChange({ contactNumber: event.target.value })}
        />
        <TextAreaField
          className="sm:col-span-2"
          label="Company address"
          rows={2}
          value={branding.companyAddress}
          maxLength={300}
          onChange={(event) => onBrandingChange({ companyAddress: event.target.value })}
        />

        <ImageUpload label="Company logo" value={branding.logo} onChange={(logo) => onBrandingChange({ logo })} />
        <ImageUpload
          label="Signature"
          value={branding.signature}
          onChange={(signature) => {
            onBrandingChange({ signature });
            if (!signature) onIncludeSignatureChange(false);
          }}
        />

        <TextField
          label="Signatory name"
          value={branding.signatoryName}
          maxLength={100}
          onChange={(event) => onBrandingChange({ signatoryName: event.target.value })}
        />
        <TextField
          label="Position"
          value={branding.signatoryPosition}
          maxLength={100}
          placeholder="Project Engineer"
          onChange={(event) => onBrandingChange({ signatoryPosition: event.target.value })}
        />

        <label className="flex items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            checked={includeSignature}
            disabled={!branding.signature}
            onChange={(event) => onIncludeSignatureChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--color-accent)]"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Include Signature in PDF</span>
            <span className="block text-xs text-muted">
              {branding.signature
                ? "Off by default. Your signature is only added to a quotation when you tick this box."
                : "Upload a signature first."}
            </span>
          </span>
        </label>

        <p className="text-xs text-muted sm:col-span-2">{note}</p>
      </div>
    </Collapsible>
  );
}
