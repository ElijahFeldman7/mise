import { createClient } from "@/lib/supabase/server";
import { buildGroceryRows, diffGroceryRows, type PlannedRecipe } from "@/lib/groceries";
import { addDays, fromISODate, toISODate } from "@/lib/dates";

export async function rebuildGroceryList(householdId: string, weekStart: string) {
  const supabase = await createClient();
  const start = fromISODate(weekStart);
  const weekEnd = toISODate(addDays(start, 6));

  const { data: entries } = await supabase
    .from("plan_entries")
    .select(
      "id, servings, recipe_id, recipe:recipes(title, servings, recipe_ingredients(*))",
    )
    .eq("household_id", householdId)
    .gte("on_date", weekStart)
    .lte("on_date", weekEnd);

  const planned: PlannedRecipe[] = [];
  for (const row of (entries ?? []) as unknown as Array<{
    id: string;
    servings: number;
    recipe_id: string | null;
    recipe: {
      title: string;
      servings: number;
      recipe_ingredients: PlannedRecipe["ingredients"];
    } | null;
  }>) {
    if (!row.recipe) continue;
    planned.push({
      entry: { id: row.id, servings: row.servings, recipe_id: row.recipe_id },
      recipeTitle: row.recipe.title,
      recipeServings: row.recipe.servings || 4,
      ingredients: row.recipe.recipe_ingredients ?? [],
    });
  }

  const { data: pantry } = await supabase
    .from("pantry_items")
    .select("item_key")
    .eq("household_id", householdId);
  const pantryKeys = new Set((pantry ?? []).map((row) => row.item_key as string));

  const desired = buildGroceryRows(planned, pantryKeys);

  let listId: string | null = null;
  const { data: found } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (found) {
    listId = found.id as string;
  } else {
    const { data: created } = await supabase
      .from("grocery_lists")
      .insert({ household_id: householdId, week_start: weekStart })
      .select("id")
      .single();
    listId = (created?.id as string) ?? null;
  }
  if (!listId) return { inserted: 0, updated: 0, removed: 0 };

  const { data: existing } = await supabase
    .from("grocery_items")
    .select("id, item_key, source, checked, quantity, unit, display_qty")
    .eq("list_id", listId);

  const { insert, update, remove } = diffGroceryRows(desired, existing ?? []);

  if (insert.length) {
    await supabase.from("grocery_items").insert(
      insert.map((row) => ({
        list_id: listId,
        household_id: householdId,
        item: row.item,
        item_key: row.item_key,
        quantity: row.quantity,
        unit: row.unit,
        display_qty: row.display_qty || null,
        aisle: row.aisle,
        source: "plan",
        from_recipes: row.from_recipes,
        position: row.position,
      })),
    );
  }

  for (const { id, row } of update) {
    await supabase
      .from("grocery_items")
      .update({
        quantity: row.quantity,
        unit: row.unit,
        display_qty: row.display_qty || null,
        from_recipes: row.from_recipes,
        item: row.item,
        aisle: row.aisle,
        position: row.position,
      })
      .eq("id", id);
  }

  if (remove.length) {
    await supabase.from("grocery_items").delete().in("id", remove);
  }

  return { inserted: insert.length, updated: update.length, removed: remove.length };
}

export async function currentListId(householdId: string, weekStart: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("grocery_lists")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (data) return data.id as string;

  const { data: created } = await supabase
    .from("grocery_lists")
    .insert({ household_id: householdId, week_start: weekStart })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}
