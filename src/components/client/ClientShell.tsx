import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { brand } from "@/config/brand";
import { logoutClientAction } from "@/app/actions";

/** Cornice delle pagine cliente: intestazione con logo (→ home) e, se collegata, "Esci". */
export function ClientShell({
  loggedIn,
  children,
  wide = false,
}: {
  loggedIn: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pt-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-full pr-2">
          <LogoMark size={36} />
          <span className="font-serif text-lg leading-none">{brand.name}</span>
        </Link>
        {loggedIn ? <LogoutButton /> : null}
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-6 pb-10 ${wide ? "max-w-lg" : "max-w-md"}`}>
        {children}
      </main>
    </div>
  );
}

export function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logoutClientAction}>
      <button
        type="submit"
        className={`min-h-11 rounded-full px-4 text-sm text-prugna/70 hover:bg-cipria/20 hover:text-prugna ${className}`}
      >
        Esci
      </button>
    </form>
  );
}

/** Titolo di pagina con eventuale link "indietro". */
export function PageTitle({ title, subtitle, back }: { title: string; subtitle?: string; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-1.5">
      {back ? (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1 text-sm text-prugna/60 hover:text-prugna">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          {back.label}
        </Link>
      ) : null}
      <h1 className="text-3xl">{title}</h1>
      {subtitle ? <p className="text-prugna/70">{subtitle}</p> : null}
    </div>
  );
}

/** Messaggi in evidenza: errore (cipria), conferma (salvia), informazione (bianco). */
export function Notice({ tone = "info", children }: { tone?: "error" | "ok" | "info"; children: React.ReactNode }) {
  const tones = { error: "bg-cipria/30", ok: "bg-salvia/25", info: "bg-white ring-1 ring-prugna/10" };
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}

export const cardClass = "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-prugna/5";

/** Link con l'aspetto del pulsante principale/secondario. */
export const linkButtonClass = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-prugna px-6 text-base font-medium text-avorio transition-colors hover:bg-prugna/90",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cipria/30 px-6 text-base font-medium text-prugna transition-colors hover:bg-cipria/45",
  whatsapp:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-salvia px-6 text-base font-medium text-prugna transition-colors hover:bg-salvia/85",
} as const;
