import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { composeAdminNewBooking, composeEmail } from "./compose";
import { DEFAULT_TEMPLATES } from "./defaults";
import { textToHtml } from "./emailLayout";

const business = {
  address: "Via Roma 1, Roma",
  whatsapp: "+393331234567",
  replyTo: "fabiana@example.it",
  appUrl: "https://prenota.fabianaestetica.it",
};
const appointment = {
  id: "a1",
  startsAt: instantAt("2026-10-13", 10 * 60 + 30),
  durationMin: 60,
  totalPriceCents: 4500,
  items: [{ name: "Pulizia <viso>" }],
  client: { firstName: "Anna", lastName: "O'Neil" },
};

describe("email", () => {
  it("conferma: testo del template, riquadro, link, contatti; HTML e solo testo", () => {
    const email = composeEmail({ kind: "BOOKING_CONFIRMED", appointment }, DEFAULT_TEMPLATES["BOOKING_CONFIRMED:EMAIL"]!, business);
    expect(email.subject).toBe("Appuntamento confermato · martedì 13 ottobre alle 10:30");
    expect(email.html).toContain("max-width:560px");
    expect(email.html).toContain(">FL</td>"); // monogramma in HTML, non immagine
    expect(email.html).not.toMatch(/<img/i);
    expect(email.html).toContain("Martedì 13 ottobre");
    expect(email.html).toContain("Pulizia &lt;viso&gt;"); // testo sempre protetto
    expect(email.html).toContain('href="https://prenota.fabianaestetica.it/appuntamenti"');
    expect(email.html).toContain("WhatsApp +39 333 123 4567");
    expect(email.text).toContain("Ciao Anna,");
    expect(email.text).toContain("Data: Martedì 13 ottobre\nOra: 10:30\nServizio: Pulizia <viso>\nDurata: 1 h\nTotale: 45 €");
    expect(email.text).toContain("I miei appuntamenti: https://prenota.fabianaestetica.it/appuntamenti");
    expect(email.text).toContain("Via Roma 1, Roma");
  });

  it("il riquadro sta sotto il testo modificabile", () => {
    const email = composeEmail({ kind: "REMINDER", appointment }, { subject: "x", body: "TESTO-ADMIN" }, business);
    expect(email.html.indexOf("TESTO-ADMIN")).toBeLessThan(email.html.indexOf("Il tuo appuntamento di domani"));
    expect(email.text.indexOf("TESTO-ADMIN")).toBeLessThan(email.text.indexOf("Data:"));
  });

  it("modifica: riga 'Prima era'; cancellazione: dettagli barrati", () => {
    const changed = composeEmail(
      { kind: "APPOINTMENT_CHANGED", appointment, previousStartsAt: instantAt("2026-10-12", 9 * 60) },
      DEFAULT_TEMPLATES["APPOINTMENT_CHANGED:EMAIL"]!,
      business,
    );
    expect(changed.text).toContain("Prima era: lunedì 12 ottobre alle 09:00");
    const cancelled = composeEmail({ kind: "APPOINTMENT_CANCELLED", appointment }, DEFAULT_TEMPLATES["APPOINTMENT_CANCELLED:EMAIL"]!, business);
    expect(cancelled.html).toContain("text-decoration:line-through");
    expect(cancelled.subject).toBe("Appuntamento cancellato · martedì 13 ottobre");
  });

  it("codice di accesso: niente riquadro né pulsante", () => {
    const email = composeEmail(
      { kind: "LOGIN_CODE", client: appointment.client, code: "012345" },
      DEFAULT_TEMPLATES["LOGIN_CODE:EMAIL"]!,
      business,
    );
    expect(email.subject).toBe("Il tuo codice di accesso: 012345");
    expect(email.text).not.toContain("Data:");
    expect(email.html).not.toContain("I miei appuntamenti");
  });

  it("avviso admin con i dati della cliente", () => {
    const email = composeAdminNewBooking(
      { ...appointment, client: { ...appointment.client, phone: "+393339999999", email: "anna@example.it" } },
      business,
    );
    expect(email.subject).toBe("Nuova prenotazione · Anna O'Neil · martedì 13 ottobre alle 10:30");
    expect(email.text).toContain("Cellulare: +39 333 999 9999");
    expect(email.html).toContain("O&#39;Neil");
  });
});

describe("textToHtml", () => {
  it("paragrafi, a capo, link cliccabili e niente HTML dall'admin", () => {
    expect(textToHtml("Ciao <b>\nriga\n\nVai su https://x.it/appuntamenti.")).toBe(
      '<p style="margin:0 0 16px 0">Ciao &lt;b&gt;<br>riga</p>' +
        '<p style="margin:0 0 16px 0">Vai su <a href="https://x.it/appuntamenti" style="color:#3D2B33;text-decoration:underline">https://x.it/appuntamenti</a>.</p>',
    );
  });
});
