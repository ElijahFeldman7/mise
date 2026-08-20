"use client";

import Link from "next/link";
import { useTransition } from "react";
import Photo from "@/components/Photo";
import { formatTime, formatMinutes } from "@/lib/dates";
import { markCooked, removePlanEntry, updatePlanEntry } from "@/lib/actions/plan";
import { CheckIcon, TrashIcon } from "@/components/Icons";

type Entry = {
  id: string;
  slot_label: string;
  slot_time: string | null;
  servings: number;
  free_text: string | null;
  cooked_at: string | null;
  note: string | null;
  recipe: { id: string; title: string; minutes: number | null; image: string | null } | null;
};

export default function SlotRow({ entry, date }: { entry: Entry; date: string }) {
  const [pending, startTransition] = useTransition();

  const setServings = (next: number) => {
    if (next < 1 || next > 20) return;
    startTransition(async () => {
      await updatePlanEntry(entry.id, date, { servings: next });
    });
  };

  return (
    <div style={{ opacity: pending ? 0.6 : 1 }}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-[10px]">
          <span className="text-[13.5px] font-semibold -tracking-[0.01em]">{entry.slot_label}</span>
          {entry.slot_time ? (
            <span className="text-xs text-ink-faint">{formatTime(entry.slot_time)}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => startTransition(async () => void (await markCooked(entry.id, date)))}
            className="flex items-center gap-[5px] text-xs"
            style={{ color: entry.cooked_at ? "var(--got)" : "var(--ink-faint)" }}
          >
            <CheckIcon size={13} />
            <span>{entry.cooked_at ? "made it" : "made it?"}</span>
          </button>
          <button
            type="button"
            onClick={() => startTransition(async () => void (await removePlanEntry(entry.id, date)))}
            className="text-ink-ghost"
            aria-label="Remove"
          >
            <TrashIcon size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-[14px]">
        {entry.recipe ? (
          <Link href={`/recipes/${entry.recipe.id}`} className="flex flex-1 items-center gap-[14px]">
            <Photo size={58} src={entry.recipe.image} alt={entry.recipe.title} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium -tracking-[0.01em]">{entry.recipe.title}</div>
              <div className="mt-[3px] text-xs text-ink-faint">
                {formatMinutes(entry.recipe.minutes) || "no time set"}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex flex-1 items-center gap-[14px]">
            <Photo size={58} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium -tracking-[0.01em]">{entry.free_text}</div>
              <div className="mt-[3px] text-xs text-ink-faint">Written in by hand</div>
            </div>
          </div>
        )}

        <div className="flex flex-shrink-0 items-center gap-3 text-ink-faint">
          <button type="button" onClick={() => setServings(entry.servings - 1)} className="text-lg leading-none" aria-label="Fewer">−</button>
          <span className="text-sm text-ink">{entry.servings}</span>
          <button type="button" onClick={() => setServings(entry.servings + 1)} className="text-lg leading-none" aria-label="More">+</button>
        </div>
      </div>

      {entry.note ? <p className="mt-2 font-hand text-[17px] text-ink-soft">{entry.note}</p> : null}
    </div>
  );
}
