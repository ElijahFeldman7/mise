import Link from "next/link";
import { requireSession, photoUrl } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/lib/dates";
import Photo from "@/components/Photo";
import Heading from "@/components/Heading";
import SearchField from "./SearchField";
import PickedForYou from "./PickedForYou";
import PickButton from "./PickButton";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "quick", label: "Under 30 min" },
  { key: "veg", label: "Veg" },
  { key: "mine", label: "Mine" },
] as const;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; pick?: string; slot?: string; time?: string }>;
}) {
  const { q, f, pick, slot, time } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  let query = supabase
    .from("recipes")
    .select("id, title, image_url, image_path, total_minutes, oven_temp_f, servings, household_id, category")
    .or(`is_public.eq.true,household_id.eq.${session.household.id}`)
    .limit(60);

  if (q) query = query.ilike("title", `%${q}%`);
  if (f === "quick") query = query.lte("total_minutes", 30);
  if (f === "veg") query = query.contains("diet_flags", ["vegetarian"]);
  if (f === "mine") query = query.eq("household_id", session.household.id);

  const { data: recipes } = await query.order("title");

  const picking = Boolean(pick);

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">
          {picking ? `Pick a ${slot?.toLowerCase() ?? "recipe"}` : "Recipes"}
        </h1>
        <Link href="/recipes/new" className="text-[13.5px] text-accent">
          Write one
        </Link>
      </header>

      <div className="flex flex-col gap-[18px] px-5 pt-1">
        <SearchField initial={q ?? ""} />

        <div className="flex gap-[18px] overflow-x-auto">
          {FILTERS.map((filter) => {
            const active = (f ?? "all") === filter.key;
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            if (filter.key !== "all") params.set("f", filter.key);
            if (pick) {
              params.set("pick", pick);
              if (slot) params.set("slot", slot);
              if (time) params.set("time", time);
            }
            return (
              <Link
                key={filter.key}
                href={`/recipes?${params.toString()}`}
                className="flex-shrink-0 whitespace-nowrap text-[13px]"
                style={
                  active
                    ? {
                        color: "var(--accent)",
                        fontWeight: 600,
                        borderBottom: "2px solid var(--accent)",
                        paddingBottom: 3,
                      }
                    : { color: "var(--ink-soft)" }
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {!q && !f ? (
          <>
            <Heading>Picked for your week</Heading>
            <PickedForYou pick={pick ?? null} slot={slot ?? "Dinner"} time={time ?? null} />
          </>
        ) : null}

        <div className="flex items-baseline justify-between">
          <Heading>{q ? "Matches" : "Everything"}</Heading>
          <span className="text-xs text-ink-faint">{recipes?.length ?? 0}</span>
        </div>

        <div className="grid grid-cols-2 gap-[14px] pb-4">
          {(recipes ?? []).map((recipe) => {
            const image = photoUrl(
              "recipe-photos",
              recipe.image_path as string | null,
              recipe.image_url as string | null,
            );
            const meta = [
              formatMinutes(recipe.total_minutes as number | null),
              recipe.oven_temp_f ? `${recipe.oven_temp_f}°F` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={recipe.id as string}>
                <Link href={`/recipes/${recipe.id}`}>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={recipe.title as string}
                      className="h-[108px] w-full rounded-[3px] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-[108px] w-full rounded-[3px]">
                      <Photo size={108} className="!w-full" />
                    </div>
                  )}
                  <div className="mt-[9px] flex items-baseline gap-[7px]">
                    <span className="text-[13.5px] font-medium leading-tight -tracking-[0.01em]">
                      {recipe.title as string}
                    </span>
                    {recipe.household_id ? (
                      <span className="text-[10.5px] text-accent">yours</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-faint">{meta || "no time set"}</div>
                </Link>
                {picking ? (
                  <PickButton
                    recipeId={recipe.id as string}
                    date={pick!}
                    slot={slot ?? "Dinner"}
                    time={time ?? null}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {(recipes ?? []).length === 0 ? (
          <p className="pb-8 text-[13.5px] text-ink-faint">
            Nothing matches that. {q ? "Try a shorter word." : ""}
          </p>
        ) : null}
      </div>
    </>
  );
}
