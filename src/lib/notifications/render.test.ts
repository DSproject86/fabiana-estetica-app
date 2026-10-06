import { describe, expect, it } from "vitest";
import { renderTemplate } from "./render";

describe("renderTemplate", () => {
  it("sostituisce i segnaposto noti, anche ripetuti, e lascia gli altri", () => {
    expect(renderTemplate("Ciao {nome}, codice {codice} ({codice}) {altro}", { nome: "Anna", codice: "012345" })).toBe(
      "Ciao Anna, codice 012345 (012345) {altro}",
    );
  });
});
