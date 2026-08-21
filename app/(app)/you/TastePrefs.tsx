"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/household";
import { DIET_LABEL, type DietFlag } from "@/lib/ingredients";
import Heading from "@/components/Heading";

const DIETS: DietFlag[] = [
  "vegetarian", "vegan", "pescatarian",
  "gluten_free", "dairy_free", "pork_free", "nut_free", "egg_free",
];

export default function TastePrefs({
  dietTags,
  avoid,
  weeknightMax,
}: {
  dietTags: string[];
  avoid: string[];
  weeknightMax: number;
}) {
  const router = useRouter();
  const [diets, setDiets] = useState(new Set(dietTags));
  const [banned, setBanned] = useState(avoid);
  const [minutes, setMinutes] = useState(weeknightMax);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  function save(patch: Parameters<typeof updateProfile>[0]) {
    startTransition(async () => {
      await updateProfile(patch);
      router.refresh();
    });
  }

  function toggleDiet(diet: DietFlag) {
    const next = new Set(diets);
    if (next.has(diet)) next.delete(diet);
    else next.add(diet);
    setDiets(next);
    save({ dietTags: [...next] });
  }

  function addBanned() {
    const value = draft.trim();
    if (!value) return;
    const next = [...banned, value];
    setBanned(next);
    setDraft("");
    save({ avoidIngredients: next });
  }

  function removeBanned(item: string) {
    const next = banned.filter((entry) => entry !== item);
    setBanned(next);
    save({ avoidIngredients: next });
  }

  function shiftMinutes(delta: number) {
    const next = Math.max(10, Math.min(180, minutes + delta));
    setMinutes(next);
    save({ weeknightMaxMinutes: next });
  }

  return (
    <>
      <Heading>How you eat</Heading>
      <div className="-mt-3 flex flex-wrap gap-x-[18px] gap-y-3">
        {DIETS.map((diet) => {
          const on = diets.has(diet);
          return (
            <button
              key={diet}
              type="button"
              onClick={() => toggleDiet(diet)}
              className="text-[13.5px]"
              style={
                on
                  ? {
                      color: "var(--accent)",
                      fontWeight: 600,
                      borderBottom: "2px solid var(--accent)",
                      paddingBottom: 2,
                    }
                  : { color: "var(--ink-faint)" }
              }
            >
              {DIET_LABEL[diet]}
            </button>
          );
        })}
      </div>

      <Heading>Never suggest</Heading>
      <div className="-mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-3">
        {banned.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => removeBanned(item)}
            className="text-[13.5px]"
          >
            {item} <span className="text-ink-faint">×</span>
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addBanned()}
          onBlur={addBanned}
          placeholder="+ add one"
          className="w-[110px] text-[13.5px]"
        />
      </div>

      <Heading>On a weeknight</Heading>
      <div className="-mt-3 flex items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">Keep dinner under</span>
        <div className="flex items-center gap-4 text-ink-faint">
          <button type="button" onClick={() => shiftMinutes(-5)} className="text-lg leading-none">
            −
          </button>
          <span className="min-w-[54px] text-center text-[14.5px] text-ink">{minutes} min</span>
          <button type="button" onClick={() => shiftMinutes(5)} className="text-lg leading-none">
            +
          </button>
        </div>
      </div>
    </>
  );
}
