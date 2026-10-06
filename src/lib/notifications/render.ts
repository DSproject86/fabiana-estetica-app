/** Sostituisce i segnaposto {nome} {codice} … (quelli sconosciuti restano come sono). */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}
