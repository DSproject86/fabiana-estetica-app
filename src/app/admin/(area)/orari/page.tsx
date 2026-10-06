import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { formatSlots } from "@/lib/schedule/slots";
import { loadBlocks, loadEffectiveDays, loadOverrides, loadWeekly } from "@/lib/schedule/queries";
import {
  WEEKDAY_NAMES,
  addDays,
  dayKeyOf,
  formatDayLong,
  formatDayShort,
  formatTime,
  todayKey,
} from "@/lib/time/rome";
import { DeleteBlockButton } from "./_components/DeleteBlockButton";
import { deleteBlock } from "./actions";

export const metadata: Metadata = { title: "Orari" };

const TABS = [
  { id: "giorni", label: "Prossimi giorni" },
  { id: "settimana", label: "Settimana tipo" },
  { id: "eccezioni", label: "Eccezioni" },
  { id: "blocchi", label: "Blocchi" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "gold" | "rose" }) {
  const tones = {
    neutral: "bg-prugna/10 text-prugna/70",
    gold: "bg-oro/20 text-prugna",
    rose: "bg-cipria/30 text-prugna",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-prugna px-5 text-sm font-medium text-avorio hover:bg-prugna/90"
    >
      {children}
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">{children}</div>
  );
}

const card = "overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-prugna/5";

async function NextDays() {
  const today = todayKey();
  const days = await loadEffectiveDays(today, 14);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-prugna/70">
        L&apos;orario che vedranno le clienti nei prossimi 14 giorni (settimana tipo + eccezioni + blocchi).
      </p>
      <ul className={`${card} divide-y divide-prugna/5`}>
        {days.map((d) => {
          const label = d.day === today ? "Oggi" : d.day === addDays(today, 1) ? "Domani" : formatDayShort(d.day);
          const closed = d.slots.length === 0;
          return (
            <li key={d.day} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="inline-block font-medium first-letter:uppercase">{label}</span>
                <span className={closed ? "text-prugna/50" : ""}>{closed ? "Chiuso" : formatSlots(d.slots)}</span>
              </div>
              {d.exception || d.blocks.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {d.exception ? <Badge tone="gold">Eccezione{d.exception.note ? `: ${d.exception.note}` : ""}</Badge> : null}
                  {d.blocks.map((b) => (
                    <Badge key={b.id} tone="rose">
                      Bloccato {formatTime(b.startsAt)}–{formatTime(b.endsAt)}
                      {b.reason ? ` · ${b.reason}` : ""}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="flex gap-4 text-sm">
                <Link
                  href={d.exception ? `/admin/orari/eccezioni/${d.exception.id}` : `/admin/orari/eccezioni/nuova?data=${d.day}`}
                  className="min-h-8 font-medium text-prugna/70 underline-offset-4 hover:text-prugna hover:underline"
                >
                  {d.exception ? "Modifica eccezione" : "Orario diverso"}
                </Link>
                {!closed ? (
                  <Link
                    href={`/admin/orari/blocchi/nuovo?data=${d.day}`}
                    className="min-h-8 font-medium text-prugna/70 underline-offset-4 hover:text-prugna hover:underline"
                  >
                    Blocca una fascia
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function Week() {
  const weekly = await loadWeekly();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-prugna/70">L&apos;orario di ogni settimana. Tocca un giorno per cambiarlo.</p>
      <ul className={`${card} divide-y divide-prugna/5`}>
        {WEEKDAY_NAMES.map((name, i) => {
          const slots = weekly.filter((w) => w.weekday === i + 1);
          return (
            <li key={name}>
              <Link href={`/admin/orari/settimana/${i + 1}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-cipria/10">
                <span className="font-medium capitalize">{name}</span>
                <span className={`text-right ${slots.length ? "" : "text-prugna/50"}`}>
                  {slots.length ? formatSlots(slots) : "Chiuso"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function Exceptions() {
  const overrides = await loadOverrides(todayKey());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-prugna/70">Giorni con orario diverso o chiusi (ferie, festivi…).</p>
        <PrimaryLink href="/admin/orari/eccezioni/nuova">+ Nuova eccezione</PrimaryLink>
      </div>
      {overrides.length === 0 ? (
        <Empty>Nessuna eccezione in programma.</Empty>
      ) : (
        <ul className={`${card} divide-y divide-prugna/5`}>
          {overrides.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orari/eccezioni/${o.id}`} className="flex min-h-14 flex-col gap-0.5 px-4 py-3 hover:bg-cipria/10">
                <span className="inline-block font-medium first-letter:uppercase">{formatDayLong(o.day)}</span>
                <span className="text-sm text-prugna/70">
                  {o.closed ? "Chiuso tutto il giorno" : formatSlots(o.slots)}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Blocks() {
  const blocks = await loadBlocks(new Date());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-prugna/70">Fasce occupate per impegni personali: non si possono prenotare.</p>
        <PrimaryLink href="/admin/orari/blocchi/nuovo">+ Nuovo blocco</PrimaryLink>
      </div>
      {blocks.length === 0 ? (
        <Empty>Nessun blocco in programma.</Empty>
      ) : (
        <ul className={`${card} divide-y divide-prugna/5`}>
          {blocks.map((b) => {
            const label = `${formatDayShort(dayKeyOf(b.startsAt))} ${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`;
            return (
              <li key={b.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
                <div className="flex min-h-14 flex-1 flex-col justify-center gap-0.5 py-2">
                  <span className="inline-block font-medium first-letter:uppercase">{label}</span>
                  {b.reason ? <span className="text-sm text-prugna/70">{b.reason}</span> : null}
                </div>
                <DeleteBlockButton action={deleteBlock.bind(null, b.id)} label={label} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function OrariPage({ searchParams }: { searchParams: Promise<{ sezione?: string }> }) {
  await requireAdmin();
  const { sezione } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === sezione) ? (sezione as TabId) : "giorni";
  const hasWeekly = (await prisma.weeklySlot.count()) > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Orari</h1>
          <p className="text-prugna/70">Quando le clienti possono prenotare.</p>
        </div>
        <PrimaryLink href="/admin/orari/blocchi/nuovo">Blocca una fascia</PrimaryLink>
      </header>

      {!hasWeekly ? (
        <p className="rounded-2xl bg-oro/15 p-4 text-sm">
          Non hai ancora impostato la settimana tipo: finché è vuota tutti i giorni risultano chiusi.{" "}
          <Link href="/admin/orari?sezione=settimana" className="font-medium underline underline-offset-4">
            Imposta gli orari
          </Link>
        </p>
      ) : null}

      <nav aria-label="Sezioni orari" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {TABS.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/orari?sezione=${t.id}`}
                aria-current={t.id === tab ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  t.id === tab ? "bg-prugna text-avorio" : "bg-white ring-1 ring-prugna/10 hover:bg-cipria/15"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "giorni" ? <NextDays /> : null}
      {tab === "settimana" ? <Week /> : null}
      {tab === "eccezioni" ? <Exceptions /> : null}
      {tab === "blocchi" ? <Blocks /> : null}
    </div>
  );
}
