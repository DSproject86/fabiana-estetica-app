import type { Metadata } from "next";
import { headers } from "next/headers";
import { BackHeader } from "@/components/admin/BackHeader";
import { requireAdmin } from "@/lib/auth/admin";
import { vapidConfig } from "@/lib/push/config";
import { listDevices } from "@/lib/push/devices";
import { suggestDeviceName } from "@/lib/push/subscription";
import { dayKeyOf, formatDayShort, formatTime } from "@/lib/time/rome";
import { ChangePasswordForm, SignOutEverywhere } from "./AccountForms";
import { PushSettings } from "./PushSettings";

export const metadata: Metadata = { title: "Il mio account" };

const when = (d: Date) => `${formatDayShort(dayKeyOf(d))} alle ${formatTime(d)}`;

export default async function AccountPage() {
  const admin = await requireAdmin();
  const [devices, requestHeaders] = await Promise.all([listDevices(admin.id), headers()]);

  return (
    <div className="flex flex-col gap-6">
      <BackHeader back={{ href: "/admin/impostazioni", label: "Impostazioni" }} title="Il mio account" description={`${admin.name} · ${admin.email}`} />
      <section aria-labelledby="notifiche" className="flex flex-col gap-3">
        <h2 id="notifiche" className="text-xl">
          Notifiche su questo dispositivo
        </h2>
        <PushSettings
          vapidPublicKey={vapidConfig()?.publicKey ?? null}
          suggestedName={suggestDeviceName(requestHeaders.get("user-agent") ?? "", admin.name)}
          devices={devices.map((d) => ({
            id: d.id,
            endpoint: d.endpoint,
            name: d.deviceName,
            createdLabel: formatDayShort(dayKeyOf(d.createdAt)),
            lastUsedLabel: d.lastUsedAt ? when(d.lastUsedAt) : null,
          }))}
        />
      </section>
      <section aria-labelledby="password" className="flex flex-col gap-3">
        <h2 id="password" className="text-xl">
          Cambia password
        </h2>
        <ChangePasswordForm email={admin.email} />
      </section>
      <section aria-labelledby="dispositivi" className="flex flex-col gap-3">
        <h2 id="dispositivi" className="text-xl">
          Accessi
        </h2>
        <SignOutEverywhere />
      </section>
    </div>
  );
}
