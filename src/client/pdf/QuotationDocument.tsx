import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { formatAmount, formatPeso, formatQuantity } from "../../shared/money";
import { formatDate, isBlankItem, type Totals } from "../../shared/quotation";
import type { Branding, Quotation } from "../../shared/types";
import { THEMES, type Theme } from "./themes";

export interface PdfData {
  quotation: Quotation;
  totals: Totals;
  branding: Branding;
  includeSignature: boolean;
}

const PAGE_X = 40;
const PAGE_TOP = 40;

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9.5,
    lineHeight: 1.45,
    paddingTop: PAGE_TOP,
    paddingBottom: 60,
    paddingHorizontal: PAGE_X,
  },
  row: { flexDirection: "row" },
  label: { fontSize: 7.5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  strong: { fontWeight: 600 },
  metaCol: { flex: 1, paddingRight: 16 },
  cell: { paddingVertical: 7, paddingHorizontal: 6 },
  headCell: { paddingVertical: 7, paddingHorizontal: 6, fontSize: 7.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" },
  right: { textAlign: "right" },
  totalsBox: { width: 230, marginLeft: "auto", marginTop: 12 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 8 },
  block: { marginTop: 18 },
  footer: {
    position: "absolute",
    left: PAGE_X,
    right: PAGE_X,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    borderTopWidth: 0.5,
    paddingTop: 6,
  },
});

const COL = { index: 24, qty: 54, unit: 46, price: 84, amount: 92, simpleAmount: 120 };

function Logo({ src, boxed }: { src: string; boxed?: boolean }) {
  const image = <Image src={src} style={{ maxHeight: 46, maxWidth: 150, objectFit: "contain", objectPosition: "left" }} />;
  if (!boxed) return <View style={{ marginBottom: 8, alignItems: "flex-start" }}>{image}</View>;
  return (
    <View style={{ backgroundColor: "#ffffff", borderRadius: 4, padding: 6, marginBottom: 8, alignSelf: "flex-start" }}>{image}</View>
  );
}

function CompanyLines({ branding, color, align = "left" }: { branding: Branding; color: string; align?: "left" | "right" }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      {branding.companyAddress ? (
        <Text style={{ color, fontSize: 8.5, textAlign: align, maxWidth: 240 }}>{branding.companyAddress}</Text>
      ) : null}
      {branding.contactNumber ? (
        <Text style={{ color, fontSize: 8.5, textAlign: align, maxWidth: 240 }}>{branding.contactNumber}</Text>
      ) : null}
    </View>
  );
}

function Header({ quotation, branding, theme }: { quotation: Quotation; branding: Branding; theme: Theme }) {
  if (theme.header === "band") {
    return (
      <View style={{ marginTop: -PAGE_TOP, marginHorizontal: -PAGE_X, marginBottom: 22 }}>
        <View style={[s.row, { backgroundColor: "#1f2937", paddingHorizontal: PAGE_X, paddingTop: 30, paddingBottom: 22, justifyContent: "space-between", alignItems: "flex-end" }]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {branding.logo ? <Logo src={branding.logo} boxed /> : null}
            {branding.companyName ? (
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", lineHeight: 1.25 }}>
                {branding.companyName}
              </Text>
            ) : null}
            <CompanyLines branding={branding} color="#d1d5db" />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, letterSpacing: 2, lineHeight: 1.1 }}>QUOTATION</Text>
            <Text style={{ color: "#fdba74", fontSize: 9.5, fontWeight: 600, marginTop: 4 }}>{quotation.number}</Text>
          </View>
        </View>
        <View style={{ height: 4, backgroundColor: theme.accent }} />
      </View>
    );
  }

  if (theme.header === "minimal") {
    return (
      <View style={{ marginBottom: 22 }}>
        <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 18 }]}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: 400, letterSpacing: 4, lineHeight: 1.1, color: theme.text }}>QUOTATION</Text>
            <Text style={{ fontSize: 9, color: theme.muted, letterSpacing: 1, marginTop: 6 }}>{quotation.number}</Text>
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: 250 }}>
            {branding.logo ? (
              <View style={{ marginBottom: 8, alignItems: "flex-end" }}>
                <Image src={branding.logo} style={{ maxHeight: 42, maxWidth: 140, objectFit: "contain", objectPosition: "right" }} />
              </View>
            ) : null}
            {branding.companyName ? (
              <Text style={{ fontSize: 10.5, fontWeight: 600, textAlign: "right", color: theme.text }}>{branding.companyName}</Text>
            ) : null}
            <CompanyLines branding={branding} color={theme.muted} align="right" />
          </View>
        </View>
        <View style={{ height: 0.75, backgroundColor: theme.text }} />
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 22 }}>
      <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16 }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          {branding.logo ? <Logo src={branding.logo} /> : null}
          {branding.companyName ? (
            <Text style={{ fontSize: 13, fontWeight: 700, color: theme.text, lineHeight: 1.25 }}>{branding.companyName}</Text>
          ) : null}
          <CompanyLines branding={branding} color={theme.muted} />
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1.5, lineHeight: 1.1, color: theme.accent }}>QUOTATION</Text>
          <Text style={{ fontSize: 9.5, color: theme.muted, marginTop: 4 }}>{quotation.number}</Text>
        </View>
      </View>
      <View style={{ height: 1.5, backgroundColor: theme.accent }} />
    </View>
  );
}

