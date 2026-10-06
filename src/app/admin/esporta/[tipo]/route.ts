import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { buildExport, isExportKind } from "@/lib/export/exports";
import { todayKey } from "@/lib/time/rome";

/** Copia di sicurezza in CSV (solo admin collegati). GET /admin/esporta/clienti|appuntamenti|pacchetti|pagamenti */
export async function GET(_request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  if (!(await getCurrentAdmin())) return new NextResponse("Non autorizzato", { status: 401 });
  const { tipo } = await params;
  if (!isExportKind(tipo)) return new NextResponse("Esportazione non trovata", { status: 404 });

  const csv = await buildExport(tipo);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fabiana-${tipo}-${todayKey()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
