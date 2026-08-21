import { ingredientOverlap, isStaple, type DietFlag } from "./ingredients";

export type Candidate = {
  id: string;
  title: string;
  image_url: string | null;
  image_path: string | null;
  category: string | null;
  cuisine: string | null;
  tags: string[];
  diet_flags: string[];
  total_minutes: number | null;
  effort: number;
  ingredient_keys: string[];
  is_public: boolean;
};

export type HouseholdSignal = {
  lastCooked: Map<string, Date>;

  timesCooked: Map<string, number>;

  ratings: Map<string, number>;

  skipped: Set<string>;

  taste: Map<string, number>;

  eventCount: number;
};

export type Context = {
  onHand: Set<string>;

  plannedIngredientSets: string[][];

  plannedRecipeIds: Set<string>;

  date: Date;

  slot: string;
  dietTags: DietFlag[];
  avoidIngredients: string[];
  /** Not banned — just pushed down the list. */
  dislikedIngredients: string[];
  weeknightMaxMinutes: number;
};

export type Scored = {
  candidate: Candidate;
  score: number;
  parts: Record<string, number>;
  reason: string;
};

const WEIGHTS = {
  overlap: 0.28,
  taste: 0.24,
  variety: 0.18,
  effort: 0.14,
  season: 0.10,
  novelty: 0.06,
} as const;

const SEASONS: Record<string, number[]> = {
  asparagus: [3, 4, 5, 6],
  strawberry: [4, 5, 6, 7],
  pea: [4, 5, 6],
  rhubarb: [3, 4, 5, 6],
  artichoke: [3, 4, 5],
  tomato: [6, 7, 8, 9],
  corn: [6, 7, 8, 9],
  zucchini: [6, 7, 8, 9],
  cucumber: [6, 7, 8, 9],
  "bell pepper": [7, 8, 9, 10],
  eggplant: [7, 8, 9, 10],
  peach: [6, 7, 8, 9],
  blueberry: [6, 7, 8],
  raspberry: [6, 7, 8, 9],
  melon: [7, 8, 9],
  basil: [6, 7, 8, 9],
  apple: [9, 10, 11, 12],
  pear: [9, 10, 11],
  squash: [9, 10, 11, 12],
  pumpkin: [9, 10, 11],
  "brussels sprout": [10, 11, 12, 1, 2],
  cauliflower: [9, 10, 11, 12, 1],
  broccoli: [9, 10, 11, 12, 1, 2, 3],
  kale: [10, 11, 12, 1, 2, 3],
  cabbage: [10, 11, 12, 1, 2, 3],
  leek: [10, 11, 12, 1, 2, 3],
  parsnip: [11, 12, 1, 2],
  beet: [9, 10, 11, 12, 1],
  citrus: [12, 1, 2, 3],
  orange: [12, 1, 2, 3],
  grapefruit: [12, 1, 2, 3],
  "sweet potato": [9, 10, 11, 12, 1],
  mushroom: [9, 10, 11, 3, 4],
};

const BREAKFAST_SLOTS = /breakfast|brunch/i;
const SNACK_SLOTS = /snack|tea/i;
const PREP_SLOTS = /prep|batch|make ahead/i;

export type RawEvent = {
  recipe_id: string;
  kind: "planned" | "cooked" | "rated" | "skipped" | "saved" | "unsaved";
  rating: number | null;
  happened_at: string;
};

