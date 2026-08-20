"use client";

import { useTransition } from "react";
import { forkRecipe } from "@/lib/actions/recipes";

export default function ForkButton({ recipeId }: { recipeId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await forkRecipe(recipeId)))}
      className="border-b border-accent-line pb-[2px] text-[13.5px] text-accent disabled:opacity-60"
    >
      {pending ? "Copying…" : "Make it mine"}
    </button>
  );
}
