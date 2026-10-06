"use client";

import { useOptimistic, useTransition } from "react";
import { setAdminNotifyAction } from "./actions";

type AdminRow = { id: string; name: string; email: string; notifyNewBooking: boolean };

/** Un interruttore per admin: email a ogni prenotazione fatta da una cliente. Si salva subito. */
export function AdminNotifyToggles({ admins }: { admins: AdminRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Avviso email per le nuove prenotazioni</p>
      <p className="text-xs text-prugna/60">Arriva quando una cliente prenota dall&apos;app (non per gli appuntamenti inseriti da voi).</p>
      <ul className="flex flex-col gap-2">
        {admins.map((admin) => (
          <AdminToggle key={admin.id} admin={admin} />
        ))}
      </ul>
    </div>
  );
}

function AdminToggle({ admin }: { admin: AdminRow }) {
  const [enabled, setEnabled] = useOptimistic(admin.notifyNewBooking);
  const [pending, startTransition] = useTransition();
  const id = `notify-${admin.id}`;

  return (
    <li>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-prugna/15 bg-white p-4">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            startTransition(async () => {
              setEnabled(next);
              await setAdminNotifyAction(admin.id, next);
            });
          }}
          className="size-5 shrink-0 accent-[var(--color-prugna)]"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{admin.name}</span>
          <span className="truncate text-xs text-prugna/60">{admin.email}</span>
        </span>
      </label>
    </li>
  );
}
