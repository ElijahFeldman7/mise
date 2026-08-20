import { NextResponse, type NextRequest } from "next/server";
import { getSession, photoUrl } from "@/lib/session";
import { recommend } from "@/lib/recommend";
import {
  loadCandidates, loadOnHand, loadPlannedThisWeek, loadSignal,
} from "@/lib/server/candidates";
import { addDays, fromISODate, startOfWeek, toISODate } from "@/lib/dates";
import type { DietFlag } from "@/lib/ingredients";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const slot = searchParams.get("slot") ?? "Dinner";
  const limit = Math.min(24, Number(searchParams.get("limit") ?? 8));

  const date = dateParam ? fromISODate(dateParam) : new Date();
  const weekStart = startOfWeek(date);

  const candidates = await loadCandidates(session.household.id);
  const [signal, onHand, planned] = await Promise.all([
    loadSignal(session.household.id, candidates),
    loadOnHand(session.household.id),
    loadPlannedThisWeek(
      session.household.id,
      toISODate(weekStart),
      toISODate(addDays(weekStart, 6)),
    ),
  ]);

  const results = recommend(
    candidates,
    signal,
    {
      onHand,
      plannedIngredientSets: planned.ingredientSets,
      plannedRecipeIds: planned.recipeIds,
      date,
      slot,
      dietTags: (session.profile.diet_tags ?? []) as DietFlag[],
      avoidIngredients: session.profile.avoid_ingredients ?? [],
      weeknightMaxMinutes: session.profile.weeknight_max_minutes ?? 45,
    },
    limit,
  );

  return NextResponse.json({
    suggestions: results.map((result) => ({
      id: result.candidate.id,
      title: result.candidate.title,
      image: photoUrl("recipe-photos", result.candidate.image_path, result.candidate.image_url),
      minutes: result.candidate.total_minutes,
      reason: result.reason,
      score: Math.round(result.score * 1000) / 1000,
      parts: result.parts,
    })),
  });
}
