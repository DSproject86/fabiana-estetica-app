import "server-only";
import { withBookingLock } from "@/lib/availability/lock";
import { formatEuro } from "@/lib/money";
import type { Db } from "@/lib/schedule/queries";
import { dayKeyToDbDate, todayKey } from "@/lib/time/rome";
import type { Coverage } from "./rules";
import { paymentDayProblem, type FieldErrors, type PackageInput, type PaymentInput } from "./validation";

/**
 * Operazioni su pacchetti e pagamenti. Passano dallo stesso lock dell'agenda: sedute e residuo si
 * ricontrollano dentro la transazione, così due telefoni insieme non superano mai sedute o prezzo.
 */

export type PackageResult<T = object> = ({ ok: true } & T) | { ok: false; error?: string; fieldErrors?: FieldErrors };

export const PACKAGE_NOT_FOUND = "Pacchetto non trovato.";
export const PAYMENT_NOT_FOUND = "Pagamento non trovato.";

async function usage(tx: Db, packageId: string) {
  const [items, paid] = await Promise.all([
    tx.appointmentItem.count({ where: { clientPackageId: packageId } }),
    tx.packagePayment.aggregate({ where: { packageId }, _sum: { amountCents: true } }),
  ]);
  return { sessionsInApp: items, paidCents: paid._sum.amountCents ?? 0 };
}

async function coverageProblem(tx: Db, c: Coverage): Promise<string | null> {
  if (c.serviceId && !(await tx.service.findUnique({ where: { id: c.serviceId }, select: { id: true } }))) {
    return "Il servizio scelto non esiste più.";
  }
  if (c.categoryId && !(await tx.serviceCategory.findUnique({ where: { id: c.categoryId }, select: { id: true } }))) {
    return "La categoria scelta non esiste più.";
  }
  return null;
}

// ─────────────── Vendita, modifica, eliminazione, archivio ───────────────

