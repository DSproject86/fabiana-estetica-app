import { execSync } from "node:child_process";

/**
 * Prepara il database di test con `prisma migrate deploy` (non distruttivo).
 * Va usato un database LOCALE creato apposta (es. `createdb fabiana_test`): i test svuotano le
 * proprie tabelle a ogni caso, quindi qui si rifiuta qualunque host che non sia locale.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Imposta TEST_DATABASE_URL (Postgres locale usa-e-getta) per npm run test:db.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`TEST_DATABASE_URL deve puntare a un database locale (trovato: ${host}). Mai Neon.`);
  }
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
