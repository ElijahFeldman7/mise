"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rollInviteCode } from "@/lib/actions/household";

function pretty(code: string) {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export default function InviteCode({ code, canRoll }: { code: string; canRoll: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/signin?join=${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join our kitchen on mise", url });
        return;
      } catch {
        // they cancelled — fall through to copying
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="-mt-3 flex flex-col items-center gap-[6px]">
      <span className="text-xs text-ink-faint">Read them this code</span>
      <span className="font-hand text-[46px] font-bold leading-[1.05] text-accent">
        {pretty(code)}
      </span>
      <div className="mt-[10px] flex items-center gap-[26px]">
        <button type="button" onClick={copy} className="text-[13.5px] text-ink-soft">
          {copied ? "copied" : "Copy it"}
        </button>
        <button
          type="button"
          onClick={share}
          className="border-b border-accent-line pb-[2px] text-[13.5px] text-accent"
        >
          Share a link
        </button>
        {canRoll ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await rollInviteCode();
                router.refresh();
              })
            }
            className="text-[13.5px] text-ink-faint"
          >
            New code
          </button>
        ) : null}
      </div>
    </div>
  );
}
