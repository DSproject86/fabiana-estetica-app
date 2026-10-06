/** Frecce su/giù per riordinare (form con server action, funzionano anche senza JavaScript). */
export function MoveButtons({
  label,
  isFirst,
  isLast,
  moveUp,
  moveDown,
}: {
  label: string;
  isFirst: boolean;
  isLast: boolean;
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
}) {
  const buttonClass =
    "flex size-9 items-center justify-center rounded-full text-prugna/70 hover:bg-cipria/20 disabled:opacity-25 disabled:hover:bg-transparent";
  return (
    <div className="flex shrink-0 items-center">
      <form action={moveUp}>
        <button type="submit" disabled={isFirst} className={buttonClass} aria-label={`Sposta su: ${label}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 14l6-6 6 6" />
          </svg>
        </button>
      </form>
      <form action={moveDown}>
        <button type="submit" disabled={isLast} className={buttonClass} aria-label={`Sposta giù: ${label}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 10l6 6 6-6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
