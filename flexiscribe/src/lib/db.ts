import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare const globalThis: {
  prismaGlobal: PrismaClient;
} & typeof global;

/**
 * Sanitize the DATABASE_URL for use with the `pg` driver.
 *
 * Neon's pooler endpoint (hostname contains "-pooler") uses PgBouncer, which
 * does NOT support SCRAM-SHA-256-PLUS (TLS channel binding). Passing
 * `channel_binding=require` to the `pg` npm package against a pooler causes
 * every connection attempt to fail. We strip it here so the connection
 * parameter the driver sees is always `channel_binding=disable`.
 */
function sanitizeConnectionString(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    // Not a valid URL (shouldn't happen, but don't crash startup)
    return url;
  }
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

// Cache the Prisma instance globally across hot-reloads in development and
// across warm lambda invocations in production (one client per Node.js process).
const prisma = globalThis.prismaGlobal ?? createPrismaClient();

export default prisma;

// Assign to global so the same instance is reused if the module is re-executed
// (Next.js hot-reload in dev, or module cache re-initialisation in some hosts).
globalThis.prismaGlobal = prisma;