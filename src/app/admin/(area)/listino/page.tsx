import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { MoveButtons } from "./_components/MoveButtons";
import { moveCategory, movePackageTemplate, moveService } from "./actions";

export const metadata: Metadata = { title: "Listino" };

function HiddenBadge({ label = "Nascosto" }: { label?: string }) {
  return (
    <span className="rounded-full bg-prugna/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-prugna/70">
      {label}
    </span>
  );
}

function AddLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
    >
      {children}
    </Link>
  );
}

export default async function ListinoPage() {
  const [categories, templates] = await Promise.all([
    prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { services: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
    prisma.packageTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { service: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Listino</h1>
          <p className="text-prugna/70">Categorie, servizi e pacchetti. Tocca una voce per modificarla.</p>
        </div>
        <AddLink href="/admin/listino/categorie/nuova">+ Nuova categoria</AddLink>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
          Il listino è vuoto. Inizia creando una categoria (per esempio Viso, Corpo, Mani e piedi), poi
          aggiungi i servizi.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((category, ci) => (
            <section
              key={category.id}
              aria-labelledby={`cat-${category.id}`}
              className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5"
            >
              <div className="flex items-center gap-2 border-b border-oro/20 bg-cipria/10 py-2 pl-4 pr-2">
                <Link
                  href={`/admin/listino/categorie/${category.id}`}
                  className="flex min-h-11 flex-1 items-center gap-2"
                >
                  <h2 id={`cat-${category.id}`} className={`text-xl ${category.active ? "" : "text-prugna/50"}`}>
                    {category.name}
                  </h2>
                  {!category.active ? <HiddenBadge label="Nascosta" /> : null}
                </Link>
                <MoveButtons
                  label={category.name}
                  isFirst={ci === 0}
                  isLast={ci === categories.length - 1}
                  moveUp={moveCategory.bind(null, category.id, "up")}
                  moveDown={moveCategory.bind(null, category.id, "down")}
                />
              </div>

              {category.services.length === 0 ? (
                <p className="px-4 py-4 text-sm text-prugna/60">Nessun servizio in questa categoria.</p>
              ) : (
                <ul className="divide-y divide-prugna/5">
                  {category.services.map((service, si) => (
                    <li key={service.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
                      <Link
                        href={`/admin/listino/servizi/${service.id}`}
                        className="flex min-h-14 flex-1 flex-col justify-center gap-0.5 py-2"
                      >
                        <span className={`flex items-center gap-2 font-medium ${service.active ? "" : "text-prugna/50"}`}>
                          {service.name}
                          {!service.active ? <HiddenBadge /> : null}
                        </span>
                        <span className="text-sm text-prugna/60">
                          {formatDuration(service.durationMin)} · {formatEuro(service.priceCents)}
                        </span>
                      </Link>
                      <MoveButtons
                        label={service.name}
                        isFirst={si === 0}
                        isLast={si === category.services.length - 1}
                        moveUp={moveService.bind(null, service.id, "up")}
                        moveDown={moveService.bind(null, service.id, "down")}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-prugna/5 px-4 py-2">
                <Link
                  href={`/admin/listino/servizi/nuovo?categoria=${category.id}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-cipria/25 px-4 text-sm font-medium hover:bg-cipria/40"
                >
                  + Aggiungi servizio
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="pacchetti" className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 id="pacchetti" className="text-2xl">Pacchetti massaggi</h2>
            <p className="text-sm text-prugna/70">
              Modelli da assegnare alle clienti: ogni pacchetto ha un prezzo totale e un numero di sedute.
            </p>
          </div>
          <AddLink href="/admin/listino/pacchetti/nuovo">+ Nuovo pacchetto</AddLink>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
            Nessun pacchetto a listino.
          </div>
        ) : (
          <ul className="divide-y divide-prugna/5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5">
            {templates.map((t, ti) => (
              <li key={t.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
                <Link
                  href={`/admin/listino/pacchetti/${t.id}`}
                  className="flex min-h-14 flex-1 flex-col justify-center gap-0.5 py-2"
                >
                  <span className={`flex items-center gap-2 font-medium ${t.active ? "" : "text-prugna/50"}`}>
                    {t.name}
                    {!t.active ? <HiddenBadge label="Non disponibile" /> : null}
                  </span>
                  <span className="text-sm text-prugna/60">
                    {t.sessions} sedute · {formatEuro(t.priceCents)}
                    {t.service ? ` · ${t.service.name}` : ""}
                  </span>
                </Link>
                <MoveButtons
                  label={t.name}
                  isFirst={ti === 0}
                  isLast={ti === templates.length - 1}
                  moveUp={movePackageTemplate.bind(null, t.id, "up")}
                  moveDown={movePackageTemplate.bind(null, t.id, "down")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
