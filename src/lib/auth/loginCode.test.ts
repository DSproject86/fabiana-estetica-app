import { describe, expect, it } from "vitest";
import {
  CODE_MAX_ATTEMPTS,
  canIssueCode,
  codeMatches,
  generateCode,
  hashCode,
  isCodeUsable,
  normalizeCode,
} from "./loginCode";

const SECRET = "x".repeat(40);
const NOW = new Date("2026-10-06T10:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("codice di accesso", () => {
  it("genera sempre 6 cifre (zeri iniziali compresi)", () => {
    for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it("accetta il codice con spazi o trattini e rifiuta il resto", () => {
    expect(normalizeCode(" 012 345 ")).toBe("012345");
    expect(normalizeCode("012-345")).toBe("012345");
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("12345a")).toBeNull();
    expect(normalizeCode("1234567")).toBeNull();
  });

  it("salva un HMAC: niente codice in chiaro, legato a cliente e segreto", () => {
    const hash = hashCode("c1", "123456", SECRET);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("123456");
    expect(codeMatches("c1", "123456", hash, SECRET)).toBe(true);
    expect(codeMatches("c1", "123457", hash, SECRET)).toBe(false);
    expect(codeMatches("c2", "123456", hash, SECRET)).toBe(false);
    expect(codeMatches("c1", "123456", hash, "y".repeat(40))).toBe(false);
    expect(codeMatches("c1", "123456", "abc", SECRET)).toBe(false);
  });

  it("massimo 3 codici ogni 15 minuti", () => {
    expect(canIssueCode([], NOW)).toBe(true);
    expect(canIssueCode([minutesAgo(1), minutesAgo(5)], NOW)).toBe(true);
    expect(canIssueCode([minutesAgo(1), minutesAgo(5), minutesAgo(14)], NOW)).toBe(false);
    expect(canIssueCode([minutesAgo(1), minutesAgo(5), minutesAgo(15)], NOW)).toBe(true); // il terzo è uscito dalla finestra
  });

  it("un codice vale 10 minuti, una volta sola, per 5 tentativi", () => {
    const base = { codeHash: "h", expiresAt: new Date(NOW.getTime() + 60_000), attempts: 0, consumedAt: null };
    expect(isCodeUsable(base, NOW)).toBe(true);
    expect(isCodeUsable({ ...base, expiresAt: NOW }, NOW)).toBe(false);
    expect(isCodeUsable({ ...base, attempts: CODE_MAX_ATTEMPTS - 1 }, NOW)).toBe(true);
    expect(isCodeUsable({ ...base, attempts: CODE_MAX_ATTEMPTS }, NOW)).toBe(false);
    expect(isCodeUsable({ ...base, consumedAt: minutesAgo(1) }, NOW)).toBe(false);
  });
});
