import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, photoUrl } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, fromISODate, isToday } from "@/lib/dates";
import Heading from "@/components/Heading";
import { ChevronLeft } from "@/components/Icons";
import SlotRow from "./SlotRow";
import AddSlot from "./AddSlot";
import Suggestions from "./Suggestions";
import type { PlanEntryWithRecipe, SlotTemplate } from "@/lib/types";

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const session = await requireSession();
  const supabase = await createClient();
  const day = fromISODate(date);

  const [{ data: entries }, { data: templates }] = await Promise.all([
    supabase
      .from("plan_entries")
      .select(
        "*, recipe:recipes(id, title, image_url, image_path, total_minutes, oven_temp_f, servings)",
      )
      .eq("household_id", session.household.id)
      .eq("on_date", date)
      .order("position"),
    supabase
      .from("slot_templates")
      .select("*")
      .eq("household_id", session.household.id)
      .order("position"),
  ]);

  const planned = (entries ?? []) as unknown as PlanEntryWithRecipe[];
  const slots = (templates ?? []) as SlotTemplate[];
  const usedLabels = new Set(planned.map((entry) => entry.slot_label.toLowerCase()));
  const emptySlots = slots.filter((slot) => !usedLabels.has(slot.name.toLowerCase()));

  return (
    <>
      <header className="flex h-[58px] items-center gap-2 px-5">
        <Link
          href="/week"
          className="-ml-2 flex h-[34px] w-[34px] items-center justify-center text-ink-soft"
          aria-label="Back to the week"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">{formatLongDate(day)}</h1>
        {isToday(day) ? <span className="font-hand text-[19px] text-accent">today</span> : null}
      </header>

      <div className="flex flex-col gap-5 px-5 pt-2">
        {planned.map((entry, index) => (
          <div
            key={entry.id}
            className={index > 0 ? "border-t border-rule pt-[18px]" : undefined}
          >
            <SlotRow
              entry={{
                id: entry.id,
                slot_label: entry.slot_label,
                slot_time: entry.slot_time,
                servings: entry.servings,
                free_text: entry.free_text,
                cooked_at: entry.cooked_at,
                note: entry.note,
                recipe: entry.recipe
                  ? {
                      id: entry.recipe.id,
                      title: entry.recipe.title,
                      minutes: entry.recipe.total_minutes,
                      image: photoUrl(
                        "recipe-photos",
                        entry.recipe.image_path,
                        entry.recipe.image_url,
                      ),
                    }
                  : null,
              }}
              date={date}
            />
          </div>
        ))}

        {emptySlots.map((slot) => (
          <div
            key={slot.id}
            className={planned.length ? "border-t border-rule pt-[18px]" : undefined}
          >
            <div className="flex items-baseline gap-[10px]">
              <span className="text-[13.5px] font-semibold -tracking-[0.01em]">{slot.name}</span>
              {slot.at_time ? (
                <span className="text-xs text-ink-faint">{slot.at_time.slice(0, 5)}</span>
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-5">
              <Link
                href={`/recipes?pick=${date}&slot=${encodeURIComponent(slot.name)}&time=${slot.at_time ?? ""}`}
                className="border-b border-accent-line pb-[2px] text-sm text-accent"
              >
                Pick a recipe
              </Link>
              <AddSlot
                date={date}
                presetLabel={slot.name}
                presetTime={slot.at_time}
                mode="freetext"
              />
            </div>
          </div>
        ))}

        <div className="border-t border-rule pt-[18px]">
          <AddSlot date={date} mode="new" />
        </div>

        <div className="border-t border-rule pt-5">
          <Heading>Suggested for {isToday(day) ? "tonight" : "this day"}</Heading>
        </div>

        <Suggestions date={date} slot="Dinner" />
      </div>
    </>
  );
}