export function buildHouseholdSignal(
  events: RawEvent[],
  featuresByRecipe: Map<string, string[]>,
): HouseholdSignal {
  const lastCooked = new Map<string, Date>();
  const timesCooked = new Map<string, number>();
  const ratings = new Map<string, number>();
  const skipped = new Set<string>();
  const taste = new Map<string, number>();
  let eventCount = 0;

  const bump = (recipeId: string, weight: number, ageDays: number) => {
    const features = featuresByRecipe.get(recipeId);
    if (!features?.length) return;

    const recency = Math.pow(0.5, ageDays / 120);
    const perFeature = (weight * recency) / Math.sqrt(features.length);
    for (const feature of features) {
      taste.set(feature, (taste.get(feature) ?? 0) + perFeature);
    }
    eventCount += 1;
  };

  const now = Date.now();

  for (const event of events) {
    const when = new Date(event.happened_at);
    const ageDays = Math.max(0, (now - when.getTime()) / 86_400_000);

    switch (event.kind) {
      case "cooked": {
        const previous = lastCooked.get(event.recipe_id);
        if (!previous || when > previous) lastCooked.set(event.recipe_id, when);
        timesCooked.set(event.recipe_id, (timesCooked.get(event.recipe_id) ?? 0) + 1);
        bump(event.recipe_id, 1.0, ageDays);
        break;
      }
      case "rated": {
        if (event.rating == null) break;
        ratings.set(event.recipe_id, event.rating);
        const weight = event.rating >= 5 ? 1.5 : event.rating >= 4 ? 0.75 : event.rating <= 2 ? -1.5 : 0;
        if (weight !== 0) bump(event.recipe_id, weight, ageDays);
        break;
      }
      case "skipped": {
        skipped.add(event.recipe_id);
        bump(event.recipe_id, -0.5, ageDays);
        break;
      }
      case "saved":
        bump(event.recipe_id, 0.5, ageDays);
        break;
      case "unsaved":
        bump(event.recipe_id, -0.4, ageDays);
        break;
      default:
        break;
    }
  }

  return { lastCooked, timesCooked, ratings, skipped, taste, eventCount };
}

export function featuresOf(candidate: Candidate): string[] {
  const features = candidate.ingredient_keys.filter((key) => !isStaple(key));
  if (candidate.cuisine) features.push(`cuisine:${candidate.cuisine.toLowerCase()}`);
  for (const tag of candidate.tags) features.push(`tag:${tag.toLowerCase()}`);
  if (candidate.category) features.push(`category:${candidate.category.toLowerCase()}`);
  return features;
}

function slotAllows(candidate: Candidate, slot: string): boolean {
  const category = (candidate.category ?? "").toLowerCase();

  if (BREAKFAST_SLOTS.test(slot)) {
    return category === "breakfast" || candidate.tags.includes("breakfast");
  }
  if (SNACK_SLOTS.test(slot)) {
    return ["snack", "dessert", "side"].includes(category) || candidate.tags.includes("snack");
  }
  if (PREP_SLOTS.test(slot)) {
    return category !== "dessert";
  }

  return category !== "breakfast" && category !== "dessert";
}

export function passesFilters(candidate: Candidate, context: Context): boolean {
  if (context.plannedRecipeIds.has(candidate.id)) return false;

  for (const diet of context.dietTags) {
    if (!candidate.diet_flags.includes(diet)) return false;
  }

  if (context.avoidIngredients.length) {
    const banned = new Set(context.avoidIngredients);
    for (const key of candidate.ingredient_keys) {
      if (banned.has(key)) return false;
    }
  }

  return slotAllows(candidate, context.slot);
}

/**
 * Disliking something isn't banning it. Each disliked ingredient multiplies the
 * score down, so one mushroom in a long list costs a little and a mushroom
 * risotto — where the word is in the name — costs a lot. Nothing is ever hidden
 * outright; that's what "never suggest" is for.
 */
function dislikePenalty(candidate: Candidate, disliked: Set<string>): number {
  if (disliked.size === 0) return 1;

  let hits = 0;
  let named = false;
  const title = candidate.title.toLowerCase();

  for (const key of candidate.ingredient_keys) {
    if (!disliked.has(key)) continue;
    hits += 1;
    if (key.length > 3 && title.includes(key)) named = true;
  }

  if (hits === 0) return 1;
  return Math.pow(0.62, hits) * (named ? 0.6 : 1);
}

function overlapScore(candidate: Candidate, context: Context): { score: number; have: number; need: number } {
  const needed = candidate.ingredient_keys.filter((key) => !isStaple(key));
  if (needed.length === 0) return { score: 0.5, have: 0, need: 0 };

  let have = 0;
  for (const key of needed) if (context.onHand.has(key)) have += 1;
  return { score: have / needed.length, have, need: needed.length };
}

