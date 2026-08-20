"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameHousehold } from "@/lib/actions/household";
import { PencilIcon } from "@/components/Icons";

export default function HouseholdName({ name, canEdit }: { name: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-[10px]">
        <span className="font-hand text-[38px] font-bold leading-none">{name}</span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-ink-faint"
            aria-label="Rename"
          >
            <PencilIcon size={16} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          startTransition(async () => {
            await renameHousehold(value);
            setEditing(false);
            router.refresh();
          });
        }}
        className="field font-hand text-[34px] font-bold leading-none"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await renameHousehold(value);
            setEditing(false);
            router.refresh();
          })
        }
        className="pb-2 text-sm text-accent"
      >
        Save
      </button>
    </div>
  );
}
