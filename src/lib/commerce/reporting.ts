type MoneyValue = number | string | { toString(): string };

// A custom refund allocates its tax proportionally; subtracting the full original
// tax from a partial refund would understate sales refunds.
export function refundLineSales(item: {
  unitPrice: MoneyValue;
  returnQuantity: number;
  discountAmount: MoneyValue;
  taxAmount: MoneyValue;
  lineRefund: MoneyValue;
}) {
  const net = Math.max(Number(item.unitPrice) * item.returnQuantity - Number(item.discountAmount), 0);
  const gross = net + Number(item.taxAmount);
  return gross > 0 ? (Number(item.lineRefund) * net) / gross : 0;
}
