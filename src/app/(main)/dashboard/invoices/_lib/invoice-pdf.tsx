import type { ReactNode } from "react";

import { Document, Font, Image, Page, Path, renderToBuffer, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
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
  referenceNumber?: string | null;
};

export type InvoicePdfData = {
  amountPaid: { toString: () => string };
  balanceDue: { toString: () => string };
  companyAddress?: string | null;
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
  taxableItemsLabel: string;
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

const neutralBorder = "#dddddd";
const lightBorder = "#eeeeee";
const subtleFill = "#ffffff";
const innerGridBorder = "#e3e3e3";
const textMuted = "#525252";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: invoiceFontFamily,
    fontSize: 8.0,
    lineHeight: 1.22,
    paddingBottom: 20,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
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
    marginBottom: 13,
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
    marginBottom: 5,
  },
  muted: {
    color: textMuted,
  },
  companyAddress: {
    color: textMuted,
    fontSize: 8.8,
    lineHeight: 1.25,
    marginBottom: 2.5,
  },
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 0,
  },
  contactItem: {
    alignItems: "center",
    color: textMuted,
    flexDirection: "row",
    fontSize: 8.8,
    gap: 3,
  },
  contactIcon: {
    color: textMuted,
    height: 8,
    width: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
  },
  invoiceMeta: {
    color: textMuted,
    gap: 2,
    fontSize: 8.8,
  },
  balancePanel: {
    borderColor: neutralBorder,
    borderRadius: 7,
    borderWidth: 0.8,
    minHeight: 104,
    paddingHorizontal: 9,
    paddingVertical: 8,
    textAlign: "right",
    width: 108,
  },
  balanceLabel: {
    color: "#262626",
    fontSize: 10,
    marginBottom: 18,
  },
  balanceAmount: {
    color: "#be123c",
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 20,
  },
  balanceDue: {
    color: "#262626",
    fontSize: 9.5,
  },
  infoGrid: {
    backgroundColor: "#ffffff",
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 0.75,
    marginBottom: 8,
    overflow: "hidden",
  },
  infoGridRow: {
    flexDirection: "row",
  },
  infoCell: {
    flex: 1,
    gap: 3,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  infoCellRightBorder: {
    borderRightColor: innerGridBorder,
    borderRightWidth: 0.55,
  },
  infoCellBottomBorder: {
    borderBottomColor: innerGridBorder,
    borderBottomWidth: 0.55,
  },
  infoLabel: {
    alignItems: "center",
    color: textMuted,
    flexDirection: "row",
    fontSize: 8.5,
    fontWeight: 700,
    gap: 4,
  },
  infoIcon: {
    color: textMuted,
    height: 9,
    width: 9,
  },
  infoValue: {
    color: "#111111",
    fontSize: 8.75,
    gap: 1,
  },
  sectionLabel: {
    fontSize: 9.25,
    fontWeight: 700,
  },
  strong: {
    fontWeight: 700,
  },
  section: {
    gap: 4,
    marginBottom: 7,
  },
  noteBox: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 0.75,
    padding: 7,
  },
  table: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 0.75,
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: subtleFill,
    borderBottomColor: neutralBorder,
    borderBottomWidth: 0.75,
    flexDirection: "row",
    fontWeight: 700,
  },
  tableRow: {
    borderBottomColor: lightBorder,
    borderBottomWidth: 0.7,
    flexDirection: "row",
    minHeight: 19,
  },
  tableRowLast: {
    flexDirection: "row",
    minHeight: 19,
  },
  cell: {
    paddingHorizontal: 7,
    paddingVertical: 3.75,
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
  referenceCell: {
    width: 58,
  },
  summary: {
    alignSelf: "flex-end",
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 0.75,
    marginBottom: 7,
    minWidth: 185,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 6,
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
    fontSize: 9.5,
    fontWeight: 700,
    textAlign: "right",
  },
  summaryTotal: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: 700,
  },
  summaryRule: {
    borderTopColor: lightBorder,
    borderTopWidth: 1,
    marginBottom: 5,
    marginTop: 1,
  },
  footer: {
    bottom: 18,
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

function negativeOptionalMoney(value?: string) {
  return value ? `-${money(value)}` : "-";
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

function MailIcon() {
  return (
    <Svg style={styles.contactIcon} viewBox="0 0 24 24">
      <Path d="M4 6h16v12H4z" fill="none" stroke={textMuted} strokeWidth={2} />
      <Path d="m4 7 8 6 8-6" fill="none" stroke={textMuted} strokeWidth={2} />
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg style={styles.contactIcon} viewBox="0 0 24 24">
      <Path
        d="M6 4h4l2 5-3 2c1 2 3 4 5 5l2-3 5 2v4c0 1-1 2-2 2C10 21 3 14 3 6c0-1 1-2 3-2z"
        fill="none"
        stroke={textMuted}
        strokeWidth={2}
      />
    </Svg>
  );
}

function SmallIcon({ kind }: { kind: "calendar" | "job" | "location" | "user" }) {
  const path =
    kind === "user"
      ? "M12 12c3 0 5-2 5-5s-2-5-5-5-5 2-5 5 2 5 5 5zm-8 9c1-5 5-7 8-7s7 2 8 7"
      : kind === "job"
        ? "M8 7V5c0-1 1-2 2-2h4c1 0 2 1 2 2v2M4 7h16v12H4z"
        : kind === "calendar"
          ? "M5 4v4M19 4v4M4 8h16M5 6h14v14H5z"
          : "M12 21s7-5 7-11a7 7 0 0 0-14 0c0 6 7 11 7 11zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";

  return (
    <Svg style={styles.infoIcon} viewBox="0 0 24 24">
      <Path d={path} fill="none" stroke={textMuted} strokeWidth={2} />
    </Svg>
  );
}

function ContactRow({ email, phone }: { email: string; phone: string | null }) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactItem}>
        <MailIcon />
        <Text>{email}</Text>
      </View>
      {phone ? (
        <View style={styles.contactItem}>
          <PhoneIcon />
          <Text>{phone}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DetailCell({
  bottom = false,
  children,
  icon,
  label,
  right = false,
}: {
  bottom?: boolean;
  children: ReactNode;
  icon: "calendar" | "job" | "location" | "user";
  label: string;
  right?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoCell,
        ...(right ? [styles.infoCellRightBorder] : []),
        ...(bottom ? [styles.infoCellBottomBorder] : []),
      ]}
    >
      <View style={styles.infoLabel}>
        <SmallIcon kind={icon} />
        <Text>{label}</Text>
      </View>
      <View style={styles.infoValue}>{children}</View>
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

function PurchaseMaterialsTable({ materials }: { materials: InvoicePdfMaterial[] }) {
  const keyedMaterials = keyedItems(materials, (material) => [
    material.description,
    material.purchaseDate,
    material.vendor,
    material.quantity,
    material.unit,
    material.unitPrice,
    material.price,
  ]);

  return (
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
            <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{optionalMoney(material.price)}</Text>
          </View>
        ))
      ) : (
        <View style={styles.tableRowLast}>
          <Text style={[styles.cell, styles.descriptionCell]}>No material line items.</Text>
        </View>
      )}
    </View>
  );
}

