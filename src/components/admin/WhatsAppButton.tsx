import { WhatsAppIcon } from "@/components/client/WhatsAppIcon";

/** Link wa.me (apre WhatsApp col testo già scritto). */
export function WhatsAppButton({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-salvia/30 font-medium text-prugna hover:bg-salvia/50 ${
        compact ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm"
      }`}
    >
      <WhatsAppIcon size={compact ? 15 : 18} />
      {label}
    </a>
  );
}
