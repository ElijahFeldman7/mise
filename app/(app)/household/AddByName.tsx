"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMemberByUserId, searchProfiles } from "@/lib/actions/household";
import { PersonIcon } from "@/components/Icons";

type Result = { id: string; display_name: string | null; email: string; avatar_url: string | null };

export default function AddByName() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      const result = await searchProfiles(text);
      if ("error" in result && result.error) {
        setError(result.error);
        setResults([]);
      } else if ("results" in result) {
        setError(null);
        setResults(result.results);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start pb-2 text-[13px] text-ink-faint"
      >
        Or add someone by name
      </button>
    );
  }

  return (
    <div className="pb-2">
      <input
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Name or email"
        className="field text-[15px]"
      />

      {searching ? <p className="mt-3 text-[13px] text-ink-faint">Looking…</p> : null}

      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">No one found with an account here.</p>
      ) : null}

      {results.map((person) => (
        <div key={person.id} className="mt-3 flex items-center gap-3">
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.avatar_url}
              alt=""
              className="h-[34px] w-[34px] rounded-full object-cover"
            />
          ) : (
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-photo-empty text-ink-ghost">
              <PersonIcon size={15} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-medium -tracking-[0.01em]">
              {person.display_name ?? person.email}
            </div>
            <div className="truncate text-[11.5px] text-ink-faint">{person.email}</div>
          </div>
          <button
            type="button"
            disabled={pending || added[person.id]}
            onClick={() =>
              startTransition(async () => {
                const result = await addMemberByUserId(person.id);
                if ("error" in result && result.error) {
                  setError(result.error);
                  return;
                }
                setAdded((state) => ({ ...state, [person.id]: true }));
                router.refresh();
              })
            }
            className="text-[13px] text-accent disabled:text-ink-faint"
          >
            {added[person.id] ? "Added" : "Add"}
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setQuery("");
          setResults([]);
          setError(null);
        }}
        className="mt-4 text-sm text-ink-soft"
      >
        Never mind
      </button>

      {error ? <p className="mt-3 text-[13px] text-accent">{error}</p> : null}
    </div>
  );
}
