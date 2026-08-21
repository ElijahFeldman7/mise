"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlanEntry } from "@/lib/actions/plan";
import { DAY_NAMES, addDays, startOfWeek, toISODate } from "@/lib/dates";
import { usePortions } from "./Portions";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Prep"];
const TIMES: Record<string, string> = {
  Breakfast: "07:30:00",
  Lunch: "12:30:00",
  Dinner: "18:30:00",
  Prep: "16:00:00",
};

export default function AddToWeek({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const { servings } = usePortions();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState("Dinner");
  const [pending, startTransition] = useTransition();

  const week = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 flex-1 rounded-[3px] bg-accent text-[14.5px] font-medium text-white"
      >
        Add to the week
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-[18px]">
        {SLOTS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSlot(option)}
            className="text-[13px]"
            style={
              option === slot
                ? {
                    color: "var(--accent)",
                    fontWeight: 600,
                    borderBottom: "2px solid var(--accent)",
                    paddingBottom: 3,
                  }
                : { color: "var(--ink-soft)" }
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await addPlanEntry({
                  date: toISODate(day),
                  slotLabel: slot,
                  slotTime: TIMES[slot] ?? null,
                  recipeId,
                  servings,
                });
                router.push(`/day/${toISODate(day)}`);
              })
            }
            className="flex-1 rounded-[3px] border border-rule-strong py-2 text-center disabled:opacity-60"
          >
            <div className="text-[11px] text-ink-faint">{DAY_NAMES[day.getDay()]}</div>
            <div className="text-[13px] font-medium">{day.getDate()}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 text-[13px] text-ink-soft"
      >
        Never mind
      </button>
    </div>
  );
}
