import { PrismaClient } from "@prisma/client";

// Un solo client Prisma per processo (in sviluppo l'hot reload ne creerebbe molti).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
