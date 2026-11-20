import type { SettingsInput, EventType } from "../../shared/schemas";
import type { Branding, Preferences, Quotation, SavedQuotationSummary, SessionUser } from "../../shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const BUSY = "The service is busy right now. Please wait a minute and try again.";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  if (response.status === 204) return undefined as T;
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body: unknown = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const record = (body ?? {}) as { error?: string; message?: string };
    // 503 is what Cloudflare returns when a request runs out of CPU time on the free plan.
    const message = response.status === 503 ? BUSY : record.error || record.message || "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// ---- Session ---------------------------------------------------------------

export interface Me {
  user: SessionUser | null;
  analyticsToken: string | null;
}

export const getMe = () => request<Me>("/me");

/** Turn Better Auth responses into messages suitable for showing to a user. */
async function authRequest(path: string, data: unknown, messages: Record<number, string>): Promise<void> {
  try {
    await request(`/auth${path}`, json("POST", data));
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) throw new ApiError("Too many attempts. Please wait a few minutes and try again.", 429);
      const custom = messages[error.status];
      if (custom) throw new ApiError(custom, error.status);
    }
    throw error;
  }
}

export const signIn = (email: string, password: string) =>
  authRequest("/sign-in/email", { email, password, rememberMe: true }, { 401: "Incorrect email or password.", 403: "Incorrect email or password." });

export const signUp = (name: string, email: string, password: string) =>
  authRequest("/sign-up/email", { name, email, password }, { 422: "An account with this email already exists. Try logging in instead." });

export const signOut = () => authRequest("/sign-out", {}, {});

export const updateName = (name: string) => authRequest("/update-user", { name }, {});

export const changePassword = (currentPassword: string, newPassword: string) =>
  authRequest("/change-password", { currentPassword, newPassword, revokeOtherSessions: true }, { 400: "Your current password is not correct." });

// ---- Quotations ------------------------------------------------------------

export const listQuotations = () => request<{ quotations: SavedQuotationSummary[] }>("/quotations").then((r) => r.quotations);
export const getQuotation = (id: string) => request<{ quotation: Quotation }>(`/quotations/${encodeURIComponent(id)}`).then((r) => r.quotation);
export const deleteQuotation = (id: string) => request<void>(`/quotations/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Creates the quotation, or updates it when it already has an id. Returns the id. */
export async function saveQuotation(quotation: Quotation): Promise<string> {
  const { id, ...data } = quotation;
  const result = id
    ? await request<{ id: string }>(`/quotations/${encodeURIComponent(id)}`, json("PUT", data))
    : await request<{ id: string }>("/quotations", json("POST", data));
  return result.id;
}

// ---- Settings and private images -------------------------------------------

export interface ServerSettings extends SettingsInput {
  logoVersion: number | null;
  signatureVersion: number | null;
}

export const getSettings = () => request<ServerSettings>("/settings");
export const saveSettings = (settings: SettingsInput) => request<void>("/settings", json("PUT", settings));

export type AssetKind = "logo" | "signature";

function dataUrlToBlob(dataUrl: string): Blob {
  const [head = "", base64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export async function uploadAsset(kind: AssetKind, dataUrl: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl);
  await request(`/settings/assets/${kind}`, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
}

export const deleteAsset = (kind: AssetKind) => request<void>(`/settings/assets/${kind}`, { method: "DELETE" });

async function fetchAsset(kind: AssetKind): Promise<string | null> {
  const response = await fetch(`/api/settings/assets/${kind}`, { credentials: "same-origin" });
  if (!response.ok) return null;
  return blobToDataUrl(await response.blob());
}

export interface AccountProfile {
  branding: Branding;
  preferences: Preferences;
}

/** Company details, images and preferences for the signed-in user. */
export async function getProfile(): Promise<AccountProfile> {
  const settings = await getSettings();
  const [logo, signature] = await Promise.all([
    settings.logoVersion ? fetchAsset("logo") : null,
    settings.signatureVersion ? fetchAsset("signature") : null,
  ]);
  return {
    branding: {
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      contactNumber: settings.contactNumber,
      signatoryName: settings.signatoryName,
      signatoryPosition: settings.signatoryPosition,
      logo,
      signature,
    },
    preferences: settings.preferences,
  };
}

// ---- Usage counters and admin ----------------------------------------------

/** Fire-and-forget; counting must never get in the user's way. */
export function track(type: EventType): void {
  void fetch("/api/events", { ...json("POST", { type }), credentials: "same-origin", keepalive: true }).catch(() => undefined);
}

export interface AdminStats {
  generatedAt: number;
  retentionDays: number;
  traffic: { pageViewsTotal: number; visitorsTotal: number; visitorsToday: number; visitors7d: number; visitors30d: number };
  users: { total: number; today: number; week: number; month: number };
  usage: { savedQuotations: number; pdfDownloads: number; guestPdfDownloads: number; guestQuotesStarted: number };
  series: { day: string; visitors: number; pageViews: number; registrations: number }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: string;
  role: string;
  quotations: number;
}

export const getAdminStats = () => request<AdminStats>("/admin/stats");
export const getAdminUsers = (page: number, search: string) =>
  request<{ users: AdminUser[]; page: number; pageSize: number; total: number }>(
    `/admin/users?page=${page}&search=${encodeURIComponent(search)}`,
  );
