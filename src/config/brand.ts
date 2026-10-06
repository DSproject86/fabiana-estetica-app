/**
 * Unico punto di configurazione per nome, colori e testi del marchio.
 * Cambiando i valori qui si aggiorna tutta l'app (variabili CSS, logo, metadati).
 */
export const brand = {
  name: "Fabiana L.",
  tagline: "Estetica",
  fullName: "Fabiana L. · Estetica",
  monogram: "FL",
  description: "Prenota i tuoi trattamenti da Fabiana L. · Estetica",
  locale: "it-IT",
  timeZone: "Europe/Rome",
  colors: {
    cipria: "#D8A7A0", // rosa cipria: accenti, bottoni secondari
    oro: "#C9A66B", // oro: dettagli, logo
    avorio: "#FBF7F4", // sfondo
    prugna: "#3D2B33", // testo
    salvia: "#8FB89A", // completato
    white: "#FFFFFF",
  },
  /** Grafici (Statistiche): toni più intensi di cipria e oro, verificati per daltonismo e contrasto su bianco. */
  chart: {
    appointments: "#A0526A",
    packages: "#C08A2E",
  },
} as const;

export type BrandColor = keyof typeof brand.colors;

/** Variabili CSS `--brand-<colore>` generate dai colori qui sopra. */
export function brandCssVariables(): string {
  const vars = Object.entries(brand.colors)
    .map(([key, value]) => `--brand-${key}:${value};`)
    .join("");
  return `:root{${vars}}`;
}
