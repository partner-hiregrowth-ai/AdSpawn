import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Retry wrapper for transient Supabase connection drops
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnectionError = err?.message?.includes("Can't reach database server") ||
        err?.code === 'P1001' || err?.code === 'P1017';
      if (isConnectionError && attempt < retries) {
        await prisma.$disconnect();
        await new Promise(r => setTimeout(r, attempt * 500));
        await prisma.$connect();
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}
