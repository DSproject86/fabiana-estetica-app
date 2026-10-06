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

export function FormActions({ pending, submitLabel }: { pending: boolean; submitLabel: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
      <Link
        href="/admin/listino"
        className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-medium hover:bg-cipria/20"
      >
        Annulla
      </Link>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvataggio…" : submitLabel}
      </Button>
    </div>
  );
}