function tasteScore(candidate: Candidate, signal: HouseholdSignal): number {
  if (signal.taste.size === 0) return 0.5;

  const features = featuresOf(candidate);
  if (!features.length) return 0.5;

  let dot = 0;
  let candidateNorm = 0;
  for (const feature of features) {
    dot += signal.taste.get(feature) ?? 0;
    candidateNorm += 1;
  }

  let profileNorm = 0;
  for (const weight of signal.taste.values()) profileNorm += weight * weight;

  if (profileNorm === 0 || candidateNorm === 0) return 0.5;

  const cosine = dot / (Math.sqrt(candidateNorm) * Math.sqrt(profileNorm));

  return 1 / (1 + Math.exp(-4 * cosine));
}

function varietyScore(candidate: Candidate, signal: HouseholdSignal, context: Context): {
  score: number;
  daysSince: number | null;
} {
  const last = signal.lastCooked.get(candidate.id);
  let recencyPart = 1;
  let daysSince: number | null = null;

  if (last) {
    daysSince = (context.date.getTime() - last.getTime()) / 86_400_000;

    recencyPart = 1 - Math.exp(-Math.max(0, daysSince) / 21);
  }

  let maxSimilarity = 0;
  for (const planned of context.plannedIngredientSets) {
    maxSimilarity = Math.max(maxSimilarity, ingredientOverlap(candidate.ingredient_keys, planned));
  }
  const distinctnessPart = 1 - maxSimilarity;

  return { score: Math.min(recencyPart, distinctnessPart), daysSince };
}

function effortScore(candidate: Candidate, context: Context): { score: number; limit: number } {
  const day = context.date.getDay();
  const isWeeknight = day >= 1 && day <= 4;
  const isPrep = PREP_SLOTS.test(context.slot);

  const limit = isPrep
    ? 240
    : isWeeknight
      ? context.weeknightMaxMinutes
      : Math.round(context.weeknightMaxMinutes * 2);

  const minutes = candidate.total_minutes ?? (candidate.effort === 1 ? 20 : candidate.effort === 2 ? 45 : 90);

  if (isPrep) {
    return { score: Math.min(1, minutes / 90), limit };
  }

  if (minutes <= limit) return { score: 1, limit };
  const over = (minutes - limit) / limit;
  return { score: Math.max(0, 1 - over), limit };
}

function seasonScore(candidate: Candidate, context: Context): { score: number; inSeason: string[] } {
  const month = context.date.getMonth() + 1;
  const seasonal = candidate.ingredient_keys.filter((key) => SEASONS[key]);
  if (seasonal.length === 0) return { score: 0.6, inSeason: [] };

  const inSeason = seasonal.filter((key) => SEASONS[key].includes(month));
  return { score: inSeason.length / seasonal.length, inSeason };
}

function noveltyScore(candidate: Candidate, signal: HouseholdSignal): number {
  const times = signal.timesCooked.get(candidate.id) ?? 0;
  if (times === 0) return 1;
  return Math.max(0, 1 - times / 6);
}

