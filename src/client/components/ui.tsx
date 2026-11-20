import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "border border-line bg-white text-ink hover:bg-surface",
  ghost: "text-muted hover:bg-surface hover:text-ink",
  danger: "border border-line bg-white text-danger hover:bg-red-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        buttonStyles[variant],
        className,
      )}
      {...rest}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/** Square icon-only button with an accessible name and a touch-friendly hit area. */
export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-ink placeholder:text-slate-400 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-surface disabled:text-muted";

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

export function TextField({
  label,
  required,
  error,
  hint,
  className,
  ...rest
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className={cx(inputClass, error && "border-danger")}
        {...rest}
      />
      {(error || hint) && (
        <p id={`${id}-note`} className={cx("mt-1 text-xs", error ? "text-danger" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea id={id} rows={3} className={cx(inputClass, "resize-y")} {...rest} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Section({ title, description, children, action }: SectionProps) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

interface CollapsibleProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Collapsible({ title, description, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-t border-line">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 py-5 text-left"
        >
          <span>
            <span className="block text-base font-semibold text-ink">{title}</span>
            {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
          </span>
          <ChevronDown className={cx("h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h2>
      <div id={id} hidden={!open} className="pb-6">
        {children}
      </div>
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "info" && "border-line bg-surface text-muted",
        tone === "error" && "border-red-200 bg-red-50 text-danger",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </div>
  );
}
