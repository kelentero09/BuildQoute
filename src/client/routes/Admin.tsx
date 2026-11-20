import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ApiError, getAdminStats, getAdminUsers, type AdminStats, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { TrendChart } from "../components/TrendChart";
import { Button, IconButton, Notice, cx, inputClass } from "../components/ui";
import { NotFound } from "./NotFound";

const dateFormat = new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString()}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Users() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: AdminUser[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminUsers(page, query)
      .then((result) => !cancelled && (setData(result), setError("")))
      .catch((cause) => !cancelled && setError(cause instanceof ApiError ? cause.message : "Could not load users."));
    return () => {
      cancelled = true;
    };
  }, [page, query]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Block title="Users">
      <form onSubmit={submit} role="search" className="mb-4 flex max-w-md gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search users by name or email</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" value={search} maxLength={100} placeholder="Search name or email" onChange={(e) => setSearch(e.target.value)} className={cx(inputClass, "pl-9")} />
        </label>
        <Button type="submit">Search</Button>
      </form>

      {error && <Notice tone="error">{error}</Notice>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-line bg-surface text-xs font-medium text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Registered</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-2.5 font-medium text-ink">{user.name}</td>
                    <td className="px-4 py-2.5 text-muted">{user.email}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{dateFormat.format(new Date(user.createdAt))}</td>
                    <td className="px-4 py-2.5 capitalize text-muted">{user.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => setSelected(user)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      {query ? "No users match that search." : "No registered users yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>
              {data.total.toLocaleString()} {data.total === 1 ? "user" : "users"}
            </span>
            <span className="flex items-center gap-1">
              <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </IconButton>
              <span className="tabular-nums">
                Page {page} of {pages}
              </span>
              <IconButton label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </IconButton>
            </span>
          </div>
        </>
      )}

      {selected && (
        <div className="mt-4 rounded-xl border border-line p-4" role="region" aria-label="Account information">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">{selected.name}</h3>
            <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Email", selected.email],
              ["Registered", dateTimeFormat.format(new Date(selected.createdAt))],
              ["Status", selected.status],
              ["Role", selected.role],
              ["Saved quotations", selected.quotations.toLocaleString()],
            ].map(([term, value]) => (
              <div key={term} className="flex justify-between gap-3 border-b border-line pb-2 sm:block sm:border-0 sm:pb-0">
                <dt className="text-muted">{term}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Block>
  );
}

export function Admin() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    let cancelled = false;
    getAdminStats()
      .then((result) => !cancelled && setStats(result))
      .catch((cause) => !cancelled && setError(cause instanceof ApiError ? cause.message : "Could not load statistics."));
    return () => {
      cancelled = true;
    };
  }, [user?.isAdmin]);

  if (loading) return null;
  // Guests and ordinary users see the same page as for any unknown address.
  // This is presentation only: the data itself is protected on the server.
  if (!user?.isAdmin) return <NotFound />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Admin</h1>
      <p className="mt-1 text-sm text-muted">
        {stats ? `Figures as of ${dateTimeFormat.format(stats.generatedAt)} (Philippine time).` : "Loading…"}
      </p>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {stats && (
        <>
          <Block
            title="Website traffic"
            note={`Counted by BuildQuote itself, without cookies or stored IP addresses. Known bots are excluded. Daily figures are kept for ${stats.retentionDays} days.`}
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile label="Page views" value={stats.traffic.pageViewsTotal} note="All recorded" />
              <Tile label="Visitors" value={stats.traffic.visitorsTotal} note="Approximate, all recorded" />
              <Tile label="Visitors today" value={stats.traffic.visitorsToday} note="Approximate" />
              <Tile label="Visitors, 7 days" value={stats.traffic.visitors7d} note="Sum of daily visitors" />
              <Tile label="Visitors, 30 days" value={stats.traffic.visitors30d} note="Sum of daily visitors" />
            </div>
            <p className="mt-2 text-xs text-muted">
              A visitor is counted once per day. Someone who returns on three days counts three times in the 7- and 30-day figures.
            </p>
          </Block>

          <Block title="Registered users">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Total users" value={stats.users.total} />
              <Tile label="New today" value={stats.users.today} />
              <Tile label="New, last 7 days" value={stats.users.week} />
              <Tile label="New, last 30 days" value={stats.users.month} />
            </div>
          </Block>

          <Block title="Product usage">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Saved quotations" value={stats.usage.savedQuotations} note="Currently stored" />
              <Tile label="PDF downloads" value={stats.usage.pdfDownloads} note="Guests and users" />
              <Tile label="Guest PDF downloads" value={stats.usage.guestPdfDownloads} />
              <Tile label="Guest quotations started" value={stats.usage.guestQuotesStarted} note="Once per browser session" />
            </div>
          </Block>

          <Block title="Trends" note="Last 30 days.">
            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChart title="Daily visitors (approximate)" unit="visitors" data={stats.series.map((p) => ({ day: p.day, value: p.visitors }))} />
              <TrendChart title="Daily registrations" unit="registrations" data={stats.series.map((p) => ({ day: p.day, value: p.registrations }))} />
            </div>
          </Block>
        </>
      )}

      <Users />
    </div>
  );
}
