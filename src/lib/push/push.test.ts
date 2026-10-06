import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import { instantAt } from "@/lib/time/rome";
import { newBookingPush } from "./payload";
import { cleanDeviceName, isAllowedPushEndpoint, subscriptionSchema, suggestDeviceName } from "./subscription";

const p256dh = createECDH("prime256v1").generateKeys().toString("base64url");
const auth = Buffer.alloc(16, 7).toString("base64url");

describe("testo della notifica di nuova prenotazione", () => {
  it("cliente, giorno e ora a Roma, servizi; il tocco apre l'agenda su quel giorno", () => {
    const p = newBookingPush({
      id: "a1",
      startsAt: instantAt("2026-10-14", 10 * 60 + 30),
      client: { firstName: "Giulia", lastName: "Bianchi" },
      items: [{ name: "Pulizia viso" }],
    });
    expect(p.title).toBe("Nuova prenotazione");
    expect(p.body).toBe("Giulia Bianchi · mer 14 ott 10:30 · Pulizia viso");
    expect(p.url).toBe("/admin/agenda?mese=2026-10#giorno-2026-10-14");
    expect(p.tag).toBe("prenotazione-a1");
  });
});

describe("abbonamenti accettati", () => {
  it("solo https dei servizi push dei browser", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/QGx",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://user:pw@web.push.apple.com/x",
      "https://web.push.apple.com:8443/x",
      "https://localhost/x",
      "non un indirizzo",
    ]) {
      expect(isAllowedPushEndpoint(bad), bad).toBe(false);
    }
  });

  it("chiavi della lunghezza giusta", () => {
    const endpoint = "https://web.push.apple.com/QGx";
    expect(subscriptionSchema.safeParse({ endpoint, keys: { p256dh, auth } }).success).toBe(true);
    expect(subscriptionSchema.safeParse({ endpoint, keys: { p256dh: auth, auth } }).success).toBe(false);
    const notOnCurve = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 4)]).toString("base64url");
    expect(subscriptionSchema.safeParse({ endpoint, keys: { p256dh: notOnCurve, auth } }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ endpoint, keys: { p256dh, auth: "x" } }).success).toBe(false);
    expect(subscriptionSchema.safeParse({ endpoint: "https://example.com/x", keys: { p256dh, auth } }).success).toBe(false);
  });
});

describe("nome del dispositivo", () => {
  it("proposto dal browser e ripulito", () => {
    expect(suggestDeviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "Fabiana")).toBe("iPhone di Fabiana");
    expect(suggestDeviceName("Mozilla/5.0 (Linux; Android 14; Pixel 7)", "Marco")).toBe("Android di Marco");
    expect(suggestDeviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Marco")).toBe("Computer di Marco");
    expect(cleanDeviceName("  iPhone   di  Fabiana \n", "x")).toBe("iPhone di Fabiana");
    expect(cleanDeviceName("   ", "Android di Marco")).toBe("Android di Marco");
    expect(cleanDeviceName("a".repeat(100), "x")).toHaveLength(60);
  });
});
