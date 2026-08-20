"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { rebuildGroceryList } from "@/lib/server/list";
import { startOfWeek, fromISODate, toISODate } from "@/lib/dates";

async function refreshWeek(householdId: string, date: string) {
  const weekStart = toISODate(startOfWeek(fromISODate(date)));
  await rebuildGroceryList(householdId, weekStart);
  revalidatePath("/week");
  revalidatePath(`/day/${date}`);
  revalidatePath("/list");
}

export async function addPlanEntry(input: {
  date: string;
  slotLabel: string;
  slotTime?: string | null;
  recipeId?: string | null;
  freeText?: string | null;
  servings?: number;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: siblings } = await supabase
    .from("plan_entries")
    .select("position")
    .eq("household_id", session.household.id)
    .eq("on_date", input.date)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("plan_entries").insert({
    household_id: session.household.id,
    on_date: input.date,
    slot_label: input.slotLabel,
    slot_time: input.slotTime ?? null,
    position: (siblings?.[0]?.position ?? -1) + 1,
    recipe_id: input.recipeId ?? null,
    free_text: input.recipeId ? null : (input.freeText ?? "Something"),
    servings: input.servings ?? 2,
    created_by: session.userId,
  });

  if (error) return { error: error.message };

  if (input.recipeId) {
    await supabase.from("recipe_events").insert({
      household_id: session.household.id,
      user_id: session.userId,
      recipe_id: input.recipeId,
      kind: "planned",
    });
  }

  await refreshWeek(session.household.id, input.date);
  return { ok: true };
}

export async function updatePlanEntry(
  id: string,
  date: string,
  patch: { slotLabel?: string; slotTime?: string | null; servings?: number; note?: string | null },
) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("plan_entries")
    .update({
      ...(patch.slotLabel !== undefined ? { slot_label: patch.slotLabel } : {}),
      ...(patch.slotTime !== undefined ? { slot_time: patch.slotTime } : {}),
      ...(patch.servings !== undefined ? { servings: patch.servings } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await refreshWeek(session.household.id, date);
  return { ok: true };
}

export async function removePlanEntry(id: string, date: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.from("plan_entries").delete().eq("id", id);
  if (error) return { error: error.message };

  await refreshWeek(session.household.id, date);
  return { ok: true };
}

/** "We actually made this" — the strongest signal the recommender gets. */
export async function markCooked(entryId: string, date: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("plan_entries")
    .select("recipe_id, cooked_at")
    .eq("id", entryId)
    .single();

  const cooked = entry?.cooked_at ? null : new Date().toISOString();
  await supabase.from("plan_entries").update({ cooked_at: cooked }).eq("id", entryId);

  if (cooked && entry?.recipe_id) {
    await supabase.from("recipe_events").insert({
      household_id: session.household.id,
      user_id: session.userId,
      recipe_id: entry.recipe_id,
      kind: "cooked",
    });
  }

  revalidatePath(`/day/${date}`);
  revalidatePath("/week");
  return { ok: true };
}

export async function rateRecipe(recipeId: string, rating: number) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase.from("recipe_events").insert({
    household_id: session.household.id,
    user_id: session.userId,
    recipe_id: recipeId,
    kind: "rated",
    rating: Math.max(1, Math.min(5, Math.round(rating))),
  });

  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true };
}

export async function skipSuggestion(recipeId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase.from("recipe_events").insert({
    household_id: session.household.id,
    user_id: session.userId,
    recipe_id: recipeId,
    kind: "skipped",
  });
  return { ok: true };
}

export async function addSlotTemplate(name: string, time: string | null) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: siblings } = await supabase
    .from("slot_templates")
    .select("position")
    .eq("household_id", session.household.id)
    .order("position", { ascending: false })
    .limit(1);

  await supabase.from("slot_templates").insert({
    household_id: session.household.id,
    name,
    at_time: time,
    position: (siblings?.[0]?.position ?? -1) + 1,
  });

  revalidatePath("/week");
  return { ok: true };
}
