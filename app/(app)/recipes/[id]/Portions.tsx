"use client";

import { createContext, useContext, useState } from "react";
import { formatQuantity, scaleAmount } from "@/lib/units";
import type { RecipeIngredient } from "@/lib/types";

type Portions = { servings: number; setServings: (n: number) => void; recipeServings: number };

const PortionsContext = createContext<Portions | null>(null);

export function usePortions(): Portions {
  const value = useContext(PortionsContext);
  if (!value) throw new Error("usePortions outside a PortionsProvider");
  return value;
}

/** The recipe is written for however many; you're cooking for however many. */
export function PortionsProvider({
  recipeServings,
  cookingFor,
  children,
}: {
  recipeServings: number;
  cookingFor: number;
  children: React.ReactNode;
}) {
  const [servings, setServings] = useState(Math.max(1, cookingFor || recipeServings));
  return (
    <PortionsContext.Provider value={{ servings, setServings, recipeServings }}>
      {children}
    </PortionsContext.Provider>
  );
}

export function ServingsStepper() {
  const { servings, setServings } = usePortions();

  return (
    <span className="flex items-center gap-[10px]">
      <button
        type="button"
        onClick={() => setServings(Math.max(1, servings - 1))}
        className="text-base leading-none text-ink-faint"
        aria-label="Cook for fewer"
      >
        −
      </button>
      <span>
        serves {servings}
      </span>
      <button
        type="button"
        onClick={() => setServings(Math.min(24, servings + 1))}
        className="text-base leading-none text-ink-faint"
        aria-label="Cook for more"
      >
        +
      </button>
    </span>
  );
}

export function IngredientList({
  ingredients,
  have,
}: {
  ingredients: RecipeIngredient[];
  have: string[];
}) {
  const { servings, recipeServings } = usePortions();
  const onHand = new Set(have);
  const factor = recipeServings > 0 ? servings / recipeServings : 1;

  return (
    <div className="-mt-2 flex flex-col">
      {ingredients.map((ingredient) => (
        <div key={ingredient.id} className="flex h-9 items-baseline gap-[14px] border-b border-rule">
          <span className="w-[58px] flex-shrink-0 text-right text-[12.5px] text-ink-faint">
            {formatQuantity(scaleAmount(ingredient.quantity, factor), ingredient.unit)}
          </span>
          <span className="flex-1 text-sm">
            {ingredient.item}
            {ingredient.pack_size_qty ? (
              <span className="text-ink-faint">
                {" "}
                ({formatQuantity(ingredient.pack_size_qty, ingredient.pack_size_unit)})
              </span>
            ) : null}
            {ingredient.note ? <span className="text-ink-faint">, {ingredient.note}</span> : null}
          </span>
          {onHand.has(ingredient.item_key) ? (
            <span className="text-[11px] text-got">have it</span>
          ) : null}
        </div>
      ))}
      {ingredients.length === 0 ? (
        <p className="py-4 text-[13px] text-ink-faint">No ingredients written down yet.</p>
      ) : null}
    </div>
  );
}
