import type { ReactNode } from "react";
import { Narrow } from "../components/layout";

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Narrow>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: November 2026</p>
      <div className="mt-8 space-y-6 text-[15px] leading-7 text-slate-700 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </Narrow>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy">
      <p>BuildQuote is built to collect as little information as possible. This page explains what is stored and why.</p>
      <section>
        <h2>Using BuildQuote without an account</h2>
        <p>
          Quotations, company details, logos and signatures that you enter as a guest are stored only in your own browser. They are not
          sent to our servers. Clearing your browser data removes them.
        </p>
      </section>
      <section>
        <h2>If you create an account</h2>
        <ul>
          <li>Your name, email address and a securely hashed password.</li>
          <li>The quotations you choose to save, and your company details, logo and signature if you add them.</li>
        </ul>
        <p className="mt-2">
          Logos and signatures are stored privately and are only ever served to you while you are signed in. A saved signature is never
          added to a quotation unless you tick “Include Signature in PDF” for that quotation.
        </p>
      </section>
      <section>
        <h2>Usage statistics</h2>
        <p>
          We count page views, approximate daily visitors, registrations and PDF downloads in aggregate so we know whether the service is
          being used. We do not store IP addresses, do not use advertising cookies and do not build visitor profiles. Approximate visitor
          counts use a short-lived anonymous identifier that changes every day and is deleted after it is counted.
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>A single sign-in cookie is set when you log in. It is required to keep you signed in and is not used for tracking.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can delete any saved quotation, logo or signature at any time. To have your account removed, contact the site operator.</p>
      </section>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="Terms of Use">
      <p>By using BuildQuote you agree to these terms.</p>
      <section>
        <h2>The service</h2>
        <p>
          BuildQuote helps you prepare construction quotation documents. It is provided free of charge, “as is”, without warranties of any
          kind.
        </p>
      </section>
      <section>
        <h2>Your responsibility</h2>
        <ul>
          <li>You are responsible for the accuracy of the prices, quantities, terms and other content of your quotations.</li>
          <li>BuildQuote does not add taxes automatically. Check what applies to your project.</li>
          <li>A quotation generated here is a document you issue; BuildQuote is not a party to any agreement between you and your client.</li>
          <li>Only upload logos and signatures that you are authorised to use.</li>
        </ul>
      </section>
      <section>
        <h2>Accounts</h2>
        <p>Keep your password confidential. Password reset by email is not yet available, so please store your password safely.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Do not misuse the service, attempt to access other users’ data, or interfere with its operation.</p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>To the extent permitted by law, BuildQuote is not liable for losses arising from the use of the service or of documents created with it.</p>
      </section>
    </Doc>
  );
}
