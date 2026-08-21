"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const LOOKS_LIKE_LINK = /^(https?:\/\/|www\.)\S+$|^\S+\.[a-z]{2,}\/\S+$/i;

export default function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  const link = useMemo(() => {
    const text = value.trim();
    return LOOKS_LIKE_LINK.test(text) ? text : null;
  }, [value]);

  useEffect(() => {
    if (link) return;
    const timer = setTimeout(() => {
      if (value === initial) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      router.replace(`/recipes?${next.toString()}`);
    }, 260);
    return () => clearTimeout(timer);
  }, [value, initial, params, router, link]);

  return (
    <div className="flex flex-col gap-[10px]">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search recipes, or paste a link"
        className="field text-[14.5px]"
        type="search"
        autoCapitalize="off"
        autoCorrect="off"
      />
      {link ? (
        <Link
          href={`/recipes/import?url=${encodeURIComponent(link)}`}
          className="text-[13.5px] text-accent fade-in"
        >
          Import this link ›
        </Link>
      ) : null}
    </div>
  );
}
