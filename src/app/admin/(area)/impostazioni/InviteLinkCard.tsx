"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/client/WhatsAppIcon";
import { brand } from "@/config/brand";
import { whatsappShareLink } from "@/lib/whatsapp";
import { regenerateInviteAction } from "./actions";

export function InviteLinkCard({ url, signups, createdLabel }: { url: string | null; signups: number; createdLabel: string | null }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copia il link:", url); // browser senza permesso per gli appunti
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const regenerate = () => {
    if (url && !window.confirm("Creare un nuovo link? Quello attuale smetterà subito di funzionare.")) return;
    startTransition(() => regenerateInviteAction());
  };

  const shareText = url
    ? `Ciao! Da ora puoi prenotare online da ${brand.fullName}. Iscriviti da qui: ${url}`
    : "";

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-prugna/5">
      {url ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Link attivo</span>
            <code className="rounded-xl bg-avorio px-3 py-2.5 text-sm break-all">{url}</code>
            <span className="text-xs text-prugna/60">
              {createdLabel ? `Creato ${createdLabel} · ` : ""}
              {signups === 1 ? "1 cliente iscritta" : `${signups} clienti iscritte`} con questo link
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={copy}>
              {copied ? "Copiato!" : "Copia"}
            </Button>
            <a
              href={whatsappShareLink(shareText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-salvia px-5 text-sm font-medium text-prugna hover:bg-salvia/85"
            >
              <WhatsAppIcon size={18} />
              Condividi su WhatsApp
            </a>
            <Button type="button" variant="ghost" onClick={regenerate} disabled={pending}>
              {pending ? "Rigenerazione…" : "Rigenera"}
            </Button>
          </div>
          <p className="text-xs text-prugna/60">
            Massimo 5 iscrizioni all&apos;ora con lo stesso link. Se il link è finito in mani sbagliate, rigeneralo:
            le clienti già iscritte continuano ad accedere normalmente.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-prugna/70">Non c&apos;è ancora un link d&apos;invito attivo.</p>
          <Button type="button" onClick={regenerate} disabled={pending} className="w-fit">
            {pending ? "Creazione…" : "Crea link"}
          </Button>
        </>
      )}
    </div>
  );
}
