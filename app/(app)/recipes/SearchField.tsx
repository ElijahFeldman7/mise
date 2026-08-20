"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === initial) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      router.replace(`/recipes?${next.toString()}`);
    }, 260);
    return () => clearTimeout(timer);
  }, [value, initial, params, router]);

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder="Search recipes"
      className="field text-[14.5px]"
      type="search"
    />
  );
}
