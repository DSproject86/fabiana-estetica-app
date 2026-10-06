/**
 * CSV per Excel in italiano: separatore ";", virgola decimale, BOM UTF-8 (accenti corretti) e righe CRLF.
 * Le celle che iniziano con = + - @ (o tabulazione/a capo) si aprirebbero come formule: si fanno
 * precedere da un apostrofo (CSV injection). I cellulari "+39 333 …" restano come sono: solo cifre
 * e spazi, non possono contenere una formula.
 */
export type CsvValue = string | number | boolean | null | undefined;

const PHONE_RE = /^\+\d[\d ]{5,}$/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "boolean" ? (value ? "sì" : "no") : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !PHONE_RE.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** 4550 → "45,50" (senza simbolo: Excel lo legge come numero). */
export function csvEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}
