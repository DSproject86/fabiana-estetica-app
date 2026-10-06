import Link from "next/link";

/** ‹ ottobre 2026 › con il ritorno al mese corrente. */
export function MonthNav({ label, prev, next, today }: { label: string; prev: string; next: string; today: string | null }) {
  const arrow = (href: string, dir: "prev" | "next") => (
    <Link
      href={href}
      aria-label={dir === "prev" ? "Mese precedente" : "Mese successivo"}
      className="flex size-11 items-center justify-center rounded-full hover:bg-cipria/20"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d={dir === "prev" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </Link>
  );
  return (
    <nav aria-label="Mese" className="flex items-center justify-between rounded-2xl bg-white px-2 py-1 shadow-sm ring-1 ring-prugna/5">
      {arrow(prev, "prev")}
      <span className="flex flex-col items-center">
        <span className="font-serif text-lg first-letter:uppercase">{label}</span>
        {today ? (
          <Link href={today} className="text-xs text-prugna/60 underline-offset-2 hover:underline">
            Torna a oggi
          </Link>
        ) : null}
      </span>
      {arrow(next, "next")}
    </nav>
  );
}
