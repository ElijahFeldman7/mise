"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Fills every empty dinner in the week from the recommender, in one go.
 * Deliberately only dinners — nobody wants a robot deciding their breakfast.
 */
export default function FillGaps({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function fill() {
    setBusy(true);
    try {
      const response = await fetch("/api/plan/fill", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekStart }),
      });
      if (response.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={fill} disabled={busy || pending} className="text-[13px] text-accent">
      {busy || pending ? "Thinking…" : "Fill the gaps"}
    </button>
  );
}
