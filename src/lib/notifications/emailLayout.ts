import { brand } from "@/config/brand";
import { formatPhone } from "@/lib/clients/phone";
import { formatDuration } from "@/lib/duration";
import { formatEuro } from "@/lib/money";
import { formatTime } from "@/lib/time/rome";
import { formatDateIt, formatDateTimeIt, type AppointmentInfo, type BusinessInfo } from "./vars";

/**
 * Grafica delle email: tabelle e stili in linea (gli unici che i programmi di posta rispettano),
 * larghezza massima 560px, monogramma FL in HTML. Sempre anche la versione solo testo.
 * Modulo puro: lo usa anche l'anteprima in Impostazioni → Messaggi.
 */

export type BoxRow = { label: string; value: string | string[] };
export type EmailBox = { title?: string; rows: BoxRow[]; muted?: boolean };
export type EmailContent = { subject: string; html: string; text: string };

const c = brand.colors;
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Testo dell'admin → paragrafi HTML (riga vuota = nuovo paragrafo), con i link cliccabili. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph).replace(
        /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
        (url) => `<a href="${url}" style="color:${c.prugna};text-decoration:underline">${url}</a>`,
      );
      return `<p style="margin:0 0 16px 0">${escaped.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

/** Riquadro automatico con i dettagli dell'appuntamento. */
export function appointmentBox(
  appointment: AppointmentInfo,
  options: { title?: string; previousStartsAt?: Date; cancelled?: boolean } = {},
): EmailBox {
  const rows: BoxRow[] = [
    { label: "Data", value: capitalize(formatDateIt(appointment.startsAt)) },
    { label: "Ora", value: formatTime(appointment.startsAt) },
    { label: appointment.items.length === 1 ? "Servizio" : "Servizi", value: appointment.items.map((i) => i.name) },
    { label: "Durata", value: formatDuration(appointment.durationMin) },
    { label: "Totale", value: formatEuro(appointment.totalPriceCents) },
  ];
  if (options.previousStartsAt) rows.push({ label: "Prima era", value: formatDateTimeIt(options.previousStartsAt) });
  return { title: options.title, rows, muted: options.cancelled };
}

function boxHtml(box: EmailBox): string {
  const rows = box.rows
    .map(({ label, value }) => {
      const values = (Array.isArray(value) ? value : [value]).map(escapeHtml).join("<br>");
      return `<tr>
<td style="padding:6px 12px 6px 0;vertical-align:top;font-size:13px;color:${c.prugna};opacity:0.7;white-space:nowrap;width:90px">${escapeHtml(label)}</td>
<td style="padding:6px 0;vertical-align:top;font-size:15px;color:${c.prugna};font-weight:600${box.muted ? ";text-decoration:line-through" : ""}">${values}</td>
</tr>`;
    })
    .join("");
  const title = box.title
    ? `<p style="margin:0 0 8px 0;font-family:${SERIF};font-size:18px;color:${c.prugna}">${escapeHtml(box.title)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.avorio};border:1px solid ${c.oro}55;border-radius:12px">
<tr><td style="padding:16px 20px">${title}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
</table>`;
}

function boxText(box: EmailBox): string {
  const lines = box.rows.map(({ label, value }) => `${label}: ${Array.isArray(value) ? value.join(", ") : value}`);
  return [...(box.title ? [box.title.toUpperCase()] : []), ...lines].join("\n");
}

function contactLines(business: BusinessInfo): string[] {
  return [
    ...(business.address ? [business.address] : []),
    ...(business.whatsapp ? [`WhatsApp ${formatPhone(business.whatsapp)}`] : []),
    ...(business.replyTo ? [business.replyTo] : []),
  ];
}

function monogramHtml(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border:1px solid ${c.oro};border-radius:50%;font-family:${SERIF};font-size:19px;letter-spacing:1px;color:${c.prugna};line-height:52px;text-align:center">${escapeHtml(brand.monogram)}</td>
</tr></table>
<p style="margin:12px 0 0 0;text-align:center;font-family:${SERIF};font-size:20px;color:${c.prugna}">${escapeHtml(brand.name)}</p>
<p style="margin:2px 0 0 0;text-align:center;font-size:10px;letter-spacing:4px;color:${c.prugna};opacity:0.7">${escapeHtml(brand.tagline.toUpperCase())}</p>`;
}

export function renderEmail({
  subject,
  body,
  box,
  button,
  business,
}: {
  subject: string;
  body: string;
  box?: EmailBox;
  button?: { label: string; url: string };
  business: BusinessInfo;
}): EmailContent {
  const contacts = contactLines(business);

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.avorio};font-family:${SANS};color:${c.prugna}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.avorio}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${c.white};border-radius:16px;border-top:3px solid ${c.cipria}">
<tr><td style="padding:28px 24px 8px 24px">${monogramHtml()}</td></tr>
<tr><td style="padding:16px 24px 0 24px;font-size:15px;line-height:1.6;color:${c.prugna}">${textToHtml(body)}</td></tr>
${box ? `<tr><td style="padding:0 24px 8px 24px">${boxHtml(box)}</td></tr>` : ""}
${
  button
    ? `<tr><td align="center" style="padding:20px 24px 8px 24px">
<a href="${escapeHtml(button.url)}" style="display:inline-block;background:${c.prugna};color:${c.white};text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:999px">${escapeHtml(button.label)}</a>
</td></tr>`
    : ""
}
<tr><td style="padding:24px 24px 28px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${c.oro}55;padding-top:16px;text-align:center;font-size:12px;line-height:1.6;color:${c.prugna};opacity:0.75">
<span style="font-family:${SERIF};font-size:14px">${escapeHtml(brand.fullName)}</span>${contacts.map((line) => `<br>${escapeHtml(line)}`).join("")}
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    body.replace(/\r\n/g, "\n").trim(),
    ...(box ? [boxText(box)] : []),
    ...(button ? [`${button.label}: ${button.url}`] : []),
    ["—", brand.fullName, ...contacts].join("\n"),
  ].join("\n\n");

  return { subject, html, text: `${text}\n` };
}