function ReturnMaterialsTable({ materials }: { materials: InvoicePdfMaterial[] }) {
  const keyedMaterials = keyedItems(materials, (material) => [
    material.description,
    material.purchaseDate,
    material.vendor,
    material.quantity,
    material.unit,
    material.unitPrice,
    material.price,
  ]);

  if (!keyedMaterials.length) return null;

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.cell, styles.dateCell]}>Date</Text>
        <Text style={[styles.cell, styles.vendorCell]}>Vendor</Text>
        <Text style={[styles.cell, styles.descriptionCell]}>Returns</Text>
        <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>Qty</Text>
        <Text style={[styles.cell, styles.unitCell, styles.textRight]}>Unit</Text>
        <Text style={[styles.cell, styles.rateCell, styles.textRight]}>Rate</Text>
        <Text style={[styles.cell, styles.amountCell, styles.textRight]}>Amount</Text>
      </View>
      {keyedMaterials.map(({ item: material, key }, index) => (
        <View key={key} style={index === keyedMaterials.length - 1 ? styles.tableRowLast : styles.tableRow}>
          <Text style={[styles.cell, styles.dateCell]}>{materialDate(material.purchaseDate)}</Text>
          <Text style={[styles.cell, styles.vendorCell]}>{dash(material.vendor)}</Text>
          <Text style={[styles.cell, styles.descriptionCell]}>{dash(material.description)}</Text>
          <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>{dash(material.quantity)}</Text>
          <Text style={[styles.cell, styles.unitCell, styles.textRight]}>{dash(material.unit)}</Text>
          <Text style={[styles.cell, styles.rateCell, styles.textRight]}>{optionalMoney(material.unitPrice)}</Text>
          <Text style={[styles.cell, styles.amountCell, styles.textRight]}>
            {negativeOptionalMoney(material.price)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PaymentsTable({ payments }: { payments: InvoicePdfPayment[] }) {
  const keyedPayments = keyedItems(payments, (payment) => [
    payment.paidOn.toISOString(),
    payment.description,
    payment.method,
    payment.referenceNumber,
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
          <Text style={[styles.cell, styles.referenceCell]}>Ref #</Text>
          <Text style={[styles.cell, styles.amountCell, styles.textRight]}>Amount</Text>
        </View>
        {keyedPayments.length ? (
          keyedPayments.map(({ item: payment, key }, index) => (
            <View key={key} style={index === keyedPayments.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.cell, styles.dateCell]}>{shortDate(payment.paidOn)}</Text>
              <Text style={[styles.cell, styles.descriptionCell]}>{payment.description}</Text>
              <Text style={[styles.cell, styles.methodCell]}>{payment.method}</Text>
              <Text style={[styles.cell, styles.referenceCell]}>{payment.referenceNumber ?? "-"}</Text>
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
  const purchaseMaterials = data.materials.filter((material) => material.type !== "return");
  const returnMaterials = data.materials.filter((material) => material.type === "return");
  const returnTotal = returnMaterials.reduce((total, material) => total + Number(material.price || 0), 0);
  const subtotal = Number(data.laborCost.toString()) + Number(data.materialsSubtotal.toString());

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
                {data.companyAddress ? <Text style={styles.companyAddress}>{data.companyAddress}</Text> : null}
                <ContactRow email={data.companyEmail} phone={data.companyPhone} />
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
          <View style={styles.infoGridRow}>
            <DetailCell bottom icon="user" label="Bill To" right>
              <Text style={styles.strong}>{data.customerName ?? "No customer on file"}</Text>
              <Text style={styles.muted}>{data.customerEmail ?? "No email on file"}</Text>
              <Text style={styles.muted}>{data.customerPhone ?? "No phone on file"}</Text>
            </DetailCell>
            <DetailCell bottom icon="job" label="Job">
              <Text style={styles.strong}>{data.jobTitle}</Text>
            </DetailCell>
          </View>
          <View style={styles.infoGridRow}>
            <DetailCell icon="calendar" label="Schedule" right>
              <Text>Start: {maybeDate(data.dateBegin)}</Text>
              <Text>End: {maybeDate(data.dateEnd)}</Text>
            </DetailCell>
            <DetailCell icon="location" label="Service Location">
              <Text>{data.serviceLocation ?? "Not on file"}</Text>
            </DetailCell>
          </View>
        </View>

        {data.jobDescription ? (
          <View style={styles.section} wrap={false}>
            <SectionLabel label="Job Description" />
            <Text style={styles.noteBox}>{data.jobDescription}</Text>
          </View>
        ) : null}

        <LineTable fallbackAmount={money(data.laborCost)} items={data.laborItems} title="Labor" />
        <View style={styles.section}>
          <SectionLabel label="Materials" />
          <PurchaseMaterialsTable materials={purchaseMaterials} />
          <ReturnMaterialsTable materials={returnMaterials} />
        </View>

        <View style={styles.summary} wrap={false}>
          <SummaryRow label="Labor" value={money(data.laborCost)} />
          {returnTotal ? <SummaryRow label="Minus returns" value={`-${money(returnTotal)}`} /> : null}
          <SummaryRow label="Net materials" value={money(data.materialsSubtotal)} />
          <SummaryRow label="Subtotal" value={money(subtotal)} />
          <SummaryRow
            label={`Tax on ${data.taxableItemsLabel} (${data.materialTaxRate.toString()}%)`}
            value={money(data.materialTaxAmount)}
          />
          <View style={styles.summaryRule} />
          <SummaryRow label="Final cost" last strong value={money(data.finalCost)} />
        </View>

        <PaymentsTable payments={data.payments} />

        <View style={styles.summary} wrap={false}>
          <SummaryRow label="Final cost" value={money(data.finalCost)} />
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
