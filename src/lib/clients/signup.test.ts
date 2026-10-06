import { describe, expect, it } from "vitest";
import { emailSchema, signupFieldErrors, signupSchema } from "./signup";

const valid = { firstName: " Anna  Maria ", lastName: "Rossi", phone: "333 123 4567", email: " Anna@Example.IT ", privacy: "on" };

describe("modulo d'iscrizione", () => {
  it("pulisce i dati: spazi, email minuscola, cellulare +39", () => {
    expect(signupSchema.parse(valid)).toEqual({
      firstName: "Anna Maria",
      lastName: "Rossi",
      phone: "+393331234567",
      email: "anna@example.it",
      privacy: "on",
    });
  });

  it("dà un messaggio per ogni campo sbagliato", () => {
    const result = signupSchema.safeParse({ firstName: "", lastName: "Rossi", phone: "abc", email: "no", privacy: null });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(signupFieldErrors(result.error)).toEqual({
      firstName: "Scrivi il tuo nome.",
      phone: "Controlla il numero di cellulare.",
      email: "Controlla l'email.",
      privacy: "Per iscriverti serve il consenso al trattamento dei dati.",
    });
  });

  it("email da sola", () => {
    expect(emailSchema.parse("  X@Y.it")).toBe("x@y.it");
    expect(emailSchema.safeParse("x@").success).toBe(false);
  });
});
