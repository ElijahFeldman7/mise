"use client";

import { useState, useTransition } from "react";
import { addPlanEntry } from "@/lib/actions/plan";

/**
 * Two jobs, same little form: write something into an existing slot without a
 * recipe, or invent a whole new time of day.
 */
export default function AddSlot({
  date,
  presetLabel,
  presetTime,
  mode,
}: {
  date: string;
  presetLabel?: string;
  presetTime?: string | null;
  mode: "freetext" | "new";
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(presetLabel ?? "");
  const [time, setTime] = useState(presetTime?.slice(0, 5) ?? "");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const slotLabel = (mode === "freetext" ? presetLabel : label)?.trim();
    if (!slotLabel) return;
    startTransition(async () => {
      await addPlanEntry({
        date,
        slotLabel,
        slotTime: time ? `${time}:00` : null,
        freeText: text.trim() || (mode === "new" ? "Something" : "Leftovers"),
      });
      setOpen(false);
      setText("");
      if (mode === "new") setLabel("");
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm"
        style={{ color: mode === "new" ? "var(--ink-faint)" : "var(--ink-soft)" }}
      >
        {mode === "new" ? "+ Another time — snack, prep, anything" : "Just write something in"}
      </button>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-3">
        {mode === "new" ? (
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Second breakfast"
            className="field flex-1 text-sm"
          />
        ) : null}
        <input
          value={time}
          onChange={(event) => setTime(event.target.value)}
          placeholder="18:30"
          type="time"
          className="field w-[110px] text-sm"
        />
      </div>
      <input
        autoFocus={mode === "freetext"}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && submit()}
        placeholder="What are you having?"
        className="field mt-3 text-sm"
      />
      <div className="mt-3 flex items-center gap-5">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-10 rounded-[3px] bg-accent px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add it"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft">
          Never mind
        </button>
      </div>
    </div>
  );
}