function MetaLine({ name, value, theme }: { name: string; value: string; theme: Theme }) {
  return (
    <View style={s.row}>
      <Text style={{ width: 62, color: theme.muted }}>{name}</Text>
      <Text style={{ flex: 1, color: theme.text }}>{value}</Text>
    </View>
  );
}

function Meta({ quotation, theme }: { quotation: Quotation; theme: Theme }) {
  const label = [s.label, { color: theme.label }];
  return (
    <View style={[s.row, { marginBottom: 20 }]}>
      <View style={s.metaCol}>
        <Text style={label}>Quotation details</Text>
        <MetaLine name="Reference" value={quotation.number} theme={theme} />
        {quotation.date ? <MetaLine name="Date" value={formatDate(quotation.date)} theme={theme} /> : null}
        {quotation.validUntil ? <MetaLine name="Valid until" value={formatDate(quotation.validUntil)} theme={theme} /> : null}
      </View>
      <View style={s.metaCol}>
        <Text style={label}>Prepared for</Text>
        <Text style={[s.strong, { fontSize: 10.5, color: theme.text }]}>{quotation.clientName || "—"}</Text>
      </View>
      <View style={[s.metaCol, { paddingRight: 0 }]}>
        <Text style={label}>Project</Text>
        <Text style={[s.strong, { fontSize: 10.5, color: theme.text }]}>{quotation.projectName || "—"}</Text>
        {quotation.location ? <Text style={{ color: theme.muted }}>{quotation.location}</Text> : null}
        {quotation.duration ? <Text style={{ color: theme.muted }}>Duration: {quotation.duration}</Text> : null}
      </View>
    </View>
  );
}

