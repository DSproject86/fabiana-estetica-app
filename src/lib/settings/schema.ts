import { z } from "zod";

/** Scelte ammesse per i parametri delle prenotazioni (mostrate come menu a tendina). */
export const SETTINGS_OPTIONS = {
  slotGridMin: [15, 20, 30, 60],
  durationRoundingMin: [5, 10, 15, 30, 60],
  bufferMin: Array.from({ length: 25 }, (_, i) => i * 5), // 0–120
  minNoticeMin: [0, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880], // 0 min – 48 h
  bookingHorizonMonths: Array.from({ length: 12 }, (_, i) => i + 1),
  reminderHour: Array.from({ length: 14 }, (_, i) => i + 8), // 8–21
} as const;

export type SettingsKey = keyof typeof SETTINGS_OPTIONS;

const oneOf = (key: SettingsKey, message: string) =>
  z.coerce
    .number()
    .int()
    .refine((v) => (SETTINGS_OPTIONS[key] as readonly number[]).includes(v), message);

export const settingsSchema = z.object({
  slotGridMin: oneOf("slotGridMin", "Griglia non valida."),
  durationRoundingMin: oneOf("durationRoundingMin", "Arrotondamento non valido."),
  bufferMin: oneOf("bufferMin", "Pausa non valida."),
  minNoticeMin: oneOf("minNoticeMin", "Preavviso non valido."),
  bookingHorizonMonths: oneOf("bookingHorizonMonths", "Numero di mesi non valido."),
  reminderHour: oneOf("reminderHour", "Ora non valida."),
});

export type SettingsValues = z.output<typeof settingsSchema>;

export function formatNotice(minutes: number): string {
  if (minutes === 0) return "Nessun preavviso";
  if (minutes < 60) return `${minutes} minuti`;
  const hours = minutes / 60;
  return hours === 1 ? "1 ora" : `${hours} ore`;
}
