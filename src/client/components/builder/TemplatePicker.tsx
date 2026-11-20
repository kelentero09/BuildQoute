import { TEMPLATES, type TemplateId } from "../../../shared/types";
import { cx } from "../ui";

interface Props {
  value: TemplateId;
  onChange: (template: TemplateId) => void;
}

const swatch: Record<TemplateId, string> = {
  modern: "bg-[#1e3a5f]",
  minimalist: "bg-black",
  corporate: "bg-[#c2410c]",
};

export function TemplatePicker({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">PDF template</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEMPLATES.map((template) => (
          <label
            key={template.id}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              value === template.id ? "border-accent bg-surface" : "border-line hover:bg-surface",
            )}
          >
            <input
              type="radio"
              name="template"
              value={template.id}
              checked={value === template.id}
              onChange={() => onChange(template.id)}
              className="sr-only"
            />
            <span className={cx("mt-1 h-3 w-3 shrink-0 rounded-full", swatch[template.id])} aria-hidden />
            <span>
              <span className="block text-sm font-medium text-ink">{template.name}</span>
              <span className="block text-xs text-muted">{template.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
