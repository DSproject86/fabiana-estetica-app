import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminAreaLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="md:flex">
      <AdminNav adminName={admin.name} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
