import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Accesso admin", robots: { index: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; uscito?: string }>;
}) {
  if (await getCurrentAdmin()) redirect("/admin/agenda");
  const { next, uscito } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex justify-center">
        <Logo width={180} />
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-prugna/5">
        <h1 className="mb-1 text-2xl">Area riservata</h1>
        <p className="mb-6 text-sm text-prugna/70">Accesso per l&apos;amministrazione.</p>
        {uscito === "1" ? (
          <p role="status" className="mb-4 rounded-xl bg-salvia/25 px-3 py-2 text-sm">
            Accesso chiuso su tutti i dispositivi.
          </p>
        ) : null}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
