import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DEFAULT_PREFERENCES, TEMPLATES, type Branding, type Preferences, type TemplateId } from "../../shared/types";
import { ApiError, changePassword, deleteAsset, getProfile, saveSettings, updateName, uploadAsset, type AssetKind } from "../lib/api";
import { useAuth } from "../lib/auth";
import { EMPTY_BRANDING } from "../lib/storage";
import { ImageUpload } from "../components/builder/ImageUpload";
import { Narrow } from "../components/layout";
import { Button, Notice, TextAreaField, TextField, inputClass } from "../components/ui";
import { MIN_PASSWORD_LENGTH } from "./AuthPages";

type Status = { tone: "success" | "error"; text: string } | null;

function message(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.";
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function SaveRow({ busy, status, label = "Save changes" }: { busy: boolean; status: Status; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="primary" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {label}
      </Button>
      {status && (
        <span role="status" className={status.tone === "error" ? "text-sm text-danger" : "text-sm text-emerald-700"}>
          {status.text}
        </span>
      )}
    </div>
  );
}

function AccountSection() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setStatus({ tone: "error", text: "Please enter your name." });
    setBusy(true);
    setStatus(null);
    try {
      await updateName(name.trim());
      await refresh();
      setStatus({ tone: "success", text: "Saved." });
    } catch (cause) {
      setStatus({ tone: "error", text: message(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group title="Account">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Email" type="email" value={user?.email ?? ""} disabled readOnly hint="Email cannot be changed yet." />
        </div>
        <SaveRow busy={busy} status={status} label="Save name" />
      </form>
      <PasswordForm />
    </Group>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) {
      return setStatus({ tone: "error", text: `Use a new password of at least ${MIN_PASSWORD_LENGTH} characters.` });
    }
    setBusy(true);
    setStatus(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setStatus({ tone: "success", text: "Password changed. Other devices have been signed out." });
    } catch (cause) {
      setStatus({ tone: "error", text: message(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 pt-4">
      <h3 className="text-sm font-semibold text-ink">Change password</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={128}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <SaveRow busy={busy} status={status} label="Change password" />
    </form>
  );
}

export function Settings() {
  const { user, loading } = useAuth();
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfile()
      .then((profile) => {
        if (cancelled) return;
        setBranding(profile.branding);
        setPreferences(profile.preferences);
        setReady(true);
      })
      .catch((cause) => !cancelled && setLoadError(message(cause)));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const patch = (change: Partial<Branding>) => setBranding((current) => ({ ...current, ...change }));

  /** Images are saved as soon as they are chosen or removed. */
  const changeImage = async (kind: AssetKind, dataUrl: string | null) => {
    const previous = branding[kind];
    setImageError("");
    patch({ [kind]: dataUrl });
    try {
      if (dataUrl) await uploadAsset(kind, dataUrl);
      else await deleteAsset(kind);
    } catch (cause) {
      patch({ [kind]: previous });
      setImageError(message(cause));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await saveSettings({
        companyName: branding.companyName,
        companyAddress: branding.companyAddress,
        contactNumber: branding.contactNumber,
        signatoryName: branding.signatoryName,
        signatoryPosition: branding.signatoryPosition,
        preferences,
      });
      setStatus({ tone: "success", text: "Saved." });
    } catch (cause) {
      setStatus({ tone: "error", text: message(cause) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Narrow>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-muted">These details are used on your quotations.</p>

      <div className="mt-8">
        <AccountSection />

        {loadError && <Notice tone="error">{loadError}</Notice>}
        {!ready && !loadError && <p className="border-t border-line py-8 text-sm text-muted">Loading your details…</p>}

        {ready && (
          <form onSubmit={(event) => void submit(event)}>
            <Group title="Company" description="Shown at the top of every quotation.">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Company name" maxLength={150} value={branding.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
                <TextField
                  label="Contact information"
                  maxLength={150}
                  placeholder="0917 123 4567 · hello@company.ph"
                  value={branding.contactNumber}
                  onChange={(e) => patch({ contactNumber: e.target.value })}
                />
              </div>
              <TextAreaField label="Address" rows={2} maxLength={300} value={branding.companyAddress} onChange={(e) => patch({ companyAddress: e.target.value })} />
              <ImageUpload label="Company logo" value={branding.logo} onChange={(value) => void changeImage("logo", value)} />
            </Group>

            <Group
              title="Signature"
              description="Stored privately. It is only added to a quotation when you tick “Include Signature in PDF” for that quotation."
            >
              <ImageUpload label="Signature" value={branding.signature} onChange={(value) => void changeImage("signature", value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Signatory name" maxLength={100} value={branding.signatoryName} onChange={(e) => patch({ signatoryName: e.target.value })} />
                <TextField
                  label="Position"
                  maxLength={100}
                  placeholder="Project Engineer"
                  value={branding.signatoryPosition}
                  onChange={(e) => patch({ signatoryPosition: e.target.value })}
                />
              </div>
              {imageError && <Notice tone="error">{imageError}</Notice>}
            </Group>

            <Group title="Preferences" description="Applied to new quotations.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="default-template" className="mb-1.5 block text-sm font-medium text-ink">
                    Default PDF template
                  </label>
                  <select
                    id="default-template"
                    className={inputClass}
                    value={preferences.defaultTemplate}
                    onChange={(e) => setPreferences((current) => ({ ...current, defaultTemplate: e.target.value as TemplateId }))}
                  >
                    {TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Quotation validity (days)"
                  type="number"
                  min={1}
                  max={365}
                  value={String(preferences.validityDays)}
                  onChange={(e) => {
                    const days = Math.round(Number(e.target.value));
                    if (Number.isFinite(days)) setPreferences((current) => ({ ...current, validityDays: Math.min(365, Math.max(1, days)) }));
                  }}
                />
              </div>
            </Group>

            <div className="border-t border-line pt-6">
              <SaveRow busy={busy} status={status} />
            </div>
          </form>
        )}
      </div>
    </Narrow>
  );
}
