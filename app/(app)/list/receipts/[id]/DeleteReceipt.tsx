"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteReceipt } from "@/lib/actions/receipt";

export default function DeleteReceipt({ id }: { id: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!sure) {
    return (
      <button
        type="button"
        onClick={() => setSure(true)}
        className="self-start text-[13px] text-ink-ghost"
      >
        Delete this receipt
      </button>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteReceipt(id);
            router.push("/list/receipts");
          })
        }
        className="text-[13.5px] text-accent"
      >
        {pending ? "Deleting…" : "Yes, delete it"}
      </button>
      <button type="button" onClick={() => setSure(false)} className="text-[13px] text-ink-faint">
        Keep it
      </button>
    </div>
  );
}
