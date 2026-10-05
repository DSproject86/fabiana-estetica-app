"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { brand } from "@/config/brand";
import { logoutAction } from "@/app/admin/actions";
import { ADMIN_NAV } from "./nav-items";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-4 text-[15px] transition-colors ${
                active ? "bg-cipria/30 font-semibold" : "hover:bg-cipria/15"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center rounded-xl px-4 text-left text-sm text-prugna/70 hover:bg-cipria/15"
      >
        Esci
      </button>
    </form>
  );
}

export function AdminNav({ adminName }: { adminName: string }) {
  // Il menu si chiude toccando una voce (onNavigate) o lo sfondo.
  const [open, setOpen] = useState(false);

  const brandBlock = (
    <Link href="/admin/agenda" className="flex items-center gap-3">
      <LogoMark size={40} />
      <span className="flex flex-col leading-tight">
        <span className="font-serif text-lg">{brand.name}</span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-prugna/60">{brand.tagline}</span>
      </span>
    </Link>
  );

  return (
    <>
      {/* Telefono: barra in alto + menu a tendina */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-oro/20 bg-avorio/95 px-4 py-3 backdrop-blur md:hidden">
        {brandBlock}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="admin-menu"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-cipria/20"
        >
          <span className="sr-only">{open ? "Chiudi menu" : "Apri menu"}</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-20 md:hidden">
          <button
            type="button"
            aria-label="Chiudi menu"
            className="absolute inset-0 bg-prugna/20"
            onClick={() => setOpen(false)}
          />
          <nav
            id="admin-menu"
            aria-label="Menu admin"
            className="absolute inset-x-0 top-[65px] max-h-[calc(100dvh-65px)] overflow-y-auto border-b border-oro/20 bg-avorio px-3 pb-4 pt-2 shadow-lg"
          >
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-3 border-t border-oro/20 pt-3">
              <p className="px-4 pb-1 text-xs text-prugna/50">Collegato come {adminName}</p>
              <LogoutButton />
            </div>
          </nav>
        </div>
      ) : null}

      {/* Computer/tablet: barra laterale */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-oro/20 px-4 py-6 md:flex">
        <div className="px-2">{brandBlock}</div>
        <nav aria-label="Menu admin" className="flex-1">
          <NavLinks />
        </nav>
        <div className="border-t border-oro/20 pt-3">
          <p className="px-4 pb-1 text-xs text-prugna/50">Collegato come {adminName}</p>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
