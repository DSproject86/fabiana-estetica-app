"use client";

export function DeleteBlockButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Eliminare il blocco ${label}? La fascia tornerà prenotabile.`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="flex size-11 items-center justify-center rounded-full text-prugna/60 hover:bg-cipria/20"
        aria-label={`Elimina blocco ${label}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3" />
        </svg>
      </button>
    </form>
  );
}
