"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { aisleFor, dietFlagsFor, itemKey, parseIngredientLine } from "@/lib/ingredients";
import type { Aisle } from "@/lib/types";

export type IngredientInput = {
  quantityText: string;
  item: string;
  note?: string | null;
};

export type RecipeInput = {
  id?: string;
  title: string;
  description?: string | null;
  totalMinutes?: number | null;
  servings: number;
  ovenTempF?: number | null;
  cuisine?: string | null;
  category?: string | null;
  tags: string[];
  instructions: string[];
  ingredients: IngredientInput[];
  imagePath?: string | null;
};

function effortFrom(minutes: number | null | undefined, steps: number): number {
  const m = minutes ?? 45;
  if (m <= 30 && steps <= 5) return 1;
  if (m >= 90 || steps >= 10) return 3;
  return 2;
}

export async function saveRecipe(input: RecipeInput) {
  const session = await requireSession();
  const supabase = await createClient();

  const parsed = input.ingredients
    .map((row, index) =>
      parseIngredientLine(`${row.quantityText} ${row.item}`.trim(), index),
    )
    .filter(Boolean)
    .map((row, index) => ({ ...row!, position: index }));

  const keys = parsed.map((row) => row.item_key);

  const payload = {
    title: input.title.trim() || "Untitled",
    description: input.description ?? null,
    total_minutes: input.totalMinutes ?? null,
    servings: input.servings || 4,
    oven_temp_f: input.ovenTempF ?? null,
    cuisine: input.cuisine ?? null,
    category: input.category ?? "dinner",
    tags: input.tags,
    diet_flags: dietFlagsFor(keys),
    effort: effortFrom(input.totalMinutes, input.instructions.length),
    instructions: input.instructions.filter((step) => step.trim()),
    image_path: input.imagePath ?? null,
    is_public: false,
    owner_id: session.userId,
    household_id: session.household.id,
    updated_at: new Date().toISOString(),
  };

  let recipeId = input.id;

  if (recipeId) {
    const { error } = await supabase.from("recipes").update(payload).eq("id", recipeId);
    if (error) return { error: error.message };
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  } else {
    const { data, error } = await supabase
      .from("recipes")
      .insert({ ...payload, source: "user" })
      .select("id")
      .single();
    if (error) return { error: error.message };
    recipeId = data.id as string;
  }

  if (parsed.length) {
    await supabase.from("recipe_ingredients").insert(
      parsed.map((row) => ({
        recipe_id: recipeId,
        position: row.position,
        raw_text: row.raw_text,
        quantity: row.quantity,
        unit: row.unit,
        pack_size_qty: row.pack_size_qty,
        pack_size_unit: row.pack_size_unit,
        item: row.item,
        item_key: row.item_key,
        alt_item: row.alt_item,
        note: row.note,
        aisle: row.aisle as Aisle,
        optional: row.optional,
      })),
    );
  }

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true, id: recipeId };
}

export async function forkRecipe(recipeId: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: original } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("id", recipeId)
    .single();

  if (!original) return { error: "That recipe is gone" };

  const { data: copy, error } = await supabase
    .from("recipes")
    .insert({
      title: original.title,
      description: original.description,
      source: "user",
      source_url: original.source_url,
      image_url: original.image_url,
      image_path: original.image_path,
      instructions: original.instructions,
      total_minutes: original.total_minutes,
      active_minutes: original.active_minutes,
      servings: original.servings,
      oven_temp_f: original.oven_temp_f,
      cuisine: original.cuisine,
      category: original.category,
      tags: original.tags,
      diet_flags: original.diet_flags,
      effort: original.effort,
      is_public: false,
      owner_id: session.userId,
      household_id: session.household.id,
      forked_from: original.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const ingredients = (original.recipe_ingredients ?? []) as Array<Record<string, unknown>>;
  if (ingredients.length) {
    await supabase.from("recipe_ingredients").insert(
      ingredients.map((row) => ({
        recipe_id: copy.id,
        position: row.position,
        raw_text: row.raw_text,
        quantity: row.quantity,
        unit: row.unit,
        pack_size_qty: row.pack_size_qty,
        pack_size_unit: row.pack_size_unit,
        item: row.item,
        item_key: row.item_key,
        alt_item: row.alt_item,
        note: row.note,
        aisle: row.aisle,
        optional: row.optional,
      })),
    );
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${copy.id}/edit`);
}

export async function deleteRecipe(id: string) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("household_id", session.household.id);

  if (error) return { error: error.message };
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function toggleSaved(recipeId: string, saved: boolean) {
  const session = await requireSession();
  const supabase = await createClient();

  await supabase.from("recipe_events").insert({
    household_id: session.household.id,
    user_id: session.userId,
    recipe_id: recipeId,
    kind: saved ? "saved" : "unsaved",
  });

  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true };
}

export async function addRecipePhoto(input: {
  recipeId: string;
  storagePath: string;
  width: number;
  height: number;
  bytes: number;
  caption?: string | null;
}) {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.from("recipe_photos").insert({
    recipe_id: input.recipeId,
    household_id: session.household.id,
    taken_by: session.userId,
    storage_path: input.storagePath,
    width: input.width,
    height: input.height,
    bytes: input.bytes,
    caption: input.caption ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/recipes/${input.recipeId}`);
  return { ok: true };
}

export async function removeRecipePhoto(id: string, recipeId: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.from("recipe_photos").delete().eq("id", id);
  revalidatePath(`/recipes/${recipeId}`);
  return { ok: true };
}

export async function addIngredientsToList(recipeId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { currentListId } = await import("@/lib/server/list");
  const { startOfWeek, toISODate } = await import("@/lib/dates");

  const weekStart = toISODate(startOfWeek(new Date()));
  const listId = await currentListId(session.household.id, weekStart);
  if (!listId) return { error: "No list this week" };

  const { data: recipe } = await supabase
    .from("recipes")
    .select("title, recipe_ingredients(*)")
    .eq("id", recipeId)
    .single();

  if (!recipe) return { error: "That recipe is gone" };

  const rows = (recipe.recipe_ingredients ?? []) as Array<{
    item: string;
    item_key: string;
    quantity: number | null;
    unit: string | null;
    aisle: string;
    optional: boolean;
  }>;

  await supabase.from("grocery_items").upsert(
    rows
      .filter((row) => !row.optional)
      .map((row) => ({
        list_id: listId,
        household_id: session.household.id,
        item: row.item,
        item_key: row.item_key,
        quantity: row.quantity,
        unit: row.unit,
        aisle: (row.aisle ?? aisleFor(row.item_key)) as Aisle,
        source: "manual" as const,
        from_recipes: [recipe.title],
        added_by: session.userId,
      })),
    { onConflict: "list_id,item_key,source", ignoreDuplicates: true },
  );

  revalidatePath("/list");
  return { ok: true };
}

export async function renameRecipe(id: string, title: string) {
  await requireSession();
  const supabase = await createClient();
  await supabase.from("recipes").update({ title: title.trim() }).eq("id", id);
  revalidatePath(`/recipes/${id}`);
  return { ok: true };
}

export { itemKey };
