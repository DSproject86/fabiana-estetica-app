import { monthOf } from "@/lib/booking/calendar";
import { dayKeyOf, formatDayShort, formatTime } from "@/lib/time/rome";

/** Contenuto di una notifica push (letto da public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  /** Pagina da aprire al tocco (sempre un percorso interno). */
  url: string;
  /** Notifiche con lo stesso tag si sostituiscono invece di accumularsi. */
  tag: string;
};

/** "Nuova prenotazione" · "Giulia Bianchi · mar 14 ott 10:30 · Pulizia viso" → agenda su quel giorno. */
export function newBookingPush(a: {
  id: string;
  startsAt: Date;
  client: { firstName: string; lastName: string };
  items: { name: string }[];
}): PushPayload {
  const day = dayKeyOf(a.startsAt);
  return {
    title: "Nuova prenotazione",
    body: [`${a.client.firstName} ${a.client.lastName}`, `${formatDayShort(day)} ${formatTime(a.startsAt)}`, a.items.map((i) => i.name).join(", ")]
      .filter(Boolean)
      .join(" · "),
    url: `/admin/agenda?mese=${monthOf(day)}#giorno-${day}`,
    tag: `prenotazione-${a.id}`,
  };
}

export function testPush(deviceName: string): PushPayload {
  return {
    title: "Notifica di prova",
    body: `Le notifiche funzionano su ${deviceName}.`,
    url: "/admin/impostazioni/account",
    tag: "prova",
  };
}
