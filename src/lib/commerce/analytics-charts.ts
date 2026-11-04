import { Prisma } from "@prisma/client";

export type SalesDay = { date: string; gross: number; discounts: number; refunds: number };
export function buildSalesTrend(days: SalesDay[], start: Date | null, end: Date) {
  const first =
    start ?? (days.length ? new Date(`${days[0].date}T00:00:00Z`) : new Date(end.getTime() - 30 * 86400000));
  const span = (end.getTime() - first.getTime()) / 86400000;
  const unit = span <= 45 ? "day" : span <= 120 ? "week" : span <= 1830 ? "month" : "year";
  function bucket(date: Date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    if (unit === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    if (unit === "month") d.setUTCDate(1);
    if (unit === "year") {
      d.setUTCMonth(0, 1);
    }
    return d;
  }
  const buckets = new Map<
    string,
    { date: string; gross: Prisma.Decimal; discounts: Prisma.Decimal; refunds: Prisma.Decimal }
  >();
  for (let date = bucket(first); date < end; ) {
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      gross: new Prisma.Decimal(0),
      discounts: new Prisma.Decimal(0),
      refunds: new Prisma.Decimal(0),
    });
    date = new Date(date);
    if (unit === "month") date.setUTCMonth(date.getUTCMonth() + 1);
    else if (unit === "year") date.setUTCFullYear(date.getUTCFullYear() + 1);
    else date.setUTCDate(date.getUTCDate() + (unit === "week" ? 7 : 1));
  }
  for (const day of days) {
    const value = buckets.get(
      bucket(new Date(`${day.date}T00:00:00Z`))
        .toISOString()
        .slice(0, 10),
    );
    if (value) {
      value.gross = value.gross.plus(day.gross);
      value.discounts = value.discounts.plus(day.discounts);
      value.refunds = value.refunds.plus(day.refunds);
    }
  }
  return {
    unit,
    points: [...buckets.values()].map((row) => ({
      date: row.date,
      gross: row.gross.toDecimalPlaces(2).toNumber(),
      net: row.gross.minus(row.discounts).minus(row.refunds).toDecimalPlaces(2).toNumber(),
    })),
  };
}

export function buildSalesWaterfall(data: {
  gross: number;
  shippingCharged: number;
  discounts: number;
  merchandiseRefunds: number;
  shippingRefunded: number;
  net: number;
}) {
  let balance = new Prisma.Decimal(0);
  const parts: Array<[string, number]> = [
    ["Merchandise", new Prisma.Decimal(data.gross).minus(data.shippingCharged).toNumber()],
    ["Shipping", data.shippingCharged],
    ["Discounts", data.discounts ? -data.discounts : 0],
    ["Product refunds", data.merchandiseRefunds ? -data.merchandiseRefunds : 0],
    ["Shipping refunds", data.shippingRefunded ? -data.shippingRefunded : 0],
  ];
  const rows = parts.map(([label, amount]) => {
    const before = balance;
    balance = balance.plus(amount);
    return {
      label,
      amount,
      range: [Prisma.Decimal.min(before, balance).toNumber(), Prisma.Decimal.max(before, balance).toNumber()],
      kind: amount < 0 ? "deduction" : "addition",
    };
  });
  rows.push({
    label: "Net sales",
    amount: data.net,
    range: [Math.min(0, data.net), Math.max(0, data.net)],
    kind: "total",
  });
  return rows;
}
