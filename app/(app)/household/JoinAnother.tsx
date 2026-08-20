"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinHousehold } from "@/lib/actions/household";

export default function JoinAnother() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start pb-8 text-[13px] text-ink-faint"
      >
        Join a different household with a code
      </button>
    );
  }

  return (
    <div className="pb-8">
      <input
        autoFocus
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="4K2P-9M"
        className="field font-hand text-[28px] font-bold text-accent"
      />
      <div className="mt-4 flex items-center gap-5">
        <button
          type="button"
          disabled={pending || !code.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await joinHousehold(code);
              if ("error" in result && result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            })
          }
          className="h-10 rounded-[3px] bg-accent px-5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Joining…" : "Join"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-soft">
          Never mind
        </button>
      </div>
      {error ? <p className="mt-3 text-[13px] text-accent">{error}</p> : null}
    </div>
  );
}
