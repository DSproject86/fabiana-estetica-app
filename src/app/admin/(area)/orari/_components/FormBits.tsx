import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
      {message}
    </p>
  );
}

export function SaveBar({ pending, label, cancelHref }: { pending: boolean; label: string; cancelHref: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium hover:bg-cipria/20">
        Annulla
      </Link>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvataggio…" : label}
      </Button>
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 text-sm text-prugna/60 hover:text-prugna">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {label}
    </Link>
  );
}
