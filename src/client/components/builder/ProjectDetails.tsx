import type { Quotation } from "../../../shared/types";
import { Section, TextField } from "../ui";

interface Props {
  quotation: Quotation;
  errors: Record<string, string>;
  onChange: (patch: Partial<Quotation>) => void;
}

export function ProjectDetails({ quotation, errors, onChange }: Props) {
  return (
    <Section title="Project details" description={`Reference ${quotation.number}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Project name"
          required
          value={quotation.projectName}
          maxLength={150}
          placeholder="Two-storey residential renovation"
          error={errors.projectName}
          onChange={(event) => onChange({ projectName: event.target.value })}
        />
        <TextField
          label="Client name"
          required
          value={quotation.clientName}
          maxLength={150}
          placeholder="Juan Dela Cruz"
          error={errors.clientName}
          onChange={(event) => onChange({ clientName: event.target.value })}
        />
        <TextField
          className="sm:col-span-2"
          label="Project location"
          value={quotation.location}
          maxLength={200}
          placeholder="Quezon City, Metro Manila"
          onChange={(event) => onChange({ location: event.target.value })}
        />
        <TextField
          label="Quotation date"
          type="date"
          value={quotation.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
        <TextField
          label="Valid until"
          type="date"
          value={quotation.validUntil}
          min={quotation.date || undefined}
          error={errors.validUntil}
          onChange={(event) => onChange({ validUntil: event.target.value })}
        />
      </div>
    </Section>
  );
}
