import { parseServiceIds, parseTime } from "@/lib/booking/params";
import { isValidDayKey } from "@/lib/time/rome";
import type { PickerChoice } from "./pickerQuery";
import { isValidMonth } from "./rules";

export { pickerQuery, type PickerChoice } from "./pickerQuery";

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function parsePickerParams(raw: RawParams): PickerChoice {
  const client = first(raw.cliente);
  const month = first(raw.mese);
  const day = first(raw.giorno);
  const pausa = first(raw.pausa);
  return {
    client: ID_RE.test(client) ? client : null,
    q: first(raw.q).trim().slice(0, 60),
    services: parseServiceIds(first(raw.s)),
    keep: parseServiceIds(first(raw.v)),
    month: isValidMonth(month) ? month : null,
    day: isValidDayKey(day) ? day : null,
    time: parseTime(first(raw.ora)),
    noBuffer: pausa === "no" ? true : pausa === "si" ? false : null,
    outside: first(raw.fuori) === "1",
  };
}
