/**
 * Header di sicurezza per tutte le risposte (usati da next.config.ts).
 * CSP senza nonce, così le pagine statiche restano statiche: gli script inline di Next richiedono
 * 'unsafe-inline'; tutto il resto (script, stili, font, immagini, connessioni) solo dal nostro dominio.
 * Niente iframe da altri siti, form solo verso di noi.
 */
export type HeaderOptions = {
  /** `next dev` ha bisogno di eval e websocket per il ricaricamento. */
  dev: boolean;
  /** Anteprime Vercel: barra degli strumenti di vercel.live. */
  preview: boolean;
};

export function contentSecurityPolicy({ dev, preview }: HeaderOptions): string {
  const vercelLive = preview ? " https://vercel.live" : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
    `style-src 'self' 'unsafe-inline'${vercelLive}`,
    `img-src 'self' data: blob:${vercelLive}${preview ? " https://vercel.com" : ""}`,
    `font-src 'self' data:${vercelLive}`,
    `connect-src 'self'${dev ? " ws: wss:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
    `frame-src ${preview ? "https://vercel.live" : "'none'"}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
  ];
}
