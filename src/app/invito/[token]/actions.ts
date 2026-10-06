"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setPendingLogin } from "@/lib/auth/client";
import { sendCodeInBackground } from "@/lib/auth/clientLogin";
import { PRIVACY_VERSION, signupFieldErrors, signupSchema, type SignupField } from "@/lib/clients/signup";
import { INVITE_SIGNUPS_PER_HOUR, findActiveInvite, signupsInLastHour } from "@/lib/invite/invite";

export type SignupState = {
  error?: string;
  linkInvalid?: boolean;
  fieldErrors?: Partial<Record<SignupField, string>>;
  values?: { firstName: string; lastName: string; phone: string; email: string };
};

export async function signupAction(token: string, _prev: SignupState, formData: FormData): Promise<SignupState> {
  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const link = await findActiveInvite(token);
  if (!link) return { linkInvalid: true };

  const parsed = signupSchema.safeParse({ ...values, privacy: formData.get("privacy") });
  if (!parsed.success) return { fieldErrors: signupFieldErrors(parsed.error), values };
  const data = parsed.data;

  // Limite leggero, uguale per tutte (anche per chi è già iscritta: la risposta non rivela niente).
  if ((await signupsInLastHour(link.id)) >= INVITE_SIGNUPS_PER_HOUR) {
    return { error: "In questo momento non è possibile iscriversi. Riprova più tardi.", values };
  }

  // Email già registrata: niente doppione e nessun dato cambiato, si passa al codice.
  const existing = await prisma.client.findUnique({ where: { email: data.email }, select: { id: true } });
  if (!existing) {
    try {
      await prisma.client.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          source: "INVITE",
          inviteLinkId: link.id,
          privacyAcceptedAt: new Date(),
          privacyVersion: PRIVACY_VERSION,
        },
      });
    } catch (error) {
      // Stessa email inviata due volte nello stesso istante: va bene così.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }

  await setPendingLogin(data.email);
  sendCodeInBackground(data.email);
  redirect("/accedi");
}
