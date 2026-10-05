import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "./session";

export type CurrentAdmin = { id: string; name: string; email: string };

/** Admin collegato (firma, scadenza e sessionVersion verificate), oppure null. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(ADMIN_COOKIE)?.value, "admin");
  if (!session) return null;

  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, sessionVersion: true },
  });
  if (!admin || admin.sessionVersion !== session.ver) return null;

  return { id: admin.id, name: admin.name, email: admin.email };
});

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function startAdminSession(admin: { id: string; sessionVersion: number }) {
  const token = await signSession(
    { sub: admin.id, role: "admin", ver: admin.sessionVersion },
    ADMIN_SESSION_SECONDS,
  );
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, sessionCookieOptions(ADMIN_SESSION_SECONDS));
}

export async function endAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
