import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

export type OrderPdfLineItem = {
  category: string | null;
  id: string;
  lineTotal: string;
  product: string;
  quantity: number;
  sku: string | null;
  unitPrice: string;
};

export type OrderPdfData = {
  companyEmail: string | null;
  companyLogoSrc: string;
  companyName: string;
  companyPhone: string | null;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  discountAmount: string;
  estimatedDelivery: string | null;
  footerMessage: string;
  isPaid: boolean;
  items: OrderPdfLineItem[];
  orderDate: string;
  orderNumber: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  shippingAddressLines: string[];
  shippingAmount: string;
  shippingService: string | null;
  subtotal: string;
  taxAmount: string;
  taxRate: string;
  total: string;
  trackingNumber: string | null;
};

const styles = StyleSheet.create({
  page: {
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    color: "#18181b",
    fontFamily: "Helvetica",
    paddingHorizontal: 42,
    paddingVertical: 36,
  },
  receipt: {
    backgroundColor: "#ffffff",
    borderColor: "#d4d4d8",
    borderRadius: 12,
    borderWidth: 1,
    height: 720,
    overflow: "hidden",
    width: 420,
  },
  pageNumber: {
    color: "#71717a",
    fontSize: 7,
    position: "absolute",
    right: 18,
    top: 12,
  },
  header: {
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 24,
    paddingTop: 20,
    textAlign: "center",
  },
  logo: {
    height: 40,
    objectFit: "contain",
    width: 40,
  },
  title: {
    fontSize: 15,
    fontWeight: 500,
    marginTop: 8,
  },
  muted: {
    color: "#71717a",
  },
  tiny: {
    fontSize: 8,
  },
  small: {
    fontSize: 9,
  },
  text: {
    fontSize: 10,
  },
  section: {
    borderColor: "#e4e4e7",
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  twoCol: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  col: {
    flex: 1,
    gap: 3,
  },
  right: {
    textAlign: "right",
  },
  label: {
    color: "#71717a",
    fontSize: 8,
    fontWeight: 500,
  },
  value: {
    fontSize: 10,
    fontWeight: 500,
  },
  item: {
    borderColor: "#e4e4e7",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  itemIcon: {
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    color: "#71717a",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTotal: {
    fontSize: 10,
    fontWeight: 500,
    minWidth: 58,
    textAlign: "right",
  },
  totals: {
    gap: 7,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalFinal: {
    borderColor: "#e4e4e7",
    borderTopWidth: 1,
    marginTop: 2,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 500,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 500,
  },
  discount: {
    color: "#059669",
  },
  footer: {
    backgroundColor: "#fafafa",
    borderColor: "#e4e4e7",
    borderTopWidth: 1,
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 12,
    textAlign: "center",
  },
  footerText: {
    lineHeight: 1.35,
  },
});

const PDF_FINAL_PAGE_ITEM_LIMIT = 4;
const PDF_NON_FINAL_PAGE_ITEM_LIMIT = 10;

type OrderPdfPage = {
  items: OrderPdfLineItem[];
  pageNumber: number;
  showSummary: boolean;
};

function paginatePdfItems(items: OrderPdfLineItem[]): OrderPdfPage[] {
  if (items.length <= PDF_FINAL_PAGE_ITEM_LIMIT) {
    return [
      {
        items,
        pageNumber: 1,
        showSummary: true,
      },
    ];
  }

  const pages: OrderPdfPage[] = [];
  let remainingItems = items;

  while (remainingItems.length > PDF_FINAL_PAGE_ITEM_LIMIT) {
    const takeCount = Math.min(PDF_NON_FINAL_PAGE_ITEM_LIMIT, remainingItems.length - PDF_FINAL_PAGE_ITEM_LIMIT);

    pages.push({
      items: remainingItems.slice(0, takeCount),
      pageNumber: pages.length + 1,
      showSummary: false,
    });

    remainingItems = remainingItems.slice(takeCount);
  }

  pages.push({
    items: remainingItems,
    pageNumber: pages.length + 1,
    showSummary: true,
  });

  return pages;
}

function DetailPair({ label, value, right = false }: { label: string; right?: boolean; value: string }) {
  return (
    <View style={right ? [styles.col, styles.right] : styles.col}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function OrderPdfDocument({ data }: { data: OrderPdfData }) {
  const title = data.isPaid ? "Order Receipt" : "Order Confirmation";
  const pages = paginatePdfItems(data.items);

  return (
    <Document title={`${title} ${data.orderNumber}`}>
      {pages.map((page) => (
        <Page key={page.pageNumber} size="LETTER" style={styles.page}>
          <View style={styles.receipt}>
            {pages.length > 1 ? (
              <Text style={styles.pageNumber}>
                Page {page.pageNumber} of {pages.length}
              </Text>
            ) : null}
            <View style={styles.header}>
              <Image src={data.companyLogoSrc} style={styles.logo} />
              <Text style={styles.title}>{title}</Text>
              <Text style={[styles.small, styles.muted]}>
                {data.isPaid ? "Thank you for your purchase." : "Thank you for your order."}
              </Text>
            </View>

            <View style={[styles.section, styles.twoCol]}>
              <DetailPair label="Order Number" value={data.orderNumber} />
              <DetailPair label="Order Date" right value={data.orderDate} />
            </View>

            {page.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemIcon}>
                  <Text style={styles.small}>□</Text>
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.value}>{item.product || "Product name"}</Text>
                  <Text style={[styles.tiny, styles.muted]}>
                    {[item.sku, item.category].filter(Boolean).join(" · ")}
                  </Text>
                  <Text style={[styles.tiny, styles.muted]}>
                    {item.quantity} x {item.unitPrice}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{item.lineTotal}</Text>
              </View>
            ))}

            {page.showSummary ? (
              <>
                {data.isPaid ? (
                  <View style={[styles.section, styles.twoCol]}>
                    <DetailPair label="Estimated Delivery" value={data.estimatedDelivery ?? "Delivery date pending"} />
                    <View style={[styles.col, styles.right]}>
                      <Text style={styles.label}>Tracking</Text>
                      <Text style={styles.value}>{data.shippingService ?? "Shipping service pending"}</Text>
                      <Text style={[styles.tiny, styles.muted]}>
                        {data.trackingNumber ?? "Tracking number pending"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={[styles.section, styles.twoCol]}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Shipping Address</Text>
                    <Text style={styles.value}>{data.customerName || "Customer name"}</Text>
                    {data.shippingAddressLines.length ? (
                      data.shippingAddressLines.map((line) => (
                        <Text key={line} style={[styles.tiny, styles.muted]}>
                          {line}
                        </Text>
                      ))
                    ) : (
                      <Text style={[styles.tiny, styles.muted]}>Street address</Text>
                    )}
                    <Text style={[styles.tiny, styles.muted]}>{data.customerPhone ?? "Phone"}</Text>
                  </View>
                  <View style={[styles.col, styles.right]}>
                    {data.isPaid ? (
                      <>
                        <Text style={styles.label}>Payment Method</Text>
                        <Text style={styles.value}>{data.paymentMethod ?? "Payment method pending"}</Text>
                        {data.paymentReference ? (
                          <Text style={[styles.tiny, styles.muted]}>Ref # {data.paymentReference}</Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>Status</Text>
                        <Text style={styles.value}>Payment pending</Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={[styles.section, styles.totals]}>
                  <View style={styles.totalRow}>
                    <Text style={[styles.text, styles.muted]}>Subtotal</Text>
                    <Text style={styles.text}>{data.subtotal}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.text, styles.muted]}>Shipping</Text>
                    <Text style={styles.text}>{data.shippingAmount}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.text, styles.muted]}>Tax ({data.taxRate})</Text>
                    <Text style={styles.text}>{data.taxAmount}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.text, styles.muted]}>Discount</Text>
                    <Text style={[styles.text, styles.discount]}>-{data.discountAmount}</Text>
                  </View>
                  <View style={[styles.totalRow, styles.totalFinal]}>
                    <Text style={styles.totalLabel}>{data.isPaid ? "Total Paid" : "Order Total"}</Text>
                    <Text style={styles.totalValue}>{data.total}</Text>
                  </View>
                </View>

                <View style={styles.footer}>
                  <Text style={[styles.tiny, styles.muted, styles.footerText]}>
                    {data.footerMessage || "Thank you for your order. We appreciate your business."}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function renderOrderPdfBuffer(data: OrderPdfData) {
  return renderToBuffer(<OrderPdfDocument data={data} />);
}
