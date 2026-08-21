"use client";

import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOut() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const supabase = createClient();
          await supabase.auth.signOut();

          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/signin";
        })
      }
      className="flex h-[54px] items-center border-y border-rule text-left text-[14.5px] text-ink-soft"
    >
      <span className="flex-1">{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
