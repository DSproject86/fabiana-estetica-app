"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  cancelAppointment,
  createAdminAppointment,
  rescheduleAppointment,
  setAmountCollected,
  setDone,
  setNoShow,
  updateAppointmentServices,
} from "@/lib/agenda/mutations";
import { parseServiceIds, parseTime } from "@/lib/booking/params";
import { monthOf } from "@/lib/booking/calendar";
import { createClientByAdmin, type AdminClientField, type ClientMatch } from "@/lib/clients/adminClients";
import { parseEuroToCents } from "@/lib/money";
import {
  sendAppointmentCancelledEmail,
  sendAppointmentChangedEmail,
  sendBookingConfirmedEmail,
} from "@/lib/notifications/appointmentEmails";
import { dayKeyOf, instantAt, isValidDayKey, timeToMinutes } from "@/lib/time/rome";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.
// Le regole (stati ammessi, disponibilità, lock) stanno in src/lib/agenda/mutations.ts.

export type ActionState = { error?: string };
export type Esito = "nuovo" | "spostato" | "servizi" | "annullato";

function refresh() {
  revalidatePath("/admin/agenda", "layout");
  revalidatePath("/admin/statistiche");
  revalidatePath("/admin/promemoria");
}

function backToAgenda(esito: Esito, appointmentId: string, startsAt: Date, emailed: boolean): never {
  refresh();
  const q = new URLSearchParams({ mese: monthOf(dayKeyOf(startsAt)), esito, id: appointmentId });
  if (emailed) q.set("email", "1");
  redirect(`/admin/agenda?${q}`);
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const checked = (formData: FormData, name: string) => formData.get(name) === "on" || formData.get(name) === "1";

/** Giorno + ora dal modulo; con "Fuori orario" serve anche la conferma esplicita. */
function readStart(formData: FormData): { startsAt: Date; outside: boolean } | { error: string } {
  const day = field(formData, "giorno");
  const time = parseTime(field(formData, "ora"));
  const minutes = time ? timeToMinutes(time) : null;
  if (!isValidDayKey(day) || minutes === null) return { error: "Scegli giorno e orario." };
  const outside = checked(formData, "fuori");
  if (outside && !checked(formData, "confermaFuori")) {
    return { error: "Conferma che l'appuntamento è fuori dall'orario di lavoro." };
  }
  return { startsAt: instantAt(day, minutes), outside };
}

// ─────────────── Fatto, importo, Non presentata ───────────────

export async function toggleDoneAction(
  appointmentId: string,
  done: boolean,
): Promise<{ error?: string; amountCents?: number | null }> {
  await requireAdmin();
  const result = await setDone({ appointmentId, done });
  refresh();
  return result.ok ? { amountCents: result.amountCollectedCents } : { error: result.error };
}

export async function saveAmountAction(appointmentId: string, text: string): Promise<{ error?: string; amountCents?: number }> {
  await requireAdmin();
  const cents = parseEuroToCents(text);
  if (cents === null) return { error: "Scrivi un importo valido (es. 45 o 45,50)." };
  const result = await setAmountCollected({ appointmentId, cents });
  refresh();
  return result.ok ? { amountCents: cents } : { error: result.error };
}

export async function toggleNoShowAction(appointmentId: string, noShow: boolean): Promise<ActionState> {
  await requireAdmin();
  const result = await setNoShow({ appointmentId, noShow });
  refresh();
  return result.ok ? {} : { error: result.error };
}

// ─────────────── Annulla ───────────────

export async function cancelAppointmentAction(
  appointmentId: string,
  notify: boolean,
  confirmDone = false,
): Promise<ActionState> {
  await requireAdmin();
  const result = await cancelAppointment({ appointmentId, confirmDone });
  if (!result.ok) return { error: result.error };
  if (notify) after(() => sendAppointmentCancelledEmail(appointmentId).then(() => undefined));
  backToAgenda("annullato", appointmentId, result.startsAt, notify);
}

// ─────────────── Nuova cliente ───────────────

export type ClientFormState = {
  fieldErrors?: Partial<Record<AdminClientField, string>>;
  duplicates?: ClientMatch[];
  emailTaken?: boolean;
  values?: Record<AdminClientField, string>;
};

export async function createClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  await requireAdmin();
  const values = {
    firstName: field(formData, "firstName"),
    lastName: field(formData, "lastName"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
  };
  const result = await createClientByAdmin(values, formData.get("force") === "1");
  if (!result.ok) {
    return "fieldErrors" in result
      ? { fieldErrors: result.fieldErrors, values }
      : { duplicates: result.duplicates, emailTaken: result.emailTaken, values };
  }
  redirect(`/admin/agenda/nuovo?cliente=${result.clientId}`);
}

// ─────────────── Nuovo appuntamento, Sposta, Servizi ───────────────

export async function createAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const start = readStart(formData);
  if ("error" in start) return start;
  const clientId = field(formData, "cliente");
  const result = await createAdminAppointment({
    clientId,
    serviceIds: parseServiceIds(field(formData, "s")),
    startsAt: start.startsAt,
    noBuffer: field(formData, "pausa") === "no",
    ignoreWorkingHours: start.outside,
  });
  if (!result.ok) return { error: result.error };
  const notify = checked(formData, "email");
  if (notify) after(() => sendBookingConfirmedEmail(result.appointmentId).then(() => undefined));
  backToAgenda("nuovo", result.appointmentId, result.startsAt, notify);
}

export async function moveAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const start = readStart(formData);
  if ("error" in start) return start;
  const appointmentId = field(formData, "id");
  const result = await rescheduleAppointment({
    appointmentId,
    startsAt: start.startsAt,
    noBuffer: field(formData, "pausa") === "no",
    ignoreWorkingHours: start.outside,
  });
  if (!result.ok) return { error: result.error };
  const notify = result.changed && checked(formData, "email");
  if (notify) {
    const previous = result.previousStartsAt;
    after(() => sendAppointmentChangedEmail(appointmentId, previous).then(() => undefined));
  }
  backToAgenda("spostato", appointmentId, start.startsAt, notify);
}

export async function updateServicesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const appointmentId = field(formData, "id");
  const result = await updateAppointmentServices({
    appointmentId,
    serviceIds: parseServiceIds(field(formData, "s")),
    keepItemIds: parseServiceIds(field(formData, "v")),
    noBuffer: field(formData, "pausa") === "no",
    ignoreWorkingHours: checked(formData, "fuori"),
  });
  if (!result.ok) return { error: result.error };
  const notify = checked(formData, "email");
  if (notify) after(() => sendAppointmentChangedEmail(appointmentId, null).then(() => undefined));
  backToAgenda("servizi", appointmentId, result.startsAt, notify);
}
