import type { ReactNode } from "react";

import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

import type { PricingLineItem } from "../../jobs/_components/pricing-items";
import { existsSync } from "node:fs";
import path from "node:path";

export type EstimatePdfLineItem = {
  description: string;
  type?: "labor" | "material";
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  price: string;
};

export type EstimatePdfData = {
  companyEmail: string;
  companyLogoSrc?: string | null;
  companyName: string;
  companyPhone: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  dateBegin: Date | null;
  dateEnd: Date | null;
  estimateNumber: string;
  estimatedTotal: { toString: () => string };
  issuedAt: Date;
  jobDescription: string | null;
  jobTitle: string;
  laborCost: { toString: () => string };
  laborItems: PricingLineItem[];
  materialItems: EstimatePdfLineItem[];
  materialTaxAmount: { toString: () => string };
  materialTaxRate: { toString: () => string };
  materialsSubtotal: { toString: () => string };
  serviceLocation: string | null;
  validThrough: Date;
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

function registerEstimateFont() {
  if (!interFontFiles.every((font) => existsSync(font.src))) {
    return "Helvetica";
  }

  Font.register({
    family: "Inter",
    fonts: interFontFiles,
  });

  return "Inter";
}

const estimateFontFamily = registerEstimateFont();
const neutralBorder = "#d4d4d4";
const lightBorder = "#e5e5e5";
const subtleFill = "#fafafa";
const textMuted = "#525252";
const totalColor = "#0369a1";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#111111",
    fontFamily: estimateFontFamily,
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
  documentTitle: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 6,
  },
  documentMeta: {
    color: textMuted,
    gap: 3,
  },
  totalPanel: {
    borderColor: neutralBorder,
    borderRadius: 7,
    borderWidth: 1,
    minHeight: 112,
    paddingHorizontal: 9,
    paddingVertical: 9,
    textAlign: "right",
    width: 122,
  },
  totalLabel: {
    color: "#262626",
    fontSize: 10,
    marginBottom: 22,
  },
  totalAmount: {
    color: totalColor,
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 24,
  },
  totalMeta: {
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
    color: totalColor,
    fontSize: 12,
    fontWeight: 700,
  },
  paymentBox: {
    borderColor: neutralBorder,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
    marginBottom: 12,
    padding: 9,
  },
  footer: {
    bottom: 22,
    color: textMuted,
    fontSize: 8,
    left: 24,
    position: "absolute",
    right: 24,
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

function maybeDate(value: Date | null) {
  return value ? format(value, "MMM d, yyyy") : "Not scheduled";
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
  emptyLabel,
  fallbackAmount,
  items,
  title,
}: {
  emptyLabel: string;
  fallbackAmount?: string;
  items: EstimatePdfLineItem[];
  title: string;
}) {
  const keyedLineItems = keyedItems(items, (item) => [
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
        {keyedLineItems.length ? (
          keyedLineItems.map(({ item, key }, index) => (
            <View key={key} style={index === keyedLineItems.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.cell, styles.descriptionCell]}>{dash(item.description)}</Text>
              <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>{dash(item.quantity)}</Text>
              <Text style={[styles.cell, styles.unitCell, styles.textRight]}>{dash(item.unit)}</Text>
              <Text style={[styles.cell, styles.rateCell, styles.textRight]}>{optionalMoney(item.unitPrice)}</Text>
              <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{optionalMoney(item.price)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.tableRowLast}>
            <Text style={[styles.cell, styles.descriptionCell]}>{emptyLabel}</Text>
            <Text style={[styles.cell, styles.qtyCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.unitCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.rateCell, styles.textRight]}>-</Text>
            <Text style={[styles.cell, styles.amountCell, styles.textRight]}>{fallbackAmount ?? "-"}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function EstimatePdfDocument({ data }: { data: EstimatePdfData }) {
  const paymentAmount = Number(data.estimatedTotal.toString()) / 2;

  return (
    <Document title={`Estimate ${data.estimateNumber}`}>
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

            <Text style={styles.documentTitle}>Estimate</Text>
            <View style={styles.documentMeta}>
              <Text>Estimate #{data.estimateNumber}</Text>
              <Text>Issued {format(data.issuedAt, "MMM d, yyyy")}</Text>
              <Text>Valid through {format(data.validThrough, "MMM d, yyyy")}</Text>
            </View>
          </View>

          <View style={styles.totalPanel}>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalAmount}>{money(data.estimatedTotal)}</Text>
            <Text style={styles.totalMeta}>valid through {format(data.validThrough, "MMM d, yyyy")}</Text>
          </View>
        </View>

        <View style={styles.infoGrid} wrap={false}>
          <InfoBox label="Prepared For">
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

        <LineTable emptyLabel="No labor line items." items={data.laborItems} title="Labor" />
        <LineTable emptyLabel="No material line items." items={data.materialItems} title="Materials" />

        <View style={styles.summary} wrap={false}>
          <SummaryRow label="Materials subtotal" value={money(data.materialsSubtotal)} />
          <SummaryRow label={`Tax (${data.materialTaxRate.toString()}%)`} value={money(data.materialTaxAmount)} />
          <SummaryRow label="Estimated total" last strong value={money(data.estimatedTotal)} />
        </View>

        <View style={styles.paymentBox} wrap={false}>
          <Text style={styles.strong}>Payment Schedule</Text>
          <SummaryRow label="1st payment due before work begins" value={money(paymentAmount)} />
          <SummaryRow label="2nd payment due when the job is completed" value={money(paymentAmount)} />
          <Text>
            Any additional work or materials not included in this estimate will be reviewed with the customer and billed
            as an extra charge.
          </Text>
          <Text style={styles.strong}>Please make all checks payable to: {data.companyName}</Text>
          <Text style={styles.strong}>Thank you for your business!</Text>
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

export async function renderEstimatePdfBuffer(data: EstimatePdfData) {
  return renderToBuffer(<EstimatePdfDocument data={data} />);
}
