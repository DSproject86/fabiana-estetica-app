import { describe, expect, it } from "vitest";
import { allowedPlaceholders, invalidPlaceholders, renderTemplate, validateTemplate } from "./placeholders";

describe("renderTemplate", () => {
  it("sostituisce i segnaposto noti, anche ripetuti, e lascia gli altri", () => {
    expect(renderTemplate("Ciao {nome}, codice {codice} ({codice}) {altro}", { nome: "Anna", codice: "012345" })).toBe(
      "Ciao Anna, codice 012345 (012345) {altro}",
    );
  });

  it("un valore vuoto sostituisce comunque; i nomi di proprietà JavaScript non escono mai", () => {
    expect(renderTemplate("[{indirizzo}]", { indirizzo: "" })).toBe("[]");
    expect(renderTemplate("{constructor} {toString}", { nome: "Anna" })).toBe("{constructor} {toString}");
  });
});

describe("segnaposto ammessi", () => {
  it("codice di accesso: solo {nome} {cognome} {codice} {link}", () => {
    expect(allowedPlaceholders("LOGIN_CODE")).toEqual(["nome", "cognome", "codice", "link"]);
    expect(invalidPlaceholders("{nome} {data} {codice}", "LOGIN_CODE")).toEqual(["{data}"]);
  });

  it("appuntamenti: tutti tranne {codice}", () => {
    const text = "{nome} {cognome} {data} {ora} {servizi} {durata} {totale} {indirizzo} {link}";
    expect(invalidPlaceholders(text, "REMINDER")).toEqual([]);
    expect(invalidPlaceholders("{codice}", "BOOKING_CONFIRMED")).toEqual(["{codice}"]);
  });

  it("segnala refusi e graffe vuote, una volta sola", () => {
    expect(invalidPlaceholders("{nme} {nme} {} {Nome}", "REMINDER")).toEqual(["{nme}", "{}", "{Nome}"]);
  });
});

describe("validateTemplate", () => {
  const ok = { kind: "REMINDER" as const, channel: "EMAIL" as const, subject: "Domani alle {ora}", body: "Ciao {nome}" };

  it("accetta un testo corretto", () => {
    expect(validateTemplate(ok)).toBeNull();
  });

  it("non salva segnaposto sbagliati, nell'oggetto o nel testo", () => {
    expect(validateTemplate({ ...ok, body: "Ciao {nme}" })).toMatch(/\{nme\}/);
    expect(validateTemplate({ ...ok, subject: "Codice {codice}" })).toMatch(/\{codice\}/);
    expect(validateTemplate({ ...ok, body: "{a} e {b}" })).toMatch(/I segnaposto \{a\} \{b\}/);
  });

  it("il codice di accesso deve contenere {codice} nel testo", () => {
    const login = { kind: "LOGIN_CODE" as const, channel: "EMAIL" as const, subject: "Accesso", body: "Ciao {nome}" };
    expect(validateTemplate(login)).toMatch(/deve contenere \{codice\}/);
    expect(validateTemplate({ ...login, body: "Codice: {codice}" })).toBeNull();
  });

  it("email: oggetto obbligatorio e su una riga; WhatsApp: niente oggetto", () => {
    expect(validateTemplate({ ...ok, subject: " " })).toMatch(/oggetto/);
    expect(validateTemplate({ ...ok, subject: "a\nb" })).toMatch(/una riga/);
    expect(validateTemplate({ kind: "REMINDER", channel: "WHATSAPP", subject: null, body: "Ciao {nome}" })).toBeNull();
  });

  it("testo vuoto o troppo lungo", () => {
    expect(validateTemplate({ ...ok, body: "  " })).toMatch(/vuoto/);
    expect(validateTemplate({ kind: "REMINDER", channel: "WHATSAPP", subject: null, body: "x".repeat(1001) })).toMatch(/1000/);
  });
});
