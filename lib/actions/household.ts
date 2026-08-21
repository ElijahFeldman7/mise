"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { itemKey } from "@/lib/ingredients";

export async function renameHousehold(name: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("households")
    .update({ name: name.trim() || "My household" })
    .eq("id", session.household.id);

  if (error) return { error: error.message };
  revalidatePath("/household");
  return { ok: true };
}

export async function joinHousehold(code: string) {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("join_household", { code: code.trim() });
  if (error) return { error: error.message };

  revalidatePath("/household");
  revalidatePath("/week");
  revalidatePath("/list");
  return { ok: true };
}

export async function switchHousehold(householdId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase
    .from("profiles")
    .update({ active_household_id: householdId })
    .eq("id", session.userId);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function leaveHousehold(householdId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", session.userId);

  const { data: remaining } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", session.userId)
    .limit(1)
    .maybeSingle();

  await supabase
    .from("profiles")
    .update({ active_household_id: remaining?.household_id ?? null })
    .eq("id", session.userId);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMember(userId: string) {
  const session = await requireSession();
  if (session.role !== "owner") return { error: "Only the owner can do that" };

  const supabase = await createClient();
  await supabase
    .from("household_members")
    .delete()
    .eq("household_id", session.household.id)
    .eq("user_id", userId);

  revalidatePath("/household");
  return { ok: true };
}

export async function setMemberRole(userId: string, role: "owner" | "member") {
  const session = await requireSession();
  if (session.role !== "owner") return { error: "Only the owner can do that" };

  const supabase = await createClient();
  await supabase
    .from("household_members")
    .update({ role })
    .eq("household_id", session.household.id)
    .eq("user_id", userId);

  revalidatePath("/household");
  return { ok: true };
}

export async function rollInviteCode() {
  const session = await requireSession();
  if (session.role !== "owner") return { error: "Only the owner can do that" };

  const supabase = await createClient();
  const code = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
  ).join("");

  const { error } = await supabase
    .from("households")
    .update({ invite_code: code })
    .eq("id", session.household.id);

  if (error) return { error: error.message };
  revalidatePath("/household");
  return { ok: true, code };
}

export async function updateProfile(patch: {
  displayName?: string;
  dietTags?: string[];
  avoidIngredients?: string[];
  likedCuisines?: string[];
  weeknightMaxMinutes?: number;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      ...(patch.dietTags !== undefined ? { diet_tags: patch.dietTags } : {}),
      ...(patch.avoidIngredients !== undefined
        ? { avoid_ingredients: patch.avoidIngredients.map((item) => itemKey(item)) }
        : {}),
      ...(patch.likedCuisines !== undefined ? { liked_cuisines: patch.likedCuisines } : {}),
      ...(patch.weeknightMaxMinutes !== undefined
        ? { weeknight_max_minutes: patch.weeknightMaxMinutes }
        : {}),
    })
    .eq("id", session.userId);

  if (error) return { error: error.message };
  revalidatePath("/you");
  return { ok: true };
}
