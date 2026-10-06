/**
 * Cellulari in formato internazionale (+39…), come servono a wa.me.
 *
 * "333 123 4567", "333-1234567", "+39 333 1234567", "0039 3331234567", "39 3331234567"
 * → "+393331234567". I numeri esteri scritti con "+" o "00" restano col loro prefisso.
 * Restituisce null se il numero non sembra valido.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/[^\d\s+().\-/]/.test(trimmed)) return null; // lettere o simboli strani

  let digits = trimmed.replace(/\D/g, "");
  let international = trimmed.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }

  if (international) {
    if (digits.startsWith("39")) return italian(digits.slice(2));
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }

  // Senza prefisso: numero italiano. "39" davanti a un cellulare (es. 39 333…) è il prefisso.
  if (digits.length >= 11 && digits.startsWith("393")) return italian(digits.slice(2));
  return italian(digits);
}

/** Numero italiano senza prefisso: cellulari (3…, 9-10 cifre) e fissi (0…, 6-11 cifre). */
function italian(national: string): string | null {
  if (/^3\d{8,9}$/.test(national) || /^0\d{5,10}$/.test(national)) return `+39${national}`;
  return null;
}

/** "+393331234567" → "+39 333 123 4567" (solo per la lettura). */
export function formatPhone(phone: string): string {
  const m = /^\+39(3\d{2})(\d{3})(\d{3,4})$/.exec(phone);
  return m ? `+39 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
