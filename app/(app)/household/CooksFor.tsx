"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCooksFor } from "@/lib/actions/household";

export default function CooksFor({ count, diet }: { count: number; diet: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, show] = useOptimistic(count, (_state: number, next: number) => next);

  function step(delta: number) {
    const next = Math.max(1, Math.min(20, shown + delta));
    if (next === shown) return;
    startTransition(async () => {
      show(next);
      await setCooksFor(next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center border-t border-rule py-[14px]">
      <div className="flex-1">
        <div className="text-[14.5px]">Cooking for</div>
        <div className="mt-[3px] text-xs text-ink-faint">
          {diet ? `${diet} · every` : "Every"} new meal starts at this many
        </div>
      </div>

      <div className="flex items-center gap-[18px]">
        <button
          type="button"
          onClick={() => step(-1)}
          className="text-xl leading-none text-ink-faint"
          aria-label="Fewer people"
        >
          −
        </button>
        <span className="w-[18px] text-center text-[15px]">{shown}</span>
        <button
          type="button"
          onClick={() => step(1)}
          className="text-xl leading-none text-ink-faint"
          aria-label="More people"
        >
          +
        </button>
      </div>
    </div>
  );
}
