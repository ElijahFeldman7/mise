"use client";

import { useState, useTransition } from "react";
import { rateRecipe } from "@/lib/actions/plan";

export default function Rating({
  recipeId,
  current,
}: {
  recipeId: string;
  current: number | null;
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-soft">
        {value ? "You gave it" : "How was it?"}
      </span>
      <div className="flex items-center gap-3">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            disabled={pending}
            onClick={() => {
              setValue(score);
              startTransition(async () => void (await rateRecipe(recipeId, score)));
            }}
            aria-label={`${score} out of 5`}
            className="h-7 w-7 rounded-full"
            style={{
              background: value && score <= value ? "var(--accent)" : "transparent",
              border: value && score <= value ? "none" : "1.5px solid var(--rule-strong)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