export function sellPackage(input: {
  clientId: string;
  templateId: string | null;
  data: PackageInput;
  initialPayment: PaymentInput | null;
  now?: Date;
}): Promise<PackageResult<{ packageId: string }>> {
  const now = input.now ?? new Date();
  return withBookingLock<PackageResult<{ packageId: string }>>(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { anonymizedAt: true } });
    if (!client || client.anonymizedAt) return { ok: false, error: "Cliente non trovata." };
    const problem = await coverageProblem(tx, input.data.coverage);
    if (problem) return { ok: false, fieldErrors: { coverage: problem } };
    const template = input.templateId
      ? await tx.packageTemplate.findUnique({ where: { id: input.templateId }, select: { id: true } })
      : null;

    if (input.initialPayment) {
      const dayProblem = paymentDayProblem(input.initialPayment.paidOn, todayKey(now));
      if (dayProblem) return { ok: false, fieldErrors: { paidOn: dayProblem } };
      if (input.initialPayment.amount > input.data.price) {
        return { ok: false, fieldErrors: { amount: `L'acconto supera il prezzo del pacchetto (${formatEuro(input.data.price)}).` } };
      }
    }

    const { coverage, price, ...rest } = input.data;
    const created = await tx.clientPackage.create({
      data: {
        clientId: input.clientId,
        templateId: template?.id ?? null,
        ...coverage,
        ...rest,
        priceCents: price,
        ...(input.initialPayment
          ? {
              payments: {
                create: {
                  amountCents: input.initialPayment.amount,
                  method: input.initialPayment.method,
                  paidOn: dayKeyToDbDate(input.initialPayment.paidOn),
                  note: input.initialPayment.note,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    return { ok: true, packageId: created.id };
  });
}

/** Non si scende sotto le sedute già usate né sotto quanto già pagato. */
export function updatePackage(packageId: string, data: PackageInput): Promise<PackageResult> {
  return withBookingLock<PackageResult>(async (tx) => {
    const pkg = await tx.clientPackage.findUnique({ where: { id: packageId }, select: { id: true } });
    if (!pkg) return { ok: false, error: PACKAGE_NOT_FOUND };
    const problem = await coverageProblem(tx, data.coverage);
    if (problem) return { ok: false, fieldErrors: { coverage: problem } };

    const { sessionsInApp, paidCents } = await usage(tx, packageId);
    const fieldErrors: FieldErrors = {};
    if (data.sessionsUsedBefore + sessionsInApp > data.totalSessions) {
      const min = data.sessionsUsedBefore + sessionsInApp;
      fieldErrors.totalSessions = `Ne sono già state usate ${min} (${data.sessionsUsedBefore} prima dell'app, ${sessionsInApp} nell'app): almeno ${min}.`;
    }
    if (data.price < paidCents) {
      fieldErrors.price = `Sono già stati pagati ${formatEuro(paidCents)}: il prezzo non può essere più basso.`;
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const { coverage, price, ...rest } = data;
    await tx.clientPackage.update({ where: { id: packageId }, data: { ...coverage, ...rest, priceCents: price } });
    return { ok: true };
  });
}

/** Solo un pacchetto senza pagamenti né sedute scalate (altrimenti si archivia). */
export function deletePackage(packageId: string): Promise<PackageResult<{ clientId: string }>> {
  return withBookingLock<PackageResult<{ clientId: string }>>(async (tx) => {
    const pkg = await tx.clientPackage.findUnique({ where: { id: packageId }, select: { id: true, clientId: true } });
    if (!pkg) return { ok: false, error: PACKAGE_NOT_FOUND };
    const [sessionsInApp, payments] = await Promise.all([
      tx.appointmentItem.count({ where: { clientPackageId: packageId } }),
      tx.packagePayment.count({ where: { packageId } }),
    ]);
    if (sessionsInApp > 0 || payments > 0) {
      return { ok: false, error: "Ha già pagamenti o sedute scalate: non si può eliminare, si può solo archiviare." };
    }
    await tx.clientPackage.delete({ where: { id: packageId } });
    return { ok: true, clientId: pkg.clientId };
  });
}

export function setPackageArchived(packageId: string, archived: boolean, now = new Date()): Promise<PackageResult> {
  return withBookingLock<PackageResult>(async (tx) => {
    const updated = await tx.clientPackage.updateMany({
      where: { id: packageId },
      data: { closedAt: archived ? now : null },
    });
    return updated.count === 1 ? { ok: true } : { ok: false, error: PACKAGE_NOT_FOUND };
  });
}

// ─────────────── Pagamenti ───────────────

function overpaid(amount: number, dueCents: number): FieldErrors {
  return {
    amount:
      dueCents === 0
        ? "Il pacchetto è già pagato tutto."
        : `L'importo supera il residuo da pagare (${formatEuro(dueCents)}).`,
  };
}

export function addPayment(packageId: string, p: PaymentInput, now = new Date()): Promise<PackageResult> {
  const dayProblem = paymentDayProblem(p.paidOn, todayKey(now));
  if (dayProblem) return Promise.resolve({ ok: false, fieldErrors: { paidOn: dayProblem } });
  return withBookingLock<PackageResult>(async (tx) => {
    const pkg = await tx.clientPackage.findUnique({ where: { id: packageId }, select: { priceCents: true } });
    if (!pkg) return { ok: false, error: PACKAGE_NOT_FOUND };
    const { paidCents } = await usage(tx, packageId);
    const due = Math.max(0, pkg.priceCents - paidCents);
    if (p.amount > due) return { ok: false, fieldErrors: overpaid(p.amount, due) };
    await tx.packagePayment.create({
      data: { packageId, amountCents: p.amount, method: p.method, paidOn: dayKeyToDbDate(p.paidOn), note: p.note },
    });
    return { ok: true };
  });
}

export function updatePayment(paymentId: string, p: PaymentInput, now = new Date()): Promise<PackageResult<{ packageId: string }>> {
  const dayProblem = paymentDayProblem(p.paidOn, todayKey(now));
  if (dayProblem) return Promise.resolve({ ok: false, fieldErrors: { paidOn: dayProblem } });
  return withBookingLock<PackageResult<{ packageId: string }>>(async (tx) => {
    const payment = await tx.packagePayment.findUnique({
      where: { id: paymentId },
      select: { amountCents: true, packageId: true, package: { select: { priceCents: true } } },
    });
    if (!payment) return { ok: false, error: PAYMENT_NOT_FOUND };
    const { paidCents } = await usage(tx, payment.packageId);
    const due = Math.max(0, payment.package.priceCents - (paidCents - payment.amountCents));
    if (p.amount > due) return { ok: false, fieldErrors: overpaid(p.amount, due) };
    await tx.packagePayment.update({
      where: { id: paymentId },
      data: { amountCents: p.amount, method: p.method, paidOn: dayKeyToDbDate(p.paidOn), note: p.note },
    });
    return { ok: true, packageId: payment.packageId };
  });
}

export function deletePayment(paymentId: string): Promise<PackageResult<{ packageId: string }>> {
  return withBookingLock<PackageResult<{ packageId: string }>>(async (tx) => {
    const payment = await tx.packagePayment.findUnique({ where: { id: paymentId }, select: { packageId: true } });
    if (!payment) return { ok: false, error: PAYMENT_NOT_FOUND };
    await tx.packagePayment.delete({ where: { id: paymentId } });
    return { ok: true, packageId: payment.packageId };
  });
}
