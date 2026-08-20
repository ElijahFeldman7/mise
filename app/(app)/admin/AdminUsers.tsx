"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAdmin } from "@/lib/actions/admin";

type Row = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  household: string | null;
  joined: string;
};

export default function AdminUsers({
  users,
  initialQuery,
  currentUserId,
}: {
  users: Row[];
  initialQuery: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query === initialQuery) return;
      router.replace(query.trim() ? `/admin?q=${encodeURIComponent(query.trim())}` : "/admin");
    }, 260);
    return () => clearTimeout(timer);
  }, [query, initialQuery, router]);

  function toggle(row: Row, makeAdmin: boolean) {
    if (row.isAdmin === makeAdmin) return;
    startTransition(async () => {
      const result = await setAdmin(row.id, makeAdmin);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Name or email"
        className="field text-sm"
        type="search"
      />

      {error ? <p className="text-[13px] text-accent">{error}</p> : null}

      <div className="flex flex-col pb-8" style={{ opacity: pending ? 0.6 : 1 }}>
        {users.map((row) => (
          <div key={row.id} className="flex items-center gap-3 border-b border-rule py-[13px]">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium -tracking-[0.01em]">
                {row.name || row.email.split("@")[0]}
                {row.id === currentUserId ? <span className="text-ink-faint"> · you</span> : null}
              </div>
              <div className="mt-[2px] truncate text-[11.5px] text-ink-faint">
                {row.email} · {row.household ?? "no household"}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <button
                type="button"
                onClick={() => toggle(row, true)}
                className="text-[11.5px]"
                style={
                  row.isAdmin
                    ? {
                        color: "var(--accent)",
                        fontWeight: 600,
                        borderBottom: "2px solid var(--accent)",
                        paddingBottom: 2,
                      }
                    : { color: "var(--ink-ghost)" }
                }
              >
                admin
              </button>
              <button
                type="button"
                onClick={() => toggle(row, false)}
                className="text-[11.5px]"
                style={
                  !row.isAdmin
                    ? {
                        color: "var(--accent)",
                        fontWeight: 600,
                        borderBottom: "2px solid var(--accent)",
                        paddingBottom: 2,
                      }
                    : { color: "var(--ink-ghost)" }
                }
              >
                user
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 ? (
          <p className="py-8 text-[13.5px] text-ink-faint">Nobody matches that.</p>
        ) : null}
      </div>
    </>
  );
}
