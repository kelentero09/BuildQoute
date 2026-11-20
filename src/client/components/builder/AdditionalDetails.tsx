import type { Quotation } from "../../../shared/types";
import { Collapsible, TextAreaField, TextField } from "../ui";

interface Props {
  quotation: Quotation;
  onChange: (patch: Partial<Quotation>) => void;
}

export function AdditionalDetails({ quotation, onChange }: Props) {
  const hasContent = Boolean(
    quotation.paymentTerms || quotation.duration || quotation.scopeNotes || quotation.exclusions || quotation.remarks,
  );
  return (
    <Collapsible
      title="Additional details"
      description="Optional — payment terms, duration, scope and exclusions"
      defaultOpen={hasContent}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField
          label="Payment terms"
          value={quotation.paymentTerms}
          maxLength={2000}
          placeholder="50% down payment, 40% progress billing, 10% upon completion"
          onChange={(event) => onChange({ paymentTerms: event.target.value })}
        />
        <div className="space-y-4">
          <TextField
            label="Project duration"
            value={quotation.duration}
            maxLength={150}
            placeholder="45 working days"
            onChange={(event) => onChange({ duration: event.target.value })}
          />
        </div>
        <TextAreaField
          label="Scope notes"
          value={quotation.scopeNotes}
          maxLength={2000}
          onChange={(event) => onChange({ scopeNotes: event.target.value })}
        />
        <TextAreaField
          label="Exclusions"
          value={quotation.exclusions}
          maxLength={2000}
          onChange={(event) => onChange({ exclusions: event.target.value })}
        />
        <TextAreaField
          className="sm:col-span-2"
          label="Additional remarks"
          value={quotation.remarks}
          maxLength={2000}
          onChange={(event) => onChange({ remarks: event.target.value })}
        />
      </div>
    </Collapsible>
  );
}
