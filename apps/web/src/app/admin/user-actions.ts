"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteUserForAdmin, userForAdmin } from "@bookon/db";
import { adminEmail, requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Delete an account, for a privacy request. Needs the email typed in to confirm. */
export async function deleteUserAccount(formData: FormData) {
  const { actor } = await requireAdmin();
  const db = getDb();
  const id = String(formData.get("id") ?? "");
  const user = await userForAdmin(db, id, adminEmail());
  if (!user) redirect("/admin/users");
  if (user!.groups.includes("admin")) redirect(`/admin/users/${id}?error=self`);
  const typed = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();
  if (typed !== user!.email) redirect(`/admin/users/${id}?error=confirm`);
  await deleteUserForAdmin(db, user!, actor, new Date());
  revalidatePath("/admin", "layout");
  redirect("/admin/users?deleted=1");
}
