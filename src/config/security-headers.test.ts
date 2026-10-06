import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

describe("header di sicurezza", () => {
  const prod = { dev: false, preview: false };

  it("ci sono tutti", () => {
    const keys = securityHeaders(prod).map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });

  it("CSP di produzione: niente eval, niente iframe, solo il nostro dominio", () => {
    const csp = contentSecurityPolicy(prod);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("vercel.live");
    expect(csp).not.toMatch(/https?:\/\/(?!vercel)/);
  });

  it("sviluppo e anteprime aggiungono solo quello che serve", () => {
    expect(contentSecurityPolicy({ dev: true, preview: false })).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ dev: false, preview: true })).toContain("https://vercel.live");
  });
});
