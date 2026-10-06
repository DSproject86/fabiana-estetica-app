"use server";

import { redirect } from "next/navigation";
import { endClientSession } from "@/lib/auth/client";

export async function logoutClientAction() {
  await endClientSession();
  redirect("/");
}
