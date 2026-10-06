import Link from "next/link";

/** "N appuntamenti passati non segnati": porta ai giorni da sistemare, così l'incasso è completo. */
export function UnmarkedNotice({ count, href = "/admin/agenda?vista=da-segnare" }: { count: number; href?: string }) {
  if (count === 0) return null;
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-oro/20 px-4 py-3 text-sm ring-1 ring-oro/40 hover:bg-oro/30"
    >
      <span>
        <strong className="font-semibold">
          {count === 1 ? "1 appuntamento passato non segnato" : `${count} appuntamenti passati non segnati`}
        </strong>
        <span className="block text-prugna/70">Segnali come Fatti o Non presentata per avere l&apos;incasso completo.</span>
      </span>
      <span aria-hidden className="text-lg">›</span>
    </Link>
  );
}
