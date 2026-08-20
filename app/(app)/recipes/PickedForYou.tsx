"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Photo from "@/components/Photo";
import PickButton from "./PickButton";

type Suggestion = {
  id: string;
  title: string;
  image: string | null;
  reason: string;
};

export default function PickedForYou({
  pick,
  slot,
  time,
}: {
  pick: string | null;
  slot: string;
  time: string | null;
}) {
  const [items, setItems] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const date = pick ?? new Date().toISOString().slice(0, 10);
    fetch(`/api/recommend?date=${date}&slot=${encodeURIComponent(slot)}&limit=2`)
      .then((response) => (response.ok ? response.json() : { suggestions: [] }))
      .then((data) => !cancelled && setItems(data.suggestions ?? []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [pick, slot]);

  if (items === null) {
    return <p className="text-[13px] text-ink-faint">Working it out…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-[13px] text-ink-faint">
        Cook a few things and this learns what to put here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-[14px]">
      {items.map((item) => (
        <div key={item.id}>
          <Link href={`/recipes/${item.id}`}>
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.title}
                className="h-[108px] w-full rounded-[3px] object-cover"
              />
            ) : (
              <Photo size={108} className="!w-full" />
            )}
            <div className="mt-[9px] text-[13.5px] font-medium leading-tight -tracking-[0.01em]">
              {item.title}
            </div>
            <div className="mt-1 text-[11.5px] leading-snug text-got">{item.reason}</div>
          </Link>
          {pick ? <PickButton recipeId={item.id} date={pick} slot={slot} time={time} /> : null}
        </div>
      ))}
    </div>
  );
}
