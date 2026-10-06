/** Importi: sempre in centesimi (Int) nel database, in euro solo a video. */

export const MAX_CENTS = 1_000_000_00; // 1 milione di euro: limite di sicurezza

/**
 * Converte quello che scrive l'admin ("35", "35,5", "35,50", "35.50", "1.200,00", "€ 40")
 * in centesimi. Restituisce null se il testo non è un importo valido.
 */
export function parseEuroToCents(input: string): number | null {
  let text = input.replace(/[\s€]/g, "");
  if (!text) return null;

  if (text.includes(",") && text.includes(".")) {
    // "1.200,50": il punto separa le migliaia, la virgola i decimali
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;

  const euros = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = euros * 100 + cents;
  return total <= MAX_CENTS ? total : null;
}

/** 3550 → "35,50 €", 4000 → "40 €" */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Valore da mettere in un campo di modifica: 3550 → "35,50", 4000 → "40" */
export function centsToInput(cents: number): string {
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, "0")}`;
}
