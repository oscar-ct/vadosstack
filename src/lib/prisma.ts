import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

const TRANSIENT_DATABASE_ERROR_CODES = new Set(["P1001", "P1002"]);

export async function withTransientPrismaReadRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const isTransientConnectionError =
      error instanceof Prisma.PrismaClientKnownRequestError && TRANSIENT_DATABASE_ERROR_CODES.has(error.code);

    if (!isTransientConnectionError) throw error;

    await new Promise((resolve) => setTimeout(resolve, 350));
    return operation();
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
