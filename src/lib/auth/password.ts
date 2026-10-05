import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash fittizio: si confronta comunque quando l'email non esiste,
// così i tempi di risposta non rivelano quali email sono registrate.
const DUMMY_HASH = "$2b$12$OI4PYMmtBV2/LOxvCGZSq.Hz9Cy7rBL5oHjXpVq0GHqTHs6pUDUaS";

export async function verifyPasswordOrDummy(password: string, hash: string | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== undefined && ok;
}
