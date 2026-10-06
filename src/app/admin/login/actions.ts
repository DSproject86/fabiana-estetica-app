"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { startAdminSession } from "@/lib/auth/admin";
import { afterFailedAttempt, isLocked } from "@/lib/auth/lockout";
import { normalizePassword, verifyPasswordOrDummy } from "@/lib/auth/password";

export type LoginState = { error?: string; email?: string };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().transform(normalizePassword).pipe(z.string().min(1).max(200)),
  next: z.string().optional(),
});

/** Solo percorsi interni all'area admin, per evitare redirect verso altri siti. */
function safeNext(next: string | undefined): string {
  if (next && /^\/admin(\/[\w\-/]*)?$/.test(next) && !next.startsWith("/admin/login")) {
    return next;
  }
  return "/admin/agenda";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  const typedEmail = String(formData.get("email") ?? "");
  if (!parsed.success) {
    return { error: "Inserisci email e password.", email: typedEmail };
  }
  const { email, password, next } = parsed.data;

  const admin = await prisma.admin.findUnique({ where: { email } });
  const now = new Date();

  if (admin && isLocked(admin.lockedUntil, now)) {
    return { error: "Troppi tentativi. Riprova tra qualche minuto.", email: typedEmail };
  }

  const ok = await verifyPasswordOrDummy(password, admin?.passwordHash);

  if (!admin || !ok) {
    if (admin) {
      const failed = afterFailedAttempt(admin.failedLoginCount, now);
      await prisma.admin.update({ where: { id: admin.id }, data: failed });
      if (failed.lockedUntil) {
        return { error: "Troppi tentativi. Riprova tra qualche minuto.", email: typedEmail };
      }
    }
    return { error: "Email o password non corretti.", email: typedEmail };
  }

  if (admin.failedLoginCount !== 0 || admin.lockedUntil) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  await startAdminSession(admin);
  redirect(safeNext(next));
}
