import type { ReactNode } from "react";

import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

import type { PricingLineItem } from "../../jobs/_components/pricing-items";
import { existsSync } from "node:fs";
import path from "node:path";

export type InvoicePdfMaterial = {
  description: string;
  type: "purchase" | "return";
  vendor: string;
  purchaseDate: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  price: string;
};

export type InvoicePdfPayment = {
  amount: { toString: () => string };
  description: string;
  method: string;
  paidOn: Date;
};

export type InvoicePdfData = {
  amountPaid: { toString: () => string };
  balanceDue: { toString: () => string };
  companyEmail: string;
  companyLogoSrc?: string | null;
  companyName: string;
  companyPhone: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  dateBegin: Date | null;
  dateEnd: Date | null;
  depositPaid: { toString: () => string };
  dueDate: Date;
  finalCost: { toString: () => string };
  invoiceNumber: string;
  issuedAt: Date;
  jobDescription: string | null;
  jobTitle: string;
  laborCost: { toString: () => string };
  laborItems: PricingLineItem[];
  materialTaxAmount: { toString: () => string };
  materialTaxRate: { toString: () => string };
  materials: InvoicePdfMaterial[];
  materialsSubtotal: { toString: () => string };
  payments: InvoicePdfPayment[];
  serviceLocation: string | null;
};

const interFontFiles = [
  {
    src: path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff"),
    fontWeight: 400,
  },
  {
    src: path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-600-normal.woff"),
    fontWeight: 600,
  },
  {
    src: path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"),
    fontWeight: 700,
  },
];

function registerInvoiceFont() {
  if (!interFontFiles.every((font) => existsSync(font.src))) {
    return "Helvetica";
  }

  Font.register({
    family: "Inter",
    fonts: interFontFiles,
  });

  return "Inter";
}

const invoiceFontFamily = registerInvoiceFont();

const neutralBorder = "#d4d4d4";
const lightBorder = "#e5e5e5";
const subtleFill = "#fafafa";
const textMuted = "#525252";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: invoiceFontFamily,
    fontSize: 10,
    lineHeight: 1.28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    borderBottomColor: neutralBorder,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 8,
  },
  companyBlock: {
    flex: 1,
    paddingRight: 18,
  },
  companyRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  logoWrap: {
    alignItems: "center",
    height: 46,
    justifyContent: "center",
    width: 58,
  },
  logo: {
    maxHeight: 46,
    maxWidth: 58,
    objectFit: "contain",
  },
  companyName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 2,
  },
  muted: {
    color: textMuted,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  invoiceMeta: {
    color: textMuted,
    gap: 3,
  },
  balancePanel: {
    borderColor: neutralBorder,
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 112,
    paddingHorizontal: 9,
    paddingVertical: 9,
    textAlign: "right",
    width: 108,
  },
  balanceLabel: {
    color: "#262626",
    fontSize: 10,
    marginBottom: 22,
  },
  balanceAmount: {
    color: "#be123c",
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 24,
  },
  balanceDue: {
    color: "#262626",
    fontSize: 9.5,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  infoColumn: {
    flex: 1,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
  },
  infoBox: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 55,
    padding: 8,
  },
  strong: {
    fontWeight: 700,
  },
  section: {
    gap: 6,
    marginBottom: 12,
  },
  noteBox: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 1,
    padding: 8,
  },
  table: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: subtleFill,
    borderBottomColor: neutralBorder,
    borderBottomWidth: 1,
    flexDirection: "row",
    fontWeight: 700,
  },
  tableRow: {
    borderBottomColor: lightBorder,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 22,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 22,
  },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 5.5,
  },
  textRight: {
    textAlign: "right",
  },
  descriptionCell: {
    flex: 1,
  },
  dateCell: {
    width: 72,
  },
  vendorCell: {
    width: 82,
  },
  qtyCell: {
    width: 42,
  },
  unitCell: {
    width: 48,
  },
  rateCell: {
    width: 58,
  },
  amountCell: {
    width: 66,
  },
  methodCell: {
    width: 64,
  },
  summary: {
    alignSelf: "flex-end",
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
    minWidth: 185,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 18,
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryRowLast: {
    flexDirection: "row",
    gap: 18,
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: "#262626",
  },
  summaryValue: {
    fontWeight: 700,
    textAlign: "right",
  },
  summaryTotal: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    bottom: 22,
    color: textMuted,
    fontSize: 8,
    left: 42,
    position: "absolute",
    right: 42,
    textAlign: "right",
  },
});

function money(value: { toString: () => string } | string | number) {
  return `$${Number(value.toString()).toFixed(2)}`;
}

function dash(value?: string | null) {
  return value?.trim() ? value : "-";
}

function optionalMoney(value?: string) {
  return value ? money(value) : "-";
}

