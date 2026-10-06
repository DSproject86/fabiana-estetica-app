import type { Metadata } from "next";
import { BackHeader } from "@/components/admin/BackHeader";
import { requireAdmin } from "@/lib/auth/admin";
import { ChangePasswordForm, SignOutEverywhere } from "./AccountForms";

export const metadata: Metadata = { title: "Il mio account" };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <BackHeader back={{ href: "/admin/impostazioni", label: "Impostazioni" }} title="Il mio account" description={`${admin.name} · ${admin.email}`} />
      <section aria-labelledby="password" className="flex flex-col gap-3">
        <h2 id="password" className="text-xl">
          Cambia password
        </h2>
        <ChangePasswordForm email={admin.email} />
      </section>
      <section aria-labelledby="dispositivi" className="flex flex-col gap-3">
        <h2 id="dispositivi" className="text-xl">
          Dispositivi
        </h2>
        <SignOutEverywhere />
      </section>
    </div>
  );
}
