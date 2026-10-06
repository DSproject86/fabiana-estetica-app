"use server";

import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/client";
import { createAppointment } from "@/lib/availability/createAppointment";
import { bookingQuery, parseBookingParams, type BookingErrorCode } from "@/lib/booking/params";
import { sendNewBookingEmailsInBackground } from "@/lib/notifications/appointmentEmails";
import { instantAt, timeToMinutes } from "@/lib/time/rome";

const ERROR_CODES: Record<"INVALID" | "SLOT_TAKEN" | "SLOT_UNAVAILABLE", BookingErrorCode> = {
  INVALID: "servizi",
  SLOT_TAKEN: "preso",
  SLOT_UNAVAILABLE: "non-prenotabile",
};

export async function confirmBookingAction(formData: FormData) {
  const client = await requireClient();
  const { services, day, time } = parseBookingParams({
    s: String(formData.get("s") ?? ""),
    giorno: String(formData.get("giorno") ?? ""),
    ora: String(formData.get("ora") ?? ""),
  });
  const minutes = time ? timeToMinutes(time) : null;
  if (!day || minutes === null || services.length === 0) {
    redirect(`/prenota${bookingQuery({ services, day, error: "non-prenotabile" })}`);
  }

  const result = await createAppointment({
    clientId: client.id,
    serviceIds: services,
    startsAt: instantAt(day, minutes),
    actor: "CLIENT",
  });

  if (!result.ok) {
    // Si torna agli orari dello stesso giorno, con i servizi ancora spuntati.
    redirect(`/prenota${bookingQuery({ services, day, error: result.code === "LIMIT" ? result.limit : ERROR_CODES[result.code] })}`);
  }
  // Conferma alla cliente e avviso agli admin dopo la risposta: un invio non riuscito non blocca niente.
  sendNewBookingEmailsInBackground(result.appointmentId);
  redirect(`/prenota/confermata/${result.appointmentId}`);
}
