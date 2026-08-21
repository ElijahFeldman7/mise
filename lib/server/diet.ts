import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { itemKey, type DietFlag } from "@/lib/ingredients";

export type HouseDiet = { dietTags: DietFlag[]; avoid: string[]; dislike: string[] };

/**
 * What the whole house can eat, which is the union of what each person can't.
 * One vegetarian makes the household vegetarian for the purposes of browsing —
 * cooking two dinners is a choice, not a default.
 */
export const householdDiet = cache(async (householdId: string): Promise<HouseDiet> => {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);

  const ids = (members ?? []).map((row) => row.user_id as string);
  if (!ids.length) return { dietTags: [], avoid: [], dislike: [] };

  const { data: people } = await supabase
    .from("profiles")
    .select("diet_tags, avoid_ingredients, disliked_ingredients")
    .in("id", ids);

  const dietTags = new Set<string>();
  const avoid = new Set<string>();
  const dislike = new Set<string>();

  // Stored as item_keys, but normalise anyway — a profile written before that
  // was true would otherwise quietly match nothing.
  for (const person of people ?? []) {
    for (const tag of (person.diet_tags as string[]) ?? []) dietTags.add(tag);
    for (const item of (person.avoid_ingredients as string[]) ?? []) avoid.add(itemKey(item));
    for (const item of (person.disliked_ingredients as string[]) ?? []) dislike.add(itemKey(item));
  }

  return {
    dietTags: [...dietTags] as DietFlag[],
    avoid: [...avoid].filter(Boolean),
    dislike: [...dislike].filter(Boolean),
  };
});

/** A short, plain sentence: "vegetarian, no pork". Empty when there's nothing to say. */
export function dietSentence(tags: DietFlag[], labels: Record<DietFlag, string>): string {
  if (!tags.length) return "";
  return tags.map((tag) => labels[tag].toLowerCase()).join(", ");
}
