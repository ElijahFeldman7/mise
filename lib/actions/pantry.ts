"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { aisleFor, itemKey } from "@/lib/ingredients";
import { formatQuantity, parseMeasure } from "@/lib/units";
import { currentListId } from "@/lib/server/list";
import { startOfWeek, toISODate } from "@/lib/dates";
import type { Aisle, PantryStatus } from "@/lib/types";

const thisWeek = () => toISODate(startOfWeek(new Date()));

/**
 * One tap moves an item along: have → running low → out → have again. Going
 * "out" puts it on this week's list; coming back to "have" takes it off, unless
 * somebody already ticked it, in which case they bought it and it stays bought.
 */
export async function setPantryStatus(key: string, status: PantryStatus) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pantry_items")
    .select("item")
    .eq("household_id", session.household.id)
    .eq("item_key", key)
    .maybeSingle();

  await supabase
    .from("pantry_items")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "have" ? { used_since_buy: 0 } : {}),
    })
    .eq("household_id", session.household.id)
    .eq("item_key", key);

  if (status === "out") {
    await pushToList(supabase, session.household.id, session.userId, key, existing?.item ?? key);
  } else if (status === "have") {
    await supabase
      .from("grocery_items")
      .delete()
      .eq("household_id", session.household.id)
      .eq("item_key", key)
      .eq("source", "pantry")
      .eq("checked", false);
  }

  revalidatePath("/list");
  revalidatePath("/list/cupboard");
  return { ok: true };
}

/** Tapping chips in the starter kit — one round trip for the lot. */
export async function addPantryItems(names: string[]) {
  const session = await requireSession();
  if (!names.length) return { ok: true };

  const supabase = await createClient();
  const rows = new Map<string, { item_key: string; item: string; aisle: Aisle }>();

  for (const name of names) {
    const key = itemKey(name);
    if (!key) continue;
    rows.set(key, { item_key: key, item: name.trim(), aisle: aisleFor(key) as Aisle });
  }

  const { error } = await supabase.from("pantry_items").upsert(
    [...rows.values()].map((row) => ({
      household_id: session.household.id,
      ...row,
      kind: "staple" as const,
      status: "have" as const,
      added_by: session.userId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "household_id,item_key" },
  );
  if (error) return { error: error.message };

  await supabase
    .from("grocery_items")
    .delete()
    .eq("household_id", session.household.id)
    .eq("source", "pantry")
    .eq("checked", false)
    .in("item_key", [...rows.keys()]);

  revalidatePath("/list");
  revalidatePath("/list/cupboard");
  return { ok: true };
}

export async function removePantryItem(key: string) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase
    .from("pantry_items")
    .delete()
    .eq("household_id", session.household.id)
    .eq("item_key", key);

  revalidatePath("/list");
  revalidatePath("/list/cupboard");
  return { ok: true };
}

/** "1 kg", "500g", "2 jars" — blank wipes it back to just having some. */
export async function setPantryAmount(key: string, text: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { quantity, unit } = parseMeasure(text.trim() || null);

  await supabase
    .from("pantry_items")
    .update({ quantity, unit, kind: quantity === null ? "staple" : "stock", updated_at: new Date().toISOString() })
    .eq("household_id", session.household.id)
    .eq("item_key", key);

  revalidatePath("/list");
  revalidatePath("/list/cupboard");
  return { ok: true, display: formatQuantity(quantity, unit) };
}

/** Buying something restocks it: called after a receipt, and after a tick. */
export async function markRestocked(keys: string[]) {
  const session = await requireSession();
  if (!keys.length) return { ok: true };

  const supabase = await createClient();
  await supabase
    .from("pantry_items")
    .update({ status: "have", used_since_buy: 0, updated_at: new Date().toISOString() })
    .eq("household_id", session.household.id)
    .in("item_key", keys);

  revalidatePath("/list/cupboard");
  return { ok: true };
}

async function pushToList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  userId: string,
  key: string,
  item: string,
) {
  const listId = await currentListId(householdId, thisWeek());
  if (!listId) return;

  await supabase.from("grocery_items").upsert(
    {
      list_id: listId,
      household_id: householdId,
      item,
      item_key: key,
      aisle: aisleFor(key) as Aisle,
      source: "pantry",
      note: "out at home",
      added_by: userId,
      position: 500,
    },
    { onConflict: "list_id,item_key,source", ignoreDuplicates: true },
  );
}

/**
 * The one nudge: after enough cooking with something, ask once. Answering
 * either way clears the counter, so it never asks twice in a row.
 */
export async function answerNudge(key: string, stillHave: boolean) {
  const session = await requireSession();
  const supabase = await createClient();

  if (stillHave) {
    await supabase
      .from("pantry_items")
      .update({ used_since_buy: 0, updated_at: new Date().toISOString() })
      .eq("household_id", session.household.id)
      .eq("item_key", key);

    revalidatePath("/list");
    return { ok: true };
  }

  return setPantryStatus(key, "out");
}
