import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { getReturnDispositionLabel, type ReturnRefundDocumentData } from "./return-data";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    color: "#18181b",
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 32,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#e4e4e7",
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 16,
    textAlign: "center",
  },
  logo: {
    height: 42,
    objectFit: "contain",
    width: 42,
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
  },
  muted: {
    color: "#71717a",
  },
  metaGrid: {
    borderBottomColor: "#e4e4e7",
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 14,
  },
  metaCell: {
    gap: 3,
    width: "50%",
  },
  label: {
    color: "#71717a",
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 11,
    fontWeight: 700,
  },
  item: {
    borderBottomColor: "#e4e4e7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemTotal: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
    width: 80,
  },
  twoCol: {
    borderBottomColor: "#e4e4e7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 24,
    paddingVertical: 14,
  },
  col: {
    flex: 1,
    gap: 4,
  },
  totals: {
    gap: 6,
    marginLeft: "auto",
    paddingVertical: 14,
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalFinal: {
    borderTopColor: "#e4e4e7",
    borderTopWidth: 1,
    fontSize: 13,
    fontWeight: 700,
    marginTop: 4,
    paddingTop: 8,
  },
  note: {
    borderTopColor: "#e4e4e7",
    borderTopWidth: 1,
    color: "#71717a",
    lineHeight: 1.5,
    paddingTop: 14,
    textAlign: "center",
  },
});

function ReturnReceiptPdf({ data }: { data: ReturnRefundDocumentData }) {
  return (
    <Document title={`Return Receipt ${data.returnNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image src={data.company.logoSrc} style={styles.logo} />
          <Text style={styles.title}>Return Receipt</Text>
          <Text style={styles.muted}>{data.company.name}</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Return Receipt</Text>
            <Text style={styles.value}>{data.returnNumber}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.label}>Return Date</Text>
            <Text style={styles.value}>{data.returnDate}</Text>
          </View>
          <View style={[styles.metaCell, { marginTop: 10 }]}>
            <Text style={styles.label}>Original Order</Text>
            <Text style={styles.value}>{data.orderNumber}</Text>
          </View>
          <View style={[styles.metaCell, { marginTop: 10 }]}>
            <Text style={styles.label}>Order Date</Text>
            <Text style={styles.value}>{data.orderDate}</Text>
          </View>
        </View>

        <View>
          {data.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.itemMain}>
                <Text style={styles.value}>{item.product}</Text>
                <Text style={styles.muted}>{[item.sku, item.category].filter(Boolean).join(" · ")}</Text>
                <Text style={styles.muted}>
                  Qty {item.returnQuantity} · {getReturnDispositionLabel(item.disposition)} · {item.unitPrice}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{item.lineRefund}</Text>
            </View>
          ))}
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{data.customerName}</Text>
            {data.shippingAddressLines.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
            {data.customerPhone ? <Text style={styles.muted}>{data.customerPhone}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Refund</Text>
            <Text style={styles.value}>{data.refundStatus}</Text>
            {data.refundMethod ? <Text style={styles.muted}>{data.refundMethod}</Text> : null}
            {data.refundReference ? <Text style={styles.muted}>Ref # {data.refundReference}</Text> : null}
          </View>
        </View>

        <View style={styles.totals}>
          <View style={[styles.totalRow, styles.totalFinal]}>
            <Text>Refund Amount</Text>
            <Text>{data.refundAmount}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          {data.customerNote ?? data.reason ?? "Please keep this receipt for your records."}
        </Text>
      </Page>
    </Document>
  );
}

export function renderReturnReceiptPdfBuffer(data: ReturnRefundDocumentData) {
  return renderToBuffer(<ReturnReceiptPdf data={data} />);
}