function ItemsTable({ quotation, totals, theme }: { quotation: Quotation; totals: Totals; theme: Theme }) {
  const detailed = quotation.mode === "detailed";
  const rows = totals.items.filter((_, index) => {
    const source = quotation.items[index];
    return source ? !isBlankItem(source, quotation.mode) : false;
  });
  const head = [s.headCell, { color: theme.tableHeadText }];

  return (
    <View>
      <View
        style={[
          s.row,
          theme.tableHeadBg ? { backgroundColor: theme.tableHeadBg } : {},
          theme.tableHeadRule ? { borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: theme.tableHeadRule } : {},
        ]}
      >
        <Text style={[head, { width: COL.index }]}>#</Text>
        <Text style={[head, { flex: 1 }]}>Description</Text>
        {detailed ? <Text style={[head, s.right, { width: COL.qty }]}>Qty</Text> : null}
        {detailed ? <Text style={[head, { width: COL.unit }]}>Unit</Text> : null}
        {detailed ? <Text style={[head, s.right, { width: COL.price }]}>Unit price</Text> : null}
        <Text style={[head, s.right, { width: detailed ? COL.amount : COL.simpleAmount }]}>Amount</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={[s.cell, { color: theme.muted, borderBottomWidth: 0.5, borderColor: theme.rule }]}>No items yet.</Text>
      ) : null}

      {rows.map((item, index) => (
        <View
          key={item.id}
          wrap={false}
          style={[
            s.row,
            { borderBottomWidth: 0.5, borderColor: theme.rule },
            theme.zebra && index % 2 === 1 ? { backgroundColor: theme.zebra } : {},
          ]}
        >
          <Text style={[s.cell, { width: COL.index, color: theme.muted }]}>{index + 1}</Text>
          <Text style={[s.cell, { flex: 1, color: theme.text }]}>{item.description}</Text>
          {detailed ? (
            <Text style={[s.cell, s.right, { width: COL.qty, color: theme.text }]}>
              {item.quantityMilli === null ? "" : formatQuantity(item.quantityMilli)}
            </Text>
          ) : null}
          {detailed ? <Text style={[s.cell, { width: COL.unit, color: theme.text }]}>{item.unit}</Text> : null}
          {detailed ? (
            <Text style={[s.cell, s.right, { width: COL.price, color: theme.text }]}>
              {item.unitPrice === null ? "" : formatAmount(item.unitPrice)}
            </Text>
          ) : null}
          <Text style={[s.cell, s.right, { width: detailed ? COL.amount : COL.simpleAmount, color: theme.text }]}>
            {formatAmount(item.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TotalsBlock({ totals, theme }: { totals: Totals; theme: Theme }) {
  const hasDiscount = totals.discount > 0;
  const percent = totals.discountPercentBp === null ? "" : ` (${formatAmount(totals.discountPercentBp).replace(/\.00$/, "")}%)`;
  return (
    <View style={s.totalsBox} wrap={false}>
      {hasDiscount ? (
        <>
          <View style={s.totalsRow}>
            <Text style={{ color: theme.muted }}>Subtotal</Text>
            <Text style={{ color: theme.text }}>{formatPeso(totals.subtotal)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={{ color: theme.muted }}>Discount{percent}</Text>
            <Text style={{ color: theme.text }}>− {formatPeso(totals.discount)}</Text>
          </View>
        </>
      ) : null}
      <View
        style={[
          s.totalsRow,
          { paddingVertical: 9, marginTop: hasDiscount ? 4 : 0, alignItems: "center" },
          theme.totalBg
            ? { backgroundColor: theme.totalBg }
            : { borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: theme.totalText },
        ]}
      >
        <Text style={{ color: theme.totalText, fontSize: 8.5, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Total amount
        </Text>
        <Text style={{ color: theme.totalText, fontSize: 13, fontWeight: 700 }}>{formatPeso(totals.total)}</Text>
      </View>
    </View>
  );
}

function TextBlock({ title, body, theme }: { title: string; body: string; theme: Theme }) {
  if (!body.trim()) return null;
  return (
    // Short blocks are kept whole so a heading is never left alone at the bottom of a page.
    // Long ones (many lines) are allowed to flow across pages.
    <View style={s.block} wrap={body.split("\n").length + body.length / 90 > 30}>
      <Text style={[s.label, { color: theme.label }]}>{title}</Text>
      <Text style={{ color: theme.text }}>{body.trim()}</Text>
    </View>
  );
}

function PreparedBy({ branding, includeSignature, theme }: { branding: Branding; includeSignature: boolean; theme: Theme }) {
  const showSignature = includeSignature && Boolean(branding.signature);
  if (!showSignature && !branding.signatoryName && !branding.signatoryPosition) return null;
  return (
    <View style={{ marginTop: 28, width: 200 }} wrap={false}>
      <Text style={[s.label, { color: theme.label }]}>Prepared by</Text>
      <View style={{ height: 48, justifyContent: "flex-end", alignItems: "flex-start" }}>
        {showSignature && branding.signature ? (
          <Image src={branding.signature} style={{ maxHeight: 46, maxWidth: 180, objectFit: "contain", objectPosition: "left bottom" }} />
        ) : null}
      </View>
      <View style={{ borderTopWidth: 0.75, borderColor: theme.text, paddingTop: 5 }}>
        {branding.signatoryName ? <Text style={[s.strong, { color: theme.text }]}>{branding.signatoryName}</Text> : null}
        {branding.signatoryPosition ? <Text style={{ color: theme.muted }}>{branding.signatoryPosition}</Text> : null}
        {branding.companyName ? <Text style={{ color: theme.muted }}>{branding.companyName}</Text> : null}
      </View>
    </View>
  );
}

function Footer({ quotation, theme }: { quotation: Quotation; theme: Theme }): ReactNode {
  return (
    <View style={[s.footer, { borderColor: theme.rule }]} fixed>
      <Text style={{ color: theme.muted }}>Quotation {quotation.number}</Text>
      <Text style={{ color: theme.muted }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function QuotationDocument({ quotation, totals, branding, includeSignature }: PdfData) {
  const theme = THEMES[quotation.template] ?? THEMES.modern;
  return (
    <Document
      title={`Quotation ${quotation.number}`}
      author={branding.companyName || undefined}
      subject={quotation.projectName || undefined}
      creator="BuildQuote"
      producer="BuildQuote"
    >
      <Page size="A4" style={[s.page, { color: theme.text }]}>
        <Header quotation={quotation} branding={branding} theme={theme} />
        <Meta quotation={quotation} theme={theme} />
        <ItemsTable quotation={quotation} totals={totals} theme={theme} />
        <TotalsBlock totals={totals} theme={theme} />
        <TextBlock title="Payment terms" body={quotation.paymentTerms} theme={theme} />
        <TextBlock title="Scope of work" body={quotation.scopeNotes} theme={theme} />
        <TextBlock title="Exclusions" body={quotation.exclusions} theme={theme} />
        <TextBlock title="Remarks" body={quotation.remarks} theme={theme} />
        <PreparedBy branding={branding} includeSignature={includeSignature} theme={theme} />
        <Footer quotation={quotation} theme={theme} />
      </Page>
    </Document>
  );
}
