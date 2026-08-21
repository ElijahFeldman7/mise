"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPantryItems,
  removePantryItem,
  setPantryAmount,
  setPantryStatus,
} from "@/lib/actions/pantry";
import { AISLE_LABEL, AISLE_ORDER, itemKey } from "@/lib/ingredients";
import { CATALOG, NEXT_STATUS, STATUS_COLOR, STATUS_LABEL, searchCatalog } from "@/lib/pantry";
import { formatQuantity } from "@/lib/units";
import Heading from "@/components/Heading";
import type { Aisle, PantryItem, PantryStatus } from "@/lib/types";

type Row = Pick<PantryItem, "item_key" | "item" | "aisle" | "status" | "quantity" | "unit">;

export default function Cupboard({ items }: { items: Row[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);

  const [rows, moveOn] = useOptimistic(items, (state: Row[], change: { key: string; status: PantryStatus }) =>
    state.map((row) => (row.item_key === change.key ? { ...row, status: change.status } : row)),
  );

  const held = useMemo(() => new Set(rows.map((row) => row.item_key)), [rows]);
  const text = query.trim();

  const shown = useMemo(() => {
    if (!text) return rows;
    const needle = text.toLowerCase();
    return rows.filter((row) => row.item.toLowerCase().includes(needle));
  }, [rows, text]);

  const sections = useMemo(() => {
    const byAisle = new Map<Aisle, Row[]>();
    for (const row of shown) {
      const bucket = byAisle.get(row.aisle) ?? [];
      bucket.push(row);
      byAisle.set(row.aisle, bucket);
    }
    return AISLE_ORDER.filter((aisle) => byAisle.get(aisle)?.length).map((aisle) => ({
      aisle,
      title: AISLE_LABEL[aisle],
      rows: byAisle.get(aisle)!.sort((a, b) => a.item.localeCompare(b.item)),
    }));
  }, [shown]);

  const suggestions = useMemo(() => {
    if (!text) return [];
    return searchCatalog(text).filter((item) => !held.has(item.key));
  }, [text, held]);

  const canAddByHand = text.length > 1 && !held.has(itemKey(text)) && !suggestions.some((s) => s.name.toLowerCase() === text.toLowerCase());

  function cycle(row: Row) {
    const status = NEXT_STATUS[row.status];
    startTransition(async () => {
      moveOn({ key: row.item_key, status });
      await setPantryStatus(row.item_key, status);
      router.refresh();
    });
  }

  function pick(name: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function commit(names: string[]) {
    if (!names.length) return;
    setPicked(new Set());
    setQuery("");
    startTransition(async () => {
      await addPantryItems(names);
      router.refresh();
    });
  }

  return (
    <div className="margin-rule relative px-5 pt-1">
      <div className="relative pb-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find something, or add it"
          className="field text-[14.5px]"
          type="search"
        />
      </div>

      {suggestions.length || canAddByHand ? (
        <div className="relative flex flex-wrap gap-2 pb-5">
          {suggestions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => commit([item.name])}
              className="rounded-full px-[13px] py-[6px] text-[13px]"
              style={{ border: "1px solid var(--accent-line)", color: "var(--accent)" }}
            >
              {item.name}
            </button>
          ))}
          {canAddByHand ? (
            <button
              type="button"
              onClick={() => commit([text])}
              className="rounded-full px-[13px] py-[6px] text-[13px]"
              style={{ border: "1px dashed var(--rule-strong)", color: "var(--ink-soft)" }}
            >
              Add &ldquo;{text}&rdquo;
            </button>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 && !text ? (
        <p className="relative pb-2 text-[13.5px] text-ink-faint">
          Tap everything you already keep at home. Anything in here stops turning up on the
          grocery list — until you say you&apos;ve run out.
        </p>
      ) : null}

      {sections.map((section) => (
        <div key={section.aisle} className="relative">
          <div className="pb-[10px] pt-5 first:pt-0">
            <Heading>{section.title}</Heading>
          </div>

          {section.rows.map((row) => (
            <div key={row.item_key} className="flex h-10 items-center gap-3 border-b border-rule">
              <button
                type="button"
                onClick={() => cycle(row)}
                className="flex flex-1 items-center gap-3 text-left"
                aria-label={`${row.item} — ${row.status}`}
              >
                <span
                  className="h-[9px] w-[9px] flex-shrink-0 rounded-full"
                  style={
                    row.status === "have"
                      ? { background: "var(--got)" }
                      : row.status === "low"
                        ? { border: "1.5px solid var(--ink-faint)" }
                        : { background: "var(--accent)" }
                  }
                />
                <span className="truncate text-sm" style={{ color: STATUS_COLOR[row.status] }}>
                  {row.item}
                </span>
                {STATUS_LABEL[row.status] ? (
                  <span className="font-hand text-base" style={{ color: STATUS_COLOR[row.status] }}>
                    {STATUS_LABEL[row.status]}
                  </span>
                ) : null}
              </button>

              {editing === row.item_key ? (
                <input
                  autoFocus
                  defaultValue={formatQuantity(row.quantity, row.unit)}
                  placeholder="1 kg"
                  onBlur={(event) => {
                    const value = event.target.value;
                    setEditing(null);
                    startTransition(async () => {
                      await setPantryAmount(row.item_key, value);
                      router.refresh();
                    });
                  }}
                  onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                  className="w-[74px] text-right text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(row.item_key)}
                  className="text-xs text-ink-faint"
                  title="How much is left"
                >
                  {formatQuantity(row.quantity, row.unit) || "how much?"}
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await removePantryItem(row.item_key);
                    router.refresh();
                  })
                }
                className="text-base leading-none text-ink-ghost"
                aria-label={`Remove ${row.item}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ))}

      {!text ? (
        <div className="relative pt-7">
          <p className="pb-1 text-[12.5px] text-ink-faint">
            {held.size ? "Anything else you keep in?" : "Start here — tap what you have."}
          </p>

          {CATALOG.map((group) => {
            const rest = group.items.filter((item) => !held.has(item.key));
            if (!rest.length) return null;

            return (
              <div key={group.key} className="pt-4">
                <div className="pb-[10px]">
                  <Heading color="var(--rule-strong)">{group.label}</Heading>
                </div>
                <div className="flex flex-wrap gap-2">
                  {rest.map((item) => {
                    const on = picked.has(item.name);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => pick(item.name)}
                        className="rounded-full px-[13px] py-[6px] text-[13px]"
                        style={
                          on
                            ? { background: "var(--accent-wash)", color: "var(--accent)", border: "1px solid var(--accent-line)" }
                            : { border: "1px solid var(--rule)", color: "var(--ink-soft)" }
                        }
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {picked.size ? (
        <div
          className="fixed inset-x-0 z-10 flex justify-center px-5"
          style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => commit([...picked])}
            className="rounded-full px-6 py-[11px] text-[14px] fade-in"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Put {picked.size} {picked.size === 1 ? "thing" : "things"} away
          </button>
        </div>
      ) : null}
    </div>
  );
}