function jitter(id: string, seed: string): number {
  let hash = 2166136261;
  const text = `${id}:${seed}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export function recommend(
  candidates: Candidate[],
  signal: HouseholdSignal,
  context: Context,
  limit = 12,
): Scored[] {
  const confidence = Math.min(1, signal.eventCount / 12);
  const weights = {
    ...WEIGHTS,
    taste: WEIGHTS.taste * confidence,
    overlap: WEIGHTS.overlap + WEIGHTS.taste * (1 - confidence),
  };

  const weekSeed = `${context.date.getFullYear()}-${weekOfYear(context.date)}`;
  const disliked = new Set(context.dislikedIngredients);
  const scored: Scored[] = [];

  for (const candidate of candidates) {
    if (!passesFilters(candidate, context)) continue;

    const overlap = overlapScore(candidate, context);
    const taste = tasteScore(candidate, signal);
    const variety = varietyScore(candidate, signal, context);
    const effort = effortScore(candidate, context);
    const season = seasonScore(candidate, context);
    const novelty = noveltyScore(candidate, signal);

    const parts = {
      overlap: overlap.score,
      taste,
      variety: variety.score,
      effort: effort.score,
      season: season.score,
      novelty,
    };

    let score =
      parts.overlap * weights.overlap +
      parts.taste * weights.taste +
      parts.variety * weights.variety +
      parts.effort * weights.effort +
      parts.season * weights.season +
      parts.novelty * weights.novelty;

    const dislike = dislikePenalty(candidate, disliked);
    score *= dislike;

    if (signal.skipped.has(candidate.id)) score *= 0.75;

    score += jitter(candidate.id, weekSeed) * 0.02;

    scored.push({
      candidate,
      score,
      parts: { ...parts, dislike },
      reason: explain(candidate, { overlap, taste, variety, effort, season, novelty }, signal),
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function explain(
  candidate: Candidate,
  detail: {
    overlap: ReturnType<typeof overlapScore>;
    taste: number;
    variety: ReturnType<typeof varietyScore>;
    effort: ReturnType<typeof effortScore>;
    season: ReturnType<typeof seasonScore>;
    novelty: number;
  },
  signal: HouseholdSignal,
): string {
  const minutes = candidate.total_minutes;
  const time = minutes ? `${minutes} min` : null;

  const claims: Array<{ lift: number; text: string }> = [];

  if (detail.overlap.need > 0 && detail.overlap.have >= 2) {
    claims.push({
      lift: detail.overlap.score - 0.3,
      text: `${detail.overlap.have} of ${detail.overlap.need} things already on your list${time ? ` · ${time}` : ""}`,
    });
  }

  const rating = signal.ratings.get(candidate.id);
  if (rating && rating >= 4) {
    const last = signal.lastCooked.get(candidate.id);
    const when = last ? monthName(last) : null;
    claims.push({
      lift: 0.45,
      text: when
        ? `You rated this ${rating} in ${when} · not had it since`
        : `You rated this ${rating}`,
    });
  }

  if (detail.season.inSeason.length >= 2) {
    claims.push({
      lift: detail.season.score - 0.6,
      text: `${detail.season.inSeason.slice(0, 2).join(" and ")} are good right now`,
    });
  }

  if (detail.effort.score === 1 && minutes && minutes <= detail.effort.limit * 0.7) {
    claims.push({
      lift: 0.3,
      text: `${minutes} min, well under the ${detail.effort.limit} you allow a weeknight`,
    });
  }

  if (detail.novelty === 1 && signal.eventCount > 4) {
    claims.push({ lift: 0.25, text: `You've never made this${time ? ` · ${time}` : ""}` });
  }

  if (detail.taste > 0.68) {
    const anchor = topTasteFeature(candidate, signal);
    if (anchor) claims.push({ lift: detail.taste - 0.5, text: `This house cooks a lot of ${anchor}` });
  }

  if (detail.variety.daysSince && detail.variety.daysSince > 60) {
    claims.push({
      lift: 0.28,
      text: `Not since ${Math.round(detail.variety.daysSince / 30)} months ago`,
    });
  }

  claims.sort((a, b) => b.lift - a.lift);
  if (claims.length) return claims[0].text;

  return [time, candidate.cuisine].filter(Boolean).join(" · ") || "Worth a try";
}

function topTasteFeature(candidate: Candidate, signal: HouseholdSignal): string | null {
  let best: string | null = null;
  let bestWeight = 0;
  for (const feature of featuresOf(candidate)) {
    const weight = signal.taste.get(feature) ?? 0;
    if (weight > bestWeight) {
      bestWeight = weight;
      best = feature;
    }
  }
  if (!best) return null;
  return best.replace(/^(cuisine|tag|category):/, "");
}

function monthName(date: Date): string {
  return date.toLocaleString("en-US", { month: "long" });
}

function weekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / (7 * 86_400_000));
}
