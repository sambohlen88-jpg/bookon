"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { removeRatingAsAdmin } from "@bookon/db";
import { requireAdmin } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Take down a rating that looks like spam or a grudge (Milestone 20). */
export async function removeRating(formData: FormData) {
  const { actor } = await requireAdmin();
  const removed = await removeRatingAsAdmin(
    getDb(),
    String(formData.get("userId") ?? ""),
    String(formData.get("courseId") ?? ""),
    actor,
    new Date(),
  );
  revalidatePath("/admin/ratings");
  redirect(`/admin/ratings?${removed ? "removed=1" : "gone=1"}`);
}
