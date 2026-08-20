import { notFound } from "next/navigation";
import { requireSession, photoUrl } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/lib/units";
import RecipeForm from "../../RecipeForm";
import type { RecipeWithIngredients } from "@/lib/types";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const recipe = data as unknown as RecipeWithIngredients;
  if (recipe.household_id !== session.household.id) notFound();

  const ingredients = [...(recipe.recipe_ingredients ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      quantityText: formatQuantity(row.quantity, row.unit),
      item: row.item,
    }));

  return (
    <RecipeForm
      initial={{
        id: recipe.id,
        title: recipe.title,
        totalMinutes: recipe.total_minutes ? String(recipe.total_minutes) : "",
        servings: String(recipe.servings),
        ovenTempF: recipe.oven_temp_f ? String(recipe.oven_temp_f) : "",
        cuisine: recipe.cuisine ?? "",
        category: recipe.category ?? "dinner",
        tags: recipe.tags ?? [],
        imagePath: recipe.image_path,
        imageUrl: photoUrl("recipe-photos", recipe.image_path, recipe.image_url),
        ingredients: [...ingredients, { quantityText: "", item: "" }],
        instructions: [...(recipe.instructions ?? []), ""],
      }}
    />
  );
}
