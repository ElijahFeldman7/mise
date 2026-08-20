import Link from "next/link";
import { requireSession, photoUrl } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  DAY_NAMES, addDays, formatTime, formatWeekRange, fromISODate,
  isToday, startOfWeek, toISODate, weekDays,
} from "@/lib/dates";
import Photo from "@/components/Photo";
import { ChevronLeft, ChevronRight } from "@/components/Icons";
import type { PlanEntryWithRecipe } from "@/lib/types";
import FillGaps from "./FillGaps";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const session = await requireSession();
  const supabase = await createClient();

  const anchor = w ? fromISODate(w) : new Date();
  const weekStart = startOfWeek(anchor);
  const days = weekDays(weekStart);

  const [{ data: entries }, { count: outstanding }] = await Promise.all([
    supabase
      .from("plan_entries")
      .select(
        "*, recipe:recipes(id, title, image_url, image_path, total_minutes, oven_temp_f, servings)",
      )
      .eq("household_id", session.household.id)
      .gte("on_date", toISODate(weekStart))
      .lte("on_date", toISODate(addDays(weekStart, 6)))
      .order("on_date")
      .order("position"),
    supabase
      .from("grocery_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", session.household.id)
      .eq("checked", false),
  ]);

  const byDate = new Map<string, PlanEntryWithRecipe[]>();
  for (const entry of (entries ?? []) as PlanEntryWithRecipe[]) {
    const list = byDate.get(entry.on_date) ?? [];
    list.push(entry);
    byDate.set(entry.on_date, list);
  }

  const initial = (session.profile.display_name ?? session.profile.email)
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <span className="font-hand text-[30px] font-bold leading-none text-accent">mise</span>
        <Link
          href="/you"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: "#e0c3b3", color: "#8a4527" }}
        >
          {session.profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.profile.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            initial
          )}
        </Link>
      </header>

      <div className="px-5 pt-1">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/week?w=${toISODate(addDays(weekStart, -7))}`}
              className="-ml-1 flex h-8 w-8 items-center justify-center text-ink-soft"
              aria-label="Previous week"
            >
              <ChevronLeft size={17} />
            </Link>
            <span className="text-[19px] font-semibold -tracking-[0.02em]">
              {formatWeekRange(weekStart)}
            </span>
            <Link
              href={`/week?w=${toISODate(addDays(weekStart, 7))}`}
              className="flex h-8 w-8 items-center justify-center text-ink-soft"
              aria-label="Next week"
            >
              <ChevronRight size={17} />
            </Link>
          </div>
          <FillGaps weekStart={toISODate(weekStart)} />
        </div>

        <div className="mt-4 flex flex-col">
          {days.map((day) => {
            const iso = toISODate(day);
            const dayEntries = byDate.get(iso) ?? [];
            const today = isToday(day);

            return (
              <Link
                key={iso}
                href={`/day/${iso}`}
                className="flex gap-[14px] py-[13px]"
                style={{ borderTop: `1px solid ${today ? "var(--accent)" : "var(--rule)"}` }}
              >
                <div className="w-[42px] flex-shrink-0 pt-[2px]">
                  <div
                    className="text-[13px] font-semibold -tracking-[0.01em]"
                    style={today ? { color: "var(--accent)" } : undefined}
                  >
                    {DAY_NAMES[day.getDay()]}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: today ? "var(--accent)" : "var(--ink-faint)" }}
                  >
                    {day.getDate()}
                  </div>
                  {today ? (
                    <div className="font-hand text-[15px] leading-tight text-accent">today</div>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-[10px]">
                  {dayEntries.length === 0 ? (
                    <div className="flex items-center gap-3 text-ink-faint">
                      <Photo size={38} />
                      <span className="text-[13px]">Nothing planned</span>
                    </div>
                  ) : (
                    dayEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3">
                        <Photo
                          size={38}
                          src={photoUrl("recipe-photos", entry.recipe?.image_path, entry.recipe?.image_url)}
                          alt={entry.recipe?.title ?? ""}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-medium -tracking-[0.01em]">
                            {entry.recipe?.title ?? entry.free_text}
                          </div>
                          <div className="mt-px text-[11px] text-ink-faint">
                            {entry.slot_label}
                            {entry.slot_time ? ` · ${formatTime(entry.slot_time)}` : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Link>
            );
          })}
          <div className="border-t border-rule" />
        </div>

        <Link href="/list" className="mt-4 inline-block text-[13px] text-ink-soft">
          {outstanding ?? 0} {outstanding === 1 ? "thing" : "things"} still on the list{" "}
          <span className="text-accent">→</span>
        </Link>
      </div>
    </>
  );
}
