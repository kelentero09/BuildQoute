import { ArrowDown } from "lucide-react";
import { Builder } from "../components/builder/Builder";
import { useAuth } from "../lib/auth";

export function Home() {
  const { user } = useAuth();
  return (
    <>
      {/* Signed-in users land directly on the builder, without the introduction. */}
      {!user && (
        <section className="border-b border-line">
          <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Professional Construction Quotations in Minutes.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base text-muted sm:text-lg">
              Create accurate, beautifully designed quotations for your construction projects.
            </p>
            <a
              href="#builder"
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Create Quotation — Free
              <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
            <p className="mt-3 text-sm text-muted">No sign-up required.</p>
          </div>
        </section>
      )}
      <Builder />
    </>
  );
}
