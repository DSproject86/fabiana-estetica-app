"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Category = { id: string; name: string; services: { id: string; name: string; detail: string }[] };

/** Spunte dei servizi: aggiornano l'indirizzo (?s=…) e la pagina ricalcola gli orari. */
export function ServicePicker({ categories, initial }: { categories: Category[]; initial: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // La spunta cambia subito; gli orari si ricalcolano sul server in sottofondo.
  const [selected, setSelected] = useState(initial);

  const toggle = (id: string, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((s) => s !== id);
    setSelected(next);
    startTransition(() => {
      router.replace(next.length ? `${pathname}?s=${next.join(",")}` : pathname, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {categories.map((c) => (
        <fieldset key={c.id} className="flex flex-col gap-2">
          <legend className="mb-1 font-serif text-lg">{c.name}</legend>
          {c.services.map((s) => {
            const checked = selected.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 ${
                  checked ? "border-prugna/40 bg-cipria/15" : "border-prugna/15 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                  className="size-5 shrink-0 accent-[var(--color-prugna)]"
                />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm text-prugna/60">{s.detail}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
      {pending ? <p className="text-sm text-prugna/60">Calcolo degli orari…</p> : null}
    </div>
  );
}
