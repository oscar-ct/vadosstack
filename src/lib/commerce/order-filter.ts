import type { Prisma } from "@prisma/client";

export function orderListWhere(ownerId: string, query = ""): Prisma.OrderWhereInput {
  return {
    ownerId,
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
            { paymentStatus: { contains: query, mode: "insensitive" } },
            { fulfillmentStatus: { contains: query, mode: "insensitive" } },
            { returns: { some: { returnNumber: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}
