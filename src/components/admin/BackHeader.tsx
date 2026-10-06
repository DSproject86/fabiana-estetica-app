import Link from "next/link";

/** Titolo di una sottopagina admin con il link per tornare indietro. */
export function BackHeader({
  back,
  title,
  description,
}: {
  back: { href: string; label: string };
  title: string;
  description?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <Link href={back.href} className="inline-flex w-fit items-center gap-1 text-sm text-prugna/60 hover:text-prugna">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {back.label}
      </Link>
      <h1 className="text-3xl">{title}</h1>
      {description ? <p className="text-prugna/70">{description}</p> : null}
    </header>
  );
}
