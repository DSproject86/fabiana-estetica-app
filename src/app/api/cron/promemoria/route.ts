import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { runReminders } from "@/lib/notifications/reminders";

/**
 * Promemoria del giorno prima. Chiamato ogni ora da cron-job.org con
 * "Authorization: Bearer <CRON_SECRET>". Idempotente: chiamarlo più volte non manda doppioni.
 * Si ferma da solo dopo ~45 s; i rimanenti partono alla chiamata successiva.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIME_BUDGET_MS = 45_000;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const summary = await runReminders({ budgetMs: TIME_BUDGET_MS });
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Promemoria: errore", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
