"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function setAdmin(userId: string, isAdmin: boolean) {
  const session = await requireAdmin();
  if (userId === session.userId && !isAdmin) {
    return { error: "You cannot take your own admin away" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}
