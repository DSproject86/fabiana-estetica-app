"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { isConfirmed, slotsFromForm, type OrariFormState } from "@/lib/schedule/form";
import {
  conflictsForBlock,
  conflictsForDay,
  conflictsForWeekdays,
} from "@/lib/schedule/queries";
import { validateSlots } from "@/lib/schedule/slots";
import {
  dayKeyToDbDate,
  dbDateToDayKey,
  instantAt,
  isValidDayKey,
  timeToMinutes,
  todayKey,
  weekdayOf,
} from "@/lib/time/rome";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.
// Nessuna azione cancella o modifica appuntamenti: in caso di conflitto si chiede conferma.

function done(section: string): never {
  revalidatePath("/admin/orari");
  redirect(`/admin/orari?sezione=${section}`);
}

const note = z
  .string()
  .trim()
  .max(120, "Massimo 120 caratteri.")
  .optional()
  .transform((v) => (v ? v : null));

// ─────────────── Settimana tipo ───────────────

export async function saveWeekday(
  weekday: number,
  _prev: OrariFormState,
  formData: FormData,
): Promise<OrariFormState> {
  await requireAdmin();
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { error: "Giorno non valido." };

  const parsed = slotsFromForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const extra = formData
    .getAll("applyTo")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7 && d !== weekday);
  const weekdays = [weekday, ...new Set(extra)];

  if (!isConfirmed(formData)) {
    const conflicts = await conflictsForWeekdays(weekdays, parsed.slots);
    if (conflicts.length > 0) return { conflicts };
  }

  await prisma.$transaction([
    prisma.weeklySlot.deleteMany({ where: { weekday: { in: weekdays } } }),
    prisma.weeklySlot.createMany({
      data: weekdays.flatMap((d) => parsed.slots.map((s) => ({ weekday: d, ...s }))),
    }),
  ]);
  done("settimana");
}

// ─────────────── Eccezioni per data ───────────────

const exceptionSchema = z.object({
  date: z.string().refine(isValidDayKey, "Scegli una data."),
  closed: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  note,
});

export async function saveException(
  id: string | null,
  _prev: OrariFormState,
  formData: FormData,
): Promise<OrariFormState> {
  await requireAdmin();
  const fields = exceptionSchema.safeParse({
    date: formData.get("date") ?? "",
    closed: formData.get("closed") ?? undefined,
    note: formData.get("note") ?? undefined,
  });
  if (!fields.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of fields.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const { date, closed } = fields.data;
  if (date < todayKey()) return { fieldErrors: { date: "La data è già passata." } };

  let slots: { startMinute: number; endMinute: number }[] = [];
  if (!closed) {
    const parsed = slotsFromForm(formData);
    if ("error" in parsed) return { error: parsed.error };
    if (parsed.slots.length === 0) {
      return { error: 'Aggiungi almeno una fascia oppure scegli "Chiuso tutto il giorno".' };
    }
    slots = parsed.slots;
  }

  const existing = await prisma.dateOverride.findUnique({ where: { date: dayKeyToDbDate(date) } });
  if (existing && existing.id !== id) {
    return { fieldErrors: { date: "Per questa data c'è già un'eccezione: modifica quella." } };
  }

  if (!isConfirmed(formData)) {
    const conflicts = await conflictsForDay(date, slots);
    if (conflicts.length > 0) return { conflicts };
  }

  await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.dateOverride.delete({ where: { id } }).catch(() => null);
    }
    await tx.dateOverride.create({
      data: {
        date: dayKeyToDbDate(date),
        closed,
        note: fields.data.note,
        slots: { create: slots },
      },
    });
  });
  done("eccezioni");
}

/** Eliminando un'eccezione torna a valere la settimana tipo: anche questo può creare conflitti. */
export async function deleteException(
  id: string,
  _prev: OrariFormState,
  formData: FormData,
): Promise<OrariFormState> {
  await requireAdmin();
  const override = await prisma.dateOverride.findUnique({ where: { id } });
  if (!override) done("eccezioni");

  if (!isConfirmed(formData)) {
    const day = dbDateToDayKey(override.date);
    const weekly = await prisma.weeklySlot.findMany({
      where: { weekday: weekdayOf(day) },
      select: { startMinute: true, endMinute: true },
    });
    const conflicts = await conflictsForDay(day, weekly);
    if (conflicts.length > 0) return { conflicts };
  }

  await prisma.dateOverride.delete({ where: { id } });
  done("eccezioni");
}

// ─────────────── Blocchi rapidi ───────────────

const blockSchema = z.object({
  date: z.string().refine(isValidDayKey, "Scegli una data."),
  start: z.string(),
  end: z.string(),
  reason: note,
});

export async function createBlock(_prev: OrariFormState, formData: FormData): Promise<OrariFormState> {
  await requireAdmin();
  const fields = blockSchema.safeParse({
    date: formData.get("date") ?? "",
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
    reason: formData.get("reason") ?? undefined,
  });
  if (!fields.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of fields.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }
  const { date, reason } = fields.data;
  const startMinute = timeToMinutes(fields.data.start);
  const endMinute = timeToMinutes(fields.data.end);
  if (startMinute === null || endMinute === null) {
    return { error: "Indica l'orario di inizio e di fine del blocco." };
  }
  const slotError = validateSlots([{ startMinute, endMinute }]);
  if (slotError) return { error: slotError };

  const startsAt = instantAt(date, startMinute);
  const endsAt = instantAt(date, endMinute);
  if (endsAt <= new Date()) return { error: "Questa fascia è già passata." };

  if (!isConfirmed(formData)) {
    const conflicts = await conflictsForBlock(startsAt, endsAt);
    if (conflicts.length > 0) return { conflicts };
  }

  await prisma.timeBlock.create({ data: { startsAt, endsAt, reason } });
  done("blocchi");
}

export async function deleteBlock(id: string): Promise<void> {
  await requireAdmin();
  await prisma.timeBlock.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/orari");
}
