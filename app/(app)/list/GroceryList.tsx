"use client";

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AISLE_LABEL, AISLE_ORDER } from "@/lib/ingredients";
import { formatQuantity } from "@/lib/units";
import { addManualItem, keepInPantry, removeGroceryItem, toggleGroceryItem } from "@/lib/actions/list";
import { CheckIcon } from "@/components/Icons";
import Heading from "@/components/Heading";
import type { Aisle, GroceryItem } from "@/lib/types";

export default function GroceryList({
  items,
  listId,
  householdId,
  currentUserId,
  people,
  summary,
}: {
  items: GroceryItem[];
  listId: string | null;
  householdId: string;
  currentUserId: string;
  people: Record<string, string>;
  summary: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");

  const [optimistic, applyOptimistic] = useOptimistic(
    items,
    (state: GroceryItem[], change: { id: string; checked: boolean }) =>
      state.map((item) => (item.id === change.id ? { ...item, checked: change.checked } : item)),
  );

  useEffect(() => {
    if (!listId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `list_id=eq.${listId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listId, householdId, router]);

  const grouped = useMemo(() => {
    const manual = optimistic.filter((item) => item.source !== "plan");
    const planned = optimistic.filter((item) => item.source === "plan");

    const byAisle = new Map<Aisle, GroceryItem[]>();
    for (const item of planned) {
      const bucket = byAisle.get(item.aisle) ?? [];
      bucket.push(item);
      byAisle.set(item.aisle, bucket);
    }

    const sections = AISLE_ORDER.filter((aisle) => byAisle.get(aisle)?.length).map((aisle) => ({
      key: aisle as string,
      title: AISLE_LABEL[aisle],
      rows: byAisle.get(aisle)!,
    }));

    if (manual.length) {
      const cupboard = manual.filter((item) => item.source === "pantry");
      const byHand = manual.filter((item) => item.source !== "pantry");
      if (cupboard.length) sections.push({ key: "pantry", title: "Run out at home", rows: cupboard });
      if (byHand.length) sections.push({ key: "manual", title: "Added by hand", rows: byHand });
    }
    return sections;
  }, [optimistic]);

  const got = optimistic.filter((item) => item.checked).length;

  function toggle(item: GroceryItem) {
    startTransition(async () => {
      applyOptimistic({ id: item.id, checked: !item.checked });
      await toggleGroceryItem(item.id, !item.checked);
    });
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      await addManualItem(text);
      router.refresh();
    });
  }

  return (
    <div className="margin-rule relative px-5 pt-1">
      <div className="relative flex items-baseline justify-between pb-[14px]">
        <span className="text-[12.5px] text-ink-faint">{summary}</span>
        <span className="text-[12.5px] text-accent">
          {got} of {optimistic.length} got
        </span>
      </div>

      {optimistic.length === 0 ? (
        <p className="relative py-8 text-[13.5px] text-ink-faint">
          Nothing here yet. Plan a few meals and the list writes itself.
        </p>
      ) : null}

      {grouped.map((section) => (
        <div key={section.key} className="relative">
          <div className="pb-[10px] pt-5 first:pt-0">
            <Heading>{section.title}</Heading>
          </div>

          {section.rows.map((item) => (
            <div
              key={item.id}
              className="flex h-10 items-center gap-4 border-b border-rule"
            >
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={item.checked ? `Un-tick ${item.item}` : `Tick off ${item.item}`}
                className="flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-[3px]"
                style={
                  item.checked
                    ? { background: "var(--accent)", color: "#fff" }
                    : { border: "1.5px solid var(--rule-strong)" }
                }
              >
                {item.checked ? <CheckIcon size={12} /> : null}
              </button>

              <span className="flex min-w-0 flex-1 items-baseline gap-[7px]">
                <span
                  className="truncate text-sm"
                  style={
                    item.checked
                      ? { color: "var(--ink-faint)", textDecoration: "line-through" }
                      : undefined
                  }
                >
                  {item.item}
                </span>
                {item.note && !item.checked ? (
                  <span className="flex-shrink-0 font-hand text-base text-ink-faint">
                    {item.note}
                  </span>
                ) : null}
              </span>

              {item.checked && item.checked_via === "receipt" ? (
                <span className="font-hand text-base text-got">receipt</span>
              ) : item.checked && item.checked_by && item.checked_by !== currentUserId ? (
                <span
                  className="flex h-[21px] w-[21px] items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{ background: "#bcd3ec", color: "#1f5a8f" }}
                >
                  {people[item.checked_by] ?? "?"}
                </span>
              ) : (
                <span className="text-xs text-ink-faint">
                  {item.display_qty || formatQuantity(item.quantity, item.unit)}
                </span>
              )}

              {item.source === "manual" || item.source === "pantry" ? (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await removeGroceryItem(item.id);
                      router.refresh();
                    })
                  }
                  className="text-base leading-none text-ink-ghost"
                  aria-label={`Remove ${item.item}`}
                >
                  ×
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await keepInPantry(item.item);
                      router.refresh();
                    })
                  }
                  className="text-[11px] text-ink-ghost"
                  title="Always have this — keep it off the list"
                >
                  always have
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="relative flex h-10 items-center gap-4">
        <div
          className="h-[19px] w-[19px] flex-shrink-0 rounded-[3px]"
          style={{ border: "1.5px dashed var(--rule-strong)" }}
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && add()}
          onBlur={add}
          placeholder="Add something"
          className="flex-1 text-sm"
        />
      </div>
    </div>
  );
}
