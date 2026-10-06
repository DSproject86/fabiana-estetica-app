import { describe, expect, it } from "vitest";
import { csvCell, csvEuro, toCsv } from "./csv";

describe("CSV", () => {
  it("separatore ; con virgolette solo quando servono", () => {
    expect(csvCell("Rossi")).toBe("Rossi");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('dice "ciao"')).toBe('"dice ""ciao"""');
    expect(csvCell("riga1\nriga2")).toBe('"riga1\nriga2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("sì");
  });

  it("niente formule (CSV injection), ma i cellulari restano leggibili", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+1+cmd|' /C calc'!A0")).toBe("'+1+cmd|' /C calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("+39 333 111 2222")).toBe("+39 333 111 2222");
  });

  it("importi con la virgola, BOM e righe CRLF", () => {
    expect(csvEuro(4550)).toBe("45,50");
    expect(csvEuro(5)).toBe("0,05");
    expect(csvEuro(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a;b\r\n1;x\r\n");
  });
});
