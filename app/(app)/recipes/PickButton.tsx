"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPlanEntry } from "@/lib/actions/plan";

export default function PickButton({
  recipeId,
  date,
  slot,
  time,
}: {
  recipeId: string;
  date: string;
  slot: string;
  time: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await addPlanEntry({
            date,
            slotLabel: slot,
            slotTime: time || null,
            recipeId,
          });
          router.push(`/day/${date}`);
        })
      }
      className="mt-2 h-9 w-full rounded-[3px] bg-accent text-[13px] font-medium text-white disabled:opacity-60"
    >
      {pending ? "Adding…" : `Put in ${slot.toLowerCase()}`}
    </button>
  );
}
