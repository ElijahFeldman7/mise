"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { currentListId, rebuildGroceryList } from "@/lib/server/list";
import { aisleFor, itemKey } from "@/lib/ingredients";
import { parseIngredientLine } from "@/lib/ingredients";
import { formatQuantity } from "@/lib/units";
import { startOfWeek, toISODate } from "@/lib/dates";
import type { Aisle } from "@/lib/types";

function thisWeek() {
  return toISODate(startOfWeek(new Date()));
}

export async function toggleGroceryItem(id: string, checked: boolean) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase
    .from("grocery_items")
    .update({
      checked,
      checked_at: checked ? new Date().toISOString() : null,
      checked_by: checked ? session.userId : null,
      checked_via: checked ? "tap" : null,
    })
    .eq("id", id);

  revalidatePath("/list");
  return { ok: true };
}

export async function addManualItem(text: string) {
  const session = await requireSession();
  const trimmed = text.trim();
  if (!trimmed) return { error: "Nothing to add" };

  const supabase = await createClient();
  const weekStart = thisWeek();
  const listId = await currentListId(session.household.id, weekStart);
  if (!listId) return { error: "No list for this week" };

  const parsed = parseIngredientLine(trimmed, 0);
  const key = parsed?.item_key ?? itemKey(trimmed);

  const { error } = await supabase.from("grocery_items").insert({
    list_id: listId,
    household_id: session.household.id,
    item: parsed?.item ?? trimmed,
    item_key: key,
    quantity: parsed?.quantity ?? null,
    unit: parsed?.unit ?? null,
    display_qty: parsed ? formatQuantity(parsed.quantity, parsed.unit) || null : null,
    aisle: (parsed?.aisle ?? aisleFor(key)) as Aisle,
    source: "manual",
    added_by: session.userId,
    position: 999,
  });

  if (error && !error.message.includes("duplicate")) return { error: error.message };

  revalidatePath("/list");
  return { ok: true };
}

export async function removeGroceryItem(id: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.from("grocery_items").delete().eq("id", id);
  revalidatePath("/list");
  return { ok: true };
}

export async function clearCheckedItems() {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("grocery_items")
    .delete()
    .eq("household_id", session.household.id)
    .eq("checked", true);
  revalidatePath("/list");
  return { ok: true };
}

export async function keepInPantry(item: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const key = itemKey(item);

  await supabase
    .from("pantry_items")
    .upsert({ household_id: session.household.id, item_key: key, item });

  await supabase
    .from("grocery_items")
    .delete()
    .eq("household_id", session.household.id)
    .eq("item_key", key)
    .eq("source", "plan");

  revalidatePath("/list");
  revalidatePath("/you");
  return { ok: true };
}

export async function removeFromPantry(itemKeyValue: string) {
  const session = await requireSession();
  const supabase = await createClient();
  await supabase
    .from("pantry_items")
    .delete()
    .eq("household_id", session.household.id)
    .eq("item_key", itemKeyValue);
  revalidatePath("/you");
  return { ok: true };
}

export async function refreshListFromPlan() {
  const session = await requireSession();
  const result = await rebuildGroceryList(session.household.id, thisWeek());
  revalidatePath("/list");
  return result;
}
