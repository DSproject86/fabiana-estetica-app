import "server-only";
import { prisma } from "@/lib/db";
import type { Db } from "@/lib/schedule/queries";

/**
 * Chiave del lock che serializza tutto ciò che cambia l'occupazione del calendario
 * (prenotazioni, blocchi, eccezioni, settimana tipo). Valore arbitrario ma fisso.
 */
const BOOKING_LOCK_KEY = 7_042_026_001;

/**
 * Esegue `fn` in una transazione dopo aver preso pg_advisory_xact_lock: il lock è legato
 * alla transazione e si libera da solo a commit/rollback, quindi funziona anche passando
 * dal pooler di Neon (un lock di sessione no).
 */
export async function withBookingLock<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOKING_LOCK_KEY}::bigint)`;
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}
