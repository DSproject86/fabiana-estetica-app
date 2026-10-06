import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Controllo statico delle protezioni: nessuna pagina admin, azione o API raggiungibile senza login.
 * Se aggiungi un file nuovo e questo test fallisce, metti il controllo (requireAdmin / requireClient)
 * come PRIMA istruzione; le eccezioni pubbliche vanno elencate qui sotto, con il motivo.
 */

const APP = join(process.cwd(), "src", "app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(APP).map((path) => ({ path: relative(APP, path).replaceAll("\\", "/"), source: readFileSync(path, "utf8") }));

/** Corpo di una funzione: dalla "{" a fine riga dopo i parametri (salta l'eventuale tipo restituito). */
function bodyAfter(source: string, index: number): string {
  let i = source.indexOf("(", index);
  let depth = 0;
  for (; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")" && --depth === 0) break;
  }
  const open = /\{[ \t]*\r?\n/.exec(source.slice(i));
  return open ? source.slice(i + open.index + open[0].length).trimStart() : "";
}

const startsWithGuard = (body: string, guard: string) =>
  new RegExp(`^(const \\w+ = )?await ${guard}\\(\\);`).test(body);

/** Azioni pubbliche per scelta (prima del login), con il motivo. */
const PUBLIC_ACTIONS: Record<string, string[]> = {
  "accedi/actions.ts": ["*"], // richiesta e verifica del codice di accesso
  "invito/[token]/actions.ts": ["*"], // iscrizione dal link d'invito
  "admin/login/actions.ts": ["loginAction"],
  "admin/actions.ts": ["logoutAction"],
  "actions.ts": ["logoutClientAction"],
};

/** Route handler e controllo che ognuno deve fare. */
const ROUTE_GUARDS: Record<string, string> = {
  "admin/esporta/[tipo]/route.ts": "if (!(await getCurrentAdmin())) return new NextResponse(\"Non autorizzato\", { status: 401 });",
  "api/cron/promemoria/route.ts": "isCronAuthorized(",
  "icons/[file]/route.ts": 'export const dynamic = "force-static";', // icone dell'app: pubbliche, generate al build
};

describe("protezioni", () => {
  const serverActionFiles = files.filter((f) => /^["']use server["'];/.test(f.source.trimStart()));

  it("ogni server action controlla il login come prima cosa", () => {
    const problems: string[] = [];
    expect(serverActionFiles.length).toBeGreaterThan(5);
    for (const f of serverActionFiles) {
      const allowed = PUBLIC_ACTIONS[f.path] ?? [];
      if (allowed.includes("*")) continue;
      const guard = f.path.startsWith("admin/") ? "requireAdmin" : "requireClient";
      if (/^export (const|let|var|default)\b/m.test(f.source)) problems.push(`${f.path}: esporta qualcosa che non è una funzione`);
      for (const m of f.source.matchAll(/^export async function (\w+)/gm)) {
        if (allowed.includes(m[1])) continue;
        if (!startsWithGuard(bodyAfter(f.source, m.index), guard)) problems.push(`${f.path}: ${m[1]} non inizia con ${guard}()`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("ogni pagina admin (tranne il login) controlla il login, anche oltre al layout", () => {
    const pages = files.filter((f) => f.path.startsWith("admin/") && f.path.endsWith("page.tsx") && f.path !== "admin/login/page.tsx");
    expect(pages.length).toBeGreaterThan(25);
    const problems = pages
      .filter((f) => !f.path.startsWith("admin/(area)/") || !startsWithGuard(bodyAfter(f.source, f.source.indexOf("export default")), "requireAdmin"))
      .map((f) => f.path);
    expect(problems).toEqual([]);
    const layout = files.find((f) => f.path === "admin/(area)/layout.tsx")!;
    expect(startsWithGuard(bodyAfter(layout.source, layout.source.indexOf("export default")), "requireAdmin")).toBe(true);
  });

  it("le pagine riservate alle clienti controllano la sessione", () => {
    const pages = files.filter((f) => /^(prenota|appuntamenti)\//.test(f.path) && f.path.endsWith("page.tsx"));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    const problems = pages
      .filter((f) => !startsWithGuard(bodyAfter(f.source, f.source.indexOf("export default")), "requireClient"))
      .map((f) => f.path);
    expect(problems).toEqual([]);
  });

  it("ogni route handler ha la sua protezione", () => {
    const routes = files.filter((f) => /(^|\/)route\.tsx?$/.test(f.path));
    for (const r of routes) {
      const guard = ROUTE_GUARDS[r.path];
      expect(guard, `${r.path}: route nuova, aggiungi la protezione e il controllo qui`).toBeDefined();
      expect(r.source, r.path).toContain(guard);
    }
  });

  it("il proxy fa da primo filtro su /admin e sull'area cliente", () => {
    const proxy = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");
    for (const path of ['"/admin/:path*"', '"/prenota/:path*"', '"/appuntamenti"']) expect(proxy).toContain(path);
  });
});
