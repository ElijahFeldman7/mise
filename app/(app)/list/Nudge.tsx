"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerNudge } from "@/lib/actions/pantry";

export default function Nudge({ item, itemKey, times }: { item: string; itemKey: string; times: number }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  const [, startTransition] = useTransition();

  if (gone) return null;

  function answer(stillHave: boolean) {
    setGone(true);
    startTransition(async () => {
      await answerNudge(itemKey, stillHave);
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center gap-4 border-b border-rule py-[11px] fade-in">
      <span className="flex-1 text-[13.5px] text-ink-soft">
        You&apos;ve cooked with {item.toLowerCase()} {times} times since buying it — still got some?
      </span>
      <button type="button" onClick={() => answer(true)} className="text-[13px] text-ink-faint">
        yes
      </button>
      <button type="button" onClick={() => answer(false)} className="text-[13px] text-accent">
        out
      </button>
    </div>
  );
}