function shortDate(value: Date) {
  return format(value, "MM/dd/yy");
}

function maybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
}

function materialDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : shortDate(date);
}

function canRenderLogo(value?: string | null) {
  return Boolean(value && (value.startsWith("data:") || value.startsWith("http://") || value.startsWith("https://")));
}

function keyedItems<T>(items: T[], getParts: (item: T) => Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  return items.map((item) => {
    const baseKey = getParts(item)
      .map((part) => part?.trim())
      .filter(Boolean)
      .join("|");
    const keyBase = baseKey || "row";
    const count = (counts.get(keyBase) ?? 0) + 1;
    counts.set(keyBase, count);

    return {
      item,
      key: count === 1 ? keyBase : `${keyBase}|${count}`,
    };
  });
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function InfoBox({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.infoColumn} wrap={false}>
      <SectionLabel label={label} />
      <View style={styles.infoBox}>{children}</View>
    </View>
  );
}

function SummaryRow({
  label,
  last = false,
  strong = false,
  value,
}: {
  label: string;
  last?: boolean;
  strong?: boolean;
  value: string;
}) {
  return (
    <View style={last ? styles.summaryRowLast : styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={strong ? [styles.summaryValue, styles.summaryTotal] : styles.summaryValue}>{value}</Text>
    </View>
  );
}

function LineTable({
  fallbackAmount,
  items,
  title,
}: {
  fallbackAmount: string;
  items: PricingLineItem[];
  title: string;
}) {
  const keyedLaborItems = keyedItems(items, (item) => [
    item.description,
    item.quantity,
    item.unit,
    item.unitPrice,
    item.price,
  ]);

  return (
    <View style={styles.section}>
      <SectionLabel label={title} />
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.cell, styles.descriptionCell]}>Description</Text>
          <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>Qty</Text>
          <Text style={[styles.cell, styles.unitCell, styles.textRight]}>Unit</Text>
          <Text style={[styles.cell, styles.rateCell, styles.textRight]}>Rate</Text>
          <Text style={[styles.cell, styles.amountCell, styles.textRight]}>Amount</Text>
        </View>
        {keyedLaborItems.length ? (
          keyedLaborItems.map(({ item, key }, index) => (
            <View key={key} style={index === keyedLaborItems.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.cell, styles.descriptionCell]}>{dash(item.description)}</Text>
              <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>{dash(item.quantity)}</Text>
              <Text style={[styles.cell, styles.unitCell, styles.textRight]}>{dash(item.unit)}</Text>
              <Text style={[styles.cell, styles.rateCell, styles.textRight]}>{optionalMoney(item.unitPrice)}</Text>
              <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{optionalMoney(item.price)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRowLast}>
            <Text style={[styles.cell, styles.descriptionCell]}>Labor</Text>
            <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.unitCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.rateCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{fallbackAmount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MaterialsTable({ materials }: { materials: InvoicePdfMaterial[] }) {
  const keyedMaterials = keyedItems(materials, (material) => [
    material.type,
    material.description,
    material.purchaseDate,
    material.vendor,
    material.quantity,
    material.unit,
    material.unitPrice,
    material.price,
  ]);

  return (
    <View style={styles.section}>
      <SectionLabel label="Materials" />
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.cell, styles.descriptionCell]}>Description</Text>
          <Text style={[styles.cell, styles.dateCell]}>Date</Text>
          <Text style={[styles.cell, styles.vendorCell]}>Vendor</Text>
          <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>Qty</Text>
          <Text style={[styles.cell, styles.unitCell, styles.textRight]}>Unit</Text>
          <Text style={[styles.cell, styles.rateCell, styles.textRight]}>Rate</Text>
          <Text style={[styles.cell, styles.amountCell, styles.textRight]}>Amount</Text>
        </View>
        {keyedMaterials.length ? (
          keyedMaterials.map(({ item: material, key }, index) => (
            <View key={key} style={index === keyedMaterials.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.cell, styles.descriptionCell]}>{dash(material.description)}</Text>
              <Text style={[styles.cell, styles.dateCell]}>{materialDate(material.purchaseDate)}</Text>
              <Text style={[styles.cell, styles.vendorCell]}>{dash(material.vendor)}</Text>
              <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>{dash(material.quantity)}</Text>
              <Text style={[styles.cell, styles.unitCell, styles.textRight]}>{dash(material.unit)}</Text>
              <Text style={[styles.cell, styles.rateCell, styles.textRight]}>{optionalMoney(material.unitPrice)}</Text>
              <Text style={[styles.cell, styles.amountCell, styles.textRight]}>
                {material.type === "return" ? "-" : ""}
                {optionalMoney(material.price)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRowLast}>
            <Text style={[styles.cell, styles.descriptionCell]}>No material line items.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PaymentsTable({ payments }: { payments: InvoicePdfPayment[] }) {
  const keyedPayments = keyedItems(payments, (payment) => [
    payment.paidOn.toISOString(),
    payment.description,
    payment.method,
    payment.amount.toString(),
  ]);

  return (
    <View style={styles.section}>
      <SectionLabel label="Transaction History" />
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.cell, styles.dateCell]}>Date</Text>
          <Text style={[styles.cell, styles.descriptionCell]}>Description</Text>
          <Text style={[styles.cell, styles.methodCell]}>Method</Text>
          <Text style={[styles.cell, styles.amountCell, styles.textRight]}>Amount</Text>
        </View>
        {keyedPayments.length ? (
          keyedPayments.map(({ item: payment, key }, index) => (
            <View key={key} style={index === keyedPayments.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.cell, styles.dateCell]}>{shortDate(payment.paidOn)}</Text>
              <Text style={[styles.cell, styles.descriptionCell]}>{payment.description}</Text>
              <Text style={[styles.cell, styles.methodCell]}>{payment.method}</Text>
              <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{money(payment.amount)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRowLast}>
            <Text style={[styles.cell, styles.descriptionCell]}>No payments recorded yet.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const returnTotal = data.materials
    .filter((material) => material.type === "return")
    .reduce((total, material) => total + Number(material.price || 0), 0);

  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.header} wrap={false}>
          <View style={styles.companyBlock}>
            <View style={styles.companyRow}>
              {canRenderLogo(data.companyLogoSrc) ? (
                <View style={styles.logoWrap}>
                  <Image src={data.companyLogoSrc ?? ""} style={styles.logo} />
                </View>
              ) : null}
              <View>
                <Text style={styles.companyName}>{data.companyName}</Text>
                <Text>{data.companyEmail}</Text>
                {data.companyPhone ? <Text>{data.companyPhone}</Text> : null}
              </View>
            </View>

            <Text style={styles.documentTitle}>Invoice</Text>
            <View style={styles.invoiceMeta}>
              <Text>Invoice #{data.invoiceNumber}</Text>
              <Text>Issued {format(data.issuedAt, "MMM d, yyyy")}</Text>
            </View>
          </View>

          <View style={styles.balancePanel}>
            <Text style={styles.balanceLabel}>Balance due</Text>
            <Text style={styles.balanceAmount}>{money(data.balanceDue)}</Text>
            <Text style={styles.balanceDue}>by {format(data.dueDate, "MMM d, yyyy")}</Text>
          </View>
        </View>

        <View style={styles.infoGrid} wrap={false}>
          <InfoBox label="Bill To">
            <Text style={styles.strong}>{data.customerName ?? "No customer on file"}</Text>
            <Text>{data.customerEmail ?? "No email on file"}</Text>
            <Text>{data.customerPhone ?? "No phone on file"}</Text>
          </InfoBox>
          <InfoBox label="Job">
            <Text style={styles.strong}>{data.jobTitle}</Text>
          </InfoBox>
        </View>

        <View style={styles.infoGrid} wrap={false}>
          <InfoBox label="Schedule">
            <Text>Start: {maybeDate(data.dateBegin)}</Text>
            <Text>End: {maybeDate(data.dateEnd)}</Text>
          </InfoBox>
          <InfoBox label="Service Location">
            <Text>{data.serviceLocation ?? "Not on file"}</Text>
          </InfoBox>
        </View>

        {data.jobDescription ? (
          <View style={styles.section} wrap={false}>
            <SectionLabel label="Job Description" />
            <Text style={styles.noteBox}>{data.jobDescription}</Text>
          </View>
        ) : null}

        <LineTable fallbackAmount={money(data.laborCost)} items={data.laborItems} title="Labor" />
        <MaterialsTable materials={data.materials} />

        <View style={styles.summary} wrap={false}>
          {returnTotal ? <SummaryRow label="Minus returns" value={`-${money(returnTotal)}`} /> : null}
          <SummaryRow label="Net materials" value={money(data.materialsSubtotal)} />
          <SummaryRow label={`Tax (${data.materialTaxRate.toString()}%)`} last value={money(data.materialTaxAmount)} />
        </View>

        <PaymentsTable payments={data.payments} />

        <View style={styles.summary} wrap={false}>
          <SummaryRow label="Final cost" value={money(data.finalCost)} />
          <SummaryRow label="Deposits paid" value={money(data.depositPaid)} />
          <SummaryRow label="Amount paid" value={money(data.amountPaid)} />
          <SummaryRow label="Balance due" last strong value={money(data.balanceDue)} />
        </View>

        <Text
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          style={styles.footer}
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdfBuffer(data: InvoicePdfData) {
  return renderToBuffer(<InvoicePdfDocument data={data} />);
}
