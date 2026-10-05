"use server";

import { redirect } from "next/navigation";
import { endAdminSession } from "@/lib/auth/admin";

export async function logoutAction() {
  await endAdminSession();
  redirect("/admin/login");
}
