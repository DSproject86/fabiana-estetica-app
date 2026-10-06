import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./auth";

describe("CRON_SECRET", () => {
  const secret = "s3greto-lungo-e-casuale";

  it("passa solo col Bearer giusto", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`bearer   ${secret}  `, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false); // manca "Bearer"
    expect(isCronAuthorized(`Basic ${secret}`, secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized("Bearer ", secret)).toBe(false);
  });

  it("senza CRON_SECRET configurato non passa nessuno", () => {
    expect(isCronAuthorized("Bearer ", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer qualcosa", "")).toBe(false);
    expect(isCronAuthorized("Bearer  ", "  ")).toBe(false);
  });
});
