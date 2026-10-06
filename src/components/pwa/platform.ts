/** Riconoscimento del dispositivo nel browser (solo lato client). */

export type Platform = "ios" | "android";

export function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/** L'app è aperta dall'icona della schermata Home (o installata), non da una scheda del browser. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
