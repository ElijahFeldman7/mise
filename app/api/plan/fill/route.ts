import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { recommend } from "@/lib/recommend";
import {
  loadCandidates, loadOnHand, loadPlannedThisWeek, loadSignal,
} from "@/lib/server/candidates";
import { addDays, fromISODate, toISODate, weekDays } from "@/lib/dates";
import { rebuildGroceryList } from "@/lib/server/list";
import type { DietFlag } from "@/lib/ingredients";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { weekStart } = (await request.json()) as { weekStart: string };
  const start = fromISODate(weekStart);
  const days = weekDays(start);
  const supabase = await createClient();

  const candidates = await loadCandidates(session.household.id);
  const [signal, onHand, planned] = await Promise.all([
    loadSignal(session.household.id, candidates),
    loadOnHand(session.household.id),
    loadPlannedThisWeek(session.household.id, weekStart, toISODate(addDays(start, 6))),
  ]);

  const { data: existing } = await supabase
    .from("plan_entries")
    .select("on_date, slot_label")
    .eq("household_id", session.household.id)
    .gte("on_date", weekStart)
    .lte("on_date", toISODate(addDays(start, 6)));

  const filled = new Set(
    (existing ?? []).map((row) => `${row.on_date}|${String(row.slot_label).toLowerCase()}`),
  );

  const plannedRecipeIds = new Set(planned.recipeIds);
  const plannedIngredientSets = [...planned.ingredientSets];
  const ingredientsById = new Map(candidates.map((c) => [c.id, c.ingredient_keys]));

  const inserts: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const day of days) {
    if (day < today) continue;
    const iso = toISODate(day);
    if (filled.has(`${iso}|dinner`)) continue;

    const [best] = recommend(
      candidates,
      signal,
      {
        onHand,
        plannedIngredientSets,
        plannedRecipeIds,
        date: day,
        slot: "Dinner",
        dietTags: (session.profile.diet_tags ?? []) as DietFlag[],
        avoidIngredients: session.profile.avoid_ingredients ?? [],
        weeknightMaxMinutes: session.profile.weeknight_max_minutes ?? 45,
      },
      1,
    );

    if (!best) continue;

    plannedRecipeIds.add(best.candidate.id);
    const keys = ingredientsById.get(best.candidate.id);
    if (keys?.length) plannedIngredientSets.push(keys);

    inserts.push({
      household_id: session.household.id,
      on_date: iso,
      slot_label: "Dinner",
      slot_time: "18:30",
      recipe_id: best.candidate.id,
      servings: 2,
      created_by: session.userId,
    });
    events.push({
      household_id: session.household.id,
      user_id: session.userId,
      recipe_id: best.candidate.id,
      kind: "planned",
    });
  }

  if (inserts.length) {
    await supabase.from("plan_entries").insert(inserts);
    await supabase.from("recipe_events").insert(events);
    await rebuildGroceryList(session.household.id, weekStart);
  }

  return NextResponse.json({ added: inserts.length });
}
