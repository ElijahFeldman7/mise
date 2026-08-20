import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, photoUrl } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/lib/dates";
import { formatQuantity } from "@/lib/units";
import { HeroPhoto } from "@/components/Photo";
import Heading from "@/components/Heading";
import { ChevronLeft } from "@/components/Icons";
import AddToWeek from "./AddToWeek";
import ForkButton from "./ForkButton";
import Rating from "./Rating";
import DishPhotos from "./DishPhotos";
import type { RecipeWithIngredients } from "@/lib/types";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("recipes")
    .select("*, recipe_ingredients(*), recipe_photos(*)")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const recipe = data as unknown as RecipeWithIngredients;

  const [{ data: onList }, { data: pantry }, { data: events }] = await Promise.all([
    supabase.from("grocery_items").select("item_key").eq("household_id", session.household.id),
    supabase.from("pantry_items").select("item_key").eq("household_id", session.household.id),
    supabase
      .from("recipe_events")
      .select("kind, rating, happened_at")
      .eq("household_id", session.household.id)
      .eq("recipe_id", id)
      .order("happened_at", { ascending: false }),
  ]);

  const have = new Set([
    ...(onList ?? []).map((row) => row.item_key as string),
    ...(pantry ?? []).map((row) => row.item_key as string),
  ]);

  const cooked = (events ?? []).filter((event) => event.kind === "cooked");
  const lastRating = (events ?? []).find((event) => event.kind === "rated")?.rating as
    | number
    | undefined;

  const ingredients = [...(recipe.recipe_ingredients ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const photos = [...(recipe.recipe_photos ?? [])].sort((a, b) =>
    b.taken_at.localeCompare(a.taken_at),
  );

  const heroFromCooks = photos[0]
    ? photoUrl("recipe-photos", photos[0].storage_path)
    : null;
  const hero = heroFromCooks ?? photoUrl("recipe-photos", recipe.image_path, recipe.image_url);

  const meta = [
    formatMinutes(recipe.total_minutes),
    `serves ${recipe.servings}`,
  ].filter(Boolean);

  const mine = recipe.household_id === session.household.id;

  return (
    <>
      <div className="relative">
        <HeroPhoto src={hero} alt={recipe.title} />
        <Link
          href="/recipes"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center text-white"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))" }}
          aria-label="Back to recipes"
        >
          <ChevronLeft size={22} />
        </Link>
      </div>

      <div className="flex flex-col gap-[18px] px-5 pt-[18px]">
        <div>
          <h1 className="text-[23px] font-semibold leading-[1.18] -tracking-[0.025em] text-pretty">
            {recipe.title}
          </h1>
          <div className="mt-[9px] flex flex-wrap items-center gap-2 text-[12.5px] text-ink-soft">
            {meta.map((piece, index) => (
              <span key={piece} className="flex items-center gap-2">
                {index > 0 ? <span className="text-ink-ghost">·</span> : null}
                <span>{piece}</span>
              </span>
            ))}
            {recipe.oven_temp_f ? (
              <>
                <span className="text-ink-ghost">·</span>
                <span className="font-semibold text-accent">oven {recipe.oven_temp_f}°F</span>
              </>
            ) : null}
          </div>
          {cooked.length ? (
            <p className="mt-1 font-hand text-[17px] text-ink-faint">
              you&apos;ve made this {cooked.length} {cooked.length === 1 ? "time" : "times"} — last
              on{" "}
              {new Date(cooked[0].happened_at as string).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-[18px]">
          <AddToWeek recipeId={recipe.id} servings={recipe.servings} />
          {mine ? (
            <Link
              href={`/recipes/${recipe.id}/edit`}
              className="border-b border-accent-line pb-[2px] text-[13.5px] text-accent"
            >
              Edit it
            </Link>
          ) : (
            <ForkButton recipeId={recipe.id} />
          )}
        </div>

        {recipe.description ? (
          <p className="text-sm leading-relaxed text-ink-soft text-pretty">{recipe.description}</p>
        ) : null}

        <Heading>Ingredients</Heading>

        <div className="-mt-2 flex flex-col">
          {ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className="flex h-9 items-baseline gap-[14px] border-b border-rule"
            >
              <span className="w-[58px] flex-shrink-0 text-right text-[12.5px] text-ink-faint">
                {formatQuantity(ingredient.quantity, ingredient.unit)}
              </span>
              <span className="flex-1 text-sm">
                {ingredient.item}
                {ingredient.note ? (
                  <span className="text-ink-faint">, {ingredient.note}</span>
                ) : null}
              </span>
              {have.has(ingredient.item_key) ? (
                <span className="text-[11px] text-got">have it</span>
              ) : null}
            </div>
          ))}
          {ingredients.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-faint">No ingredients written down yet.</p>
          ) : null}
        </div>

        <Heading>How to make it</Heading>

        <div className="-mt-2 flex flex-col gap-[15px]">
          {recipe.instructions.map((step, index) => (
            <div key={index} className="flex gap-[14px]">
              <span className="w-[15px] flex-shrink-0 font-hand text-2xl leading-none text-accent">
                {index + 1}
              </span>
              <span className="flex-1 text-sm leading-relaxed text-pretty">{step}</span>
            </div>
          ))}
          {recipe.instructions.length === 0 ? (
            <p className="text-[13px] text-ink-faint">No method written down yet.</p>
          ) : null}
        </div>

        <Heading>Times you&apos;ve made it</Heading>
        <DishPhotos
          recipeId={recipe.id}
          photos={photos.map((photo) => ({
            id: photo.id,
            url: photoUrl("recipe-photos", photo.storage_path) ?? "",
          }))}
        />

        <div className="border-t border-rule pb-6 pt-5">
          <Rating recipeId={recipe.id} current={lastRating ?? null} />
        </div>
      </div>
    </>
  );
}
