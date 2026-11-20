import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FilePlus2, Loader2, Printer, Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPeso } from "../../../shared/money";
import { addDaysIso, computeTotals, generateQuotationNumber, newQuotation, todayIso, validateQuotation } from "../../../shared/quotation";
import { DEFAULT_PREFERENCES, type Branding, type Preferences, type Quotation, type SavedQuotationSummary } from "../../../shared/types";
import { ApiError, deleteQuotation, getProfile, getQuotation, listQuotations, saveQuotation, track } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { clearDraft, loadDraft, loadLocalBranding, saveDraft, saveLocalBranding } from "../../lib/storage";
import { downloadBlob, generatePdf, pdfFileName, printBlob, useLivePdf, useMediaQuery } from "../../lib/usePdf";
import type { PdfData } from "../../pdf";
import { Button, Collapsible, Notice } from "../ui";
import { AdditionalDetails } from "./AdditionalDetails";
import { BrandingSection } from "./BrandingSection";
import { ItemsEditor } from "./ItemsEditor";
import { PdfPreview } from "./PdfPreview";
import { ProjectDetails } from "./ProjectDetails";
import { SavedQuotations } from "./SavedQuotations";
import { TemplatePicker } from "./TemplatePicker";
import { TotalsPanel } from "./TotalsPanel";

function errorText(cause: unknown): string {
  return cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.";
}

function hasContent(quotation: Quotation): boolean {
  return Boolean(
    quotation.projectName || quotation.clientName || quotation.items.some((item) => item.description || item.amount || item.unitPrice),
  );
}

