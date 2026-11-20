import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2 text-ink" aria-label="BuildQuote home">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-sm font-bold text-white" aria-hidden>
        B
      </span>
      <span className="text-[15px] font-semibold tracking-tight">BuildQuote</span>
    </Link>
  );
}

const navLink = "rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink";

export function Header() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const logout = async () => {
    await signOut();
    navigate("/");
  };
  return (
    <header className="no-print sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Account" className="flex items-center gap-1">
          {loading ? null : user ? (
            <>
              {user.isAdmin && (
                <Link to="/admin" className={navLink}>
                  Admin
                </Link>
              )}
              <Link to="/settings" className={navLink}>
                Settings
              </Link>
              <button type="button" className={navLink} onClick={() => void logout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={navLink}>
                Log in
              </Link>
              <Link to="/register" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="no-print border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
        <span>© {new Date().getFullYear()} BuildQuote</span>
        <nav aria-label="Legal" className="flex gap-5">
          <Link to="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-ink">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** Narrow column for text pages and forms. */
export function Narrow({ children, width = "max-w-2xl" }: { children: ReactNode; width?: string }) {
  return <div className={`mx-auto ${width} px-4 py-12 sm:px-6`}>{children}</div>;
}
