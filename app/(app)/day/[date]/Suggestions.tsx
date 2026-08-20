"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Photo from "@/components/Photo";
import { addPlanEntry, skipSuggestion } from "@/lib/actions/plan";

type Suggestion = {
  id: string;
  title: string;
  image: string | null;
  minutes: number | null;
  reason: string;
};

export default function Suggestions({ date, slot }: { date: string; slot: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recommend?date=${date}&slot=${encodeURIComponent(slot)}&limit=4`)
      .then((response) => (response.ok ? response.json() : { suggestions: [] }))
      .then((data) => {
        if (!cancelled) setItems(data.suggestions ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date, slot]);

  if (items === null) {
    return <p className="text-[13px] text-ink-faint">Working out what would suit…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-ink-faint">
        Nothing to suggest yet — cook a few things and this fills up.
      </p>
    );
  }

  function add(suggestion: Suggestion) {
    startTransition(async () => {
      await addPlanEntry({ date, slotLabel: slot, slotTime: "18:30:00", recipeId: suggestion.id });
      setItems((current) => current?.filter((item) => item.id !== suggestion.id) ?? null);
      router.refresh();
    });
  }

  function dismiss(suggestion: Suggestion) {
    startTransition(async () => {
      await skipSuggestion(suggestion.id);
      setItems((current) => current?.filter((item) => item.id !== suggestion.id) ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-4" style={{ opacity: pending ? 0.6 : 1 }}>
      {items.map((suggestion) => (
        <div key={suggestion.id} className="flex items-center gap-[14px]">
          <Link href={`/recipes/${suggestion.id}`} className="flex min-w-0 flex-1 items-center gap-[14px]">
            <Photo size={58} src={suggestion.image} alt={suggestion.title} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-medium -tracking-[0.01em]">
                {suggestion.title}
              </div>
              <div className="mt-[3px] text-xs text-ink-soft">{suggestion.reason}</div>
            </div>
          </Link>
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => dismiss(suggestion)}
              className="text-lg leading-none text-ink-ghost"
              aria-label="Not that"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => add(suggestion)}
              className="text-xl leading-none text-accent"
              aria-label={`Add ${suggestion.title}`}
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