export function Builder() {
  const { user, loading: authLoading } = useAuth();
  const [quotation, setQuotation] = useState<Quotation>(() => loadDraft() ?? newQuotation());
  const [branding, setBranding] = useState<Branding>(loadLocalBranding);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  // Never restored from storage: the signature is opt-in for every quotation.
  const [includeSignature, setIncludeSignature] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [working, setWorking] = useState<"download" | "save" | "list" | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState<SavedQuotationSummary[]>([]);
  /** JSON of the quotation as last saved to or loaded from the account. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const previousUserId = useRef<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const patchQuotation = useCallback((patch: Partial<Quotation>) => setQuotation((current) => ({ ...current, ...patch })), []);
  const patchBranding = useCallback((patch: Partial<Branding>) => setBranding((current) => ({ ...current, ...patch })), []);

  // Signed-in users get their company details and saved quotations from their account.
  useEffect(() => {
    if (authLoading) return;
    const userId = user?.id ?? null;
    const before = previousUserId.current;
    previousUserId.current = userId;

    if (!userId) {
      if (before) {
        // Just logged out: leave nothing from the account on screen or in this browser.
        clearDraft();
        setQuotation(newQuotation());
        setSaved([]);
        setSavedSnapshot(null);
        setIncludeSignature(false);
        setPreferences(DEFAULT_PREFERENCES);
        setBranding(loadLocalBranding());
      }
      return;
    }

    let cancelled = false;
    Promise.all([getProfile(), listQuotations()])
      .then(([profile, list]) => {
        if (cancelled) return;
        setBranding(profile.branding);
        setPreferences(profile.preferences);
        setSaved(list);
        // A fresh, untouched quotation picks up the user's preferences.
        setQuotation((current) =>
          hasContent(current) || current.id ? current : newQuotation(profile.preferences.defaultTemplate, profile.preferences.validityDays),
        );
      })
      .catch((cause) => !cancelled && setNotice({ tone: "error", text: errorText(cause) }));
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  // Autosave the working draft in this browser shortly after the last change.
  useEffect(() => {
    const timer = window.setTimeout(() => setStorageOk(saveDraft(quotation)), 400);
    return () => window.clearTimeout(timer);
  }, [quotation]);
  // Guests keep branding in this browser; account branding is edited in Settings.
  useEffect(() => {
    if (user || authLoading) return;
    const timer = window.setTimeout(() => setStorageOk(saveLocalBranding(branding)), 400);
    return () => window.clearTimeout(timer);
  }, [branding, user, authLoading]);

  // Count a guest quotation once per browser session, when real content first appears.
  const started = hasContent(quotation);
  useEffect(() => {
    if (!started || user || authLoading) return;
    try {
      if (sessionStorage.getItem("bq:started")) return;
      sessionStorage.setItem("bq:started", "1");
    } catch {
      return;
    }
    track("quote_started");
  }, [started, user, authLoading]);

  const totals = useMemo(() => computeTotals(quotation), [quotation]);
  const issues = useMemo(() => validateQuotation(quotation), [quotation]);
  const errors = useMemo(() => {
    if (!showErrors) return {};
    const map: Record<string, string> = {};
    for (const issue of issues) map[issue.field] ??= issue.message;
    return map;
  }, [issues, showErrors]);
  const dirty = useMemo(() => savedSnapshot !== JSON.stringify(quotation), [savedSnapshot, quotation]);

  const pdfData: PdfData = useMemo(
    () => ({ quotation, totals, branding, includeSignature }),
    [quotation, totals, branding, includeSignature],
  );
  const previewVisible = isDesktop || sheetOpen;
  // Long quotations take longer to lay out, so wait a little longer before refreshing the preview.
  const live = useLivePdf(pdfData, previewVisible, Math.min(2000, 500 + quotation.items.length * 20));

  // Lock page scroll behind the mobile preview sheet.
  useEffect(() => {
    if (!sheetOpen || isDesktop) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen, isDesktop]);

  const ensureValid = (): boolean => {
    if (issues.length === 0) return true;
    setShowErrors(true);
    setSheetOpen(false);
    window.setTimeout(() => errorSummary.current?.focus(), 0);
    return false;
  };

  const handleDownload = async () => {
    if (!ensureValid()) return;
    setNotice(null);
    setWorking("download");
    try {
      downloadBlob(await generatePdf(pdfData), pdfFileName(quotation.number, quotation.projectName));
      track("pdf_download");
    } catch {
      setNotice({ tone: "error", text: "The PDF could not be generated. Please try again." });
    } finally {
      setWorking(null);
    }
  };

  const handlePrint = () => {
    if (!ensureValid()) return;
    if (live.blob) printBlob(live.blob);
  };

  /** Replace the quotation on screen, e.g. with a new, opened or duplicated one. */
  const show = (next: Quotation, snapshot: string | null) => {
    setQuotation(next);
    setSavedSnapshot(snapshot);
    setIncludeSignature(false);
    setShowErrors(false);
    window.scrollTo({ top: document.getElementById("builder")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const confirmDiscard = (question: string): boolean => {
    const unsaved = user ? dirty && hasContent(quotation) : hasContent(quotation);
    return !unsaved || window.confirm(question);
  };

  const handleNew = () => {
    if (!confirmDiscard(user ? "Start a new quotation? Unsaved changes will be lost." : "Start a new quotation? The current draft will be cleared.")) return;
    clearDraft();
    setNotice(null);
    show(newQuotation(user ? preferences.defaultTemplate : quotation.template, preferences.validityDays), null);
  };

  const handleSave = async () => {
    if (!ensureValid()) return;
    setNotice(null);
    setWorking("save");
    try {
      let id: string;
      try {
        id = await saveQuotation(quotation);
      } catch (cause) {
        // The saved copy no longer exists (deleted elsewhere): save it as a new quotation.
        if (!(cause instanceof ApiError && cause.status === 404 && quotation.id)) throw cause;
        id = await saveQuotation({ ...quotation, id: undefined });
      }
      const stored = { ...quotation, id };
      setQuotation(stored);
      setSavedSnapshot(JSON.stringify(stored));
      setSaved(await listQuotations());
      setNotice({ tone: "success", text: "Quotation saved to your account." });
    } catch (cause) {
      setNotice({ tone: "error", text: errorText(cause) });
    } finally {
      setWorking(null);
    }
  };

  const handleOpen = async (id: string, duplicate: boolean) => {
    if (!confirmDiscard("Open another quotation? Unsaved changes will be lost.")) return;
    setNotice(null);
    setWorking("list");
    try {
      const loaded = { ...newQuotation(), ...(await getQuotation(id)) };
      if (duplicate) {
        const date = todayIso();
        const copy: Quotation = { ...loaded, id: undefined, number: generateQuotationNumber(), date, validUntil: addDaysIso(date, preferences.validityDays) };
        show(copy, null);
        setNotice({ tone: "success", text: "Copy created with a new reference number. Save it to keep it." });
      } else {
        show(loaded, JSON.stringify(loaded));
      }
    } catch (cause) {
      setNotice({ tone: "error", text: errorText(cause) });
    } finally {
      setWorking(null);
    }
  };

  const handleDelete = async (item: SavedQuotationSummary) => {
    if (!window.confirm(`Delete “${item.projectName || item.number}”? This cannot be undone.`)) return;
    setNotice(null);
    setWorking("list");
    try {
      await deleteQuotation(item.id);
      setSaved((current) => current.filter((entry) => entry.id !== item.id));
      if (quotation.id === item.id) {
        setQuotation((current) => ({ ...current, id: undefined }));
        setSavedSnapshot(null);
      }
    } catch (cause) {
      setNotice({ tone: "error", text: errorText(cause) });
    } finally {
      setWorking(null);
    }
  };

  const downloadButton = (
    <Button variant="primary" onClick={() => void handleDownload()} disabled={working !== null}>
      {working === "download" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      Download PDF
    </Button>
  );
  const printButton = (
    <Button onClick={handlePrint} disabled={!live.blob || live.status === "working"}>
      <Printer className="h-4 w-4" aria-hidden />
      Print
    </Button>
  );

  return (
    <div id="builder" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-28 pt-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:gap-10 lg:pb-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status">
            {user ? (
              quotation.id ? (dirty ? "Unsaved changes." : "All changes saved to your account.") : "Not saved to your account yet."
            ) : storageOk ? (
              <>
                Draft saved on this device only.{" "}
                <Link to="/register" className="font-medium text-accent underline-offset-2 hover:underline">
                  Create a free account
                </Link>{" "}
                to keep quotations across devices.
              </>
            ) : (
              "Your browser is blocking storage, so this draft will be lost when you close the page."
            )}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleNew}>
              <FilePlus2 className="h-4 w-4" aria-hidden />
              New quotation
            </Button>
            {user && (
              <Button size="sm" variant="primary" onClick={() => void handleSave()} disabled={working !== null || (!dirty && Boolean(quotation.id))}>
                {working === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save
              </Button>
            )}
          </div>
        </div>

        {user && (
          <div className="mb-6">
            <SavedQuotations
              items={saved}
              currentId={quotation.id}
              busy={working !== null}
              onOpen={(id) => void handleOpen(id, false)}
              onDuplicate={(id) => void handleOpen(id, true)}
              onDelete={(item) => void handleDelete(item)}
            />
          </div>
        )}

        {notice && (
          <div className="mb-6">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        )}

        {showErrors && issues.length > 0 && (
          <div ref={errorSummary} tabIndex={-1} className="mb-6 outline-none">
            <Notice tone="error">
              <p className="font-medium">Please fix the following first:</p>
              <ul className="mt-1 list-disc pl-5">
                {issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.field}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </Notice>
          </div>
        )}

        <ProjectDetails quotation={quotation} errors={errors} onChange={patchQuotation} />
        <ItemsEditor quotation={quotation} errors={errors} onChange={patchQuotation} />
        <div className="pb-6">
          <TotalsPanel quotation={quotation} totals={totals} error={errors.discount} onChange={patchQuotation} />
        </div>
        <AdditionalDetails quotation={quotation} onChange={patchQuotation} />

        {user ? (
          <Collapsible title="Branding & signature" description="Optional — taken from your account settings" defaultOpen>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {branding.logo && <img src={branding.logo} alt="Company logo" className="h-10 max-w-[8rem] object-contain" />}
                <div className="min-w-0">
                  <p className="font-medium text-ink">{branding.companyName || "No company name set"}</p>
                  <p className="text-muted">
                    {[branding.signatoryName, branding.signatoryPosition].filter(Boolean).join(", ") || "No signatory set"}
                  </p>
                </div>
                <Link to="/settings" className="ml-auto text-sm font-medium text-accent hover:underline">
                  Edit in Settings
                </Link>
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  disabled={!branding.signature}
                  onChange={(event) => setIncludeSignature(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">Include Signature in PDF</span>
                  <span className="block text-xs text-muted">
                    {branding.signature
                      ? "Off by default. Your saved signature is only added when you tick this box for this quotation."
                      : "Add a signature in Settings first."}
                  </span>
                </span>
              </label>
            </div>
          </Collapsible>
        ) : (
          <BrandingSection
            branding={branding}
            includeSignature={includeSignature}
            onBrandingChange={patchBranding}
            onIncludeSignatureChange={setIncludeSignature}
            note="Your company details, logo and signature are kept in this browser only and are never uploaded."
          />
        )}

        <div className="border-t border-line pt-6">
          <TemplatePicker value={quotation.template} onChange={(template) => patchQuotation({ template })} />
        </div>
      </div>

      {/* Desktop: live preview beside the form. */}
      {isDesktop && (
        <aside aria-label="PDF preview" className="no-print sticky top-20 flex h-[calc(100vh-6.5rem)] flex-col rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Preview</h2>
            <div className="flex gap-2">
              {printButton}
              {downloadButton}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <PdfPreview blob={live.blob} status={live.status} />
          </div>
        </aside>
      )}

      {/* Mobile and tablet: action bar plus a full-screen preview. The bar is removed while the preview is open. */}
      {!isDesktop && !sheetOpen && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 py-3 backdrop-blur [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-xs text-muted">Total</span>
              <span className="block truncate text-base font-semibold tabular-nums text-ink">{formatPeso(totals.total)}</span>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button onClick={() => setSheetOpen(true)}>
                <Eye className="h-4 w-4" aria-hidden />
                Preview
              </Button>
              {downloadButton}
            </div>
          </div>
        </div>
      )}

      {!isDesktop && sheetOpen && (
        <div role="dialog" aria-modal="true" aria-label="PDF preview" className="fixed inset-0 z-30 flex flex-col bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setSheetOpen(false)}>
              <X className="h-4 w-4" aria-hidden />
              Close
            </Button>
            <div className="flex gap-2">
              {printButton}
              {downloadButton}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-2xl">
              <PdfPreview blob={live.blob} status={live.status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
