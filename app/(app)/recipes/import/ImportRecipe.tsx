"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  importRecipeFromText,
  importRecipeFromUrl,
  saveImportedRecipe,
  type ImportResult,
} from "@/lib/actions/import";
import type { RecipeDraft } from "@/lib/import/normalize";
import { formatQuantity } from "@/lib/units";
import { formatMinutes } from "@/lib/dates";
import Heading from "@/components/Heading";
import { CheckIcon } from "@/components/Icons";

type Stage =
  | { at: "paste" }
  | { at: "review"; draft: RecipeDraft }
  | { at: "known"; id: string; title: string }
  | { at: "stuck"; message: string; lines: string[]; url: string | null };

export default function ImportRecipe({ initialUrl }: { initialUrl: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "text">("link");
  const [url, setUrl] = useState(initialUrl);
  const [pasted, setPasted] = useState("");
  const [stage, setStage] = useState<Stage>({ at: "paste" });
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function land(result: ImportResult) {
    if (!result.ok) {
      setStage({ at: "stuck", message: result.error, lines: result.lines ?? [], url: result.url ?? null });
      return;
    }
    if ("existing" in result) {
      setStage({ at: "known", id: result.existing.id, title: result.existing.title });
      return;
    }
    setDropped(new Set());
    setTitle(result.draft.title);
    setStage({ at: "review", draft: result.draft });
  }

  function read() {
    const text = url.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => land(await importRecipeFromUrl(text)));
  }

  function readPasted() {
    const text = pasted.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => land(await importRecipeFromText(text)));
  }

  function save(draft: RecipeDraft) {
    startTransition(async () => {
      const result = await saveImportedRecipe({
        ...draft,
        title: title.trim() || draft.title,
        ingredients: draft.ingredients.filter((_, index) => !dropped.has(index)),
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.push(`/recipes/${result.id}`);
    });
  }

  if (stage.at === "known") {
    return (
      <div className="flex flex-col gap-5 px-5 pt-3">
        <p className="text-[14.5px] text-ink-soft">
          You already have this one — it came in from that link before.
        </p>
        <Link href={`/recipes/${stage.id}`} className="text-[15px] text-accent">
          Open {stage.title} ›
        </Link>
        <button
          type="button"
          onClick={() => setStage({ at: "paste" })}
          className="self-start text-[13.5px] text-ink-faint"
        >
          Import a different link
        </button>
      </div>
    );
  }

  if (stage.at === "review") {
    const draft = stage.draft;
    const keeping = draft.ingredients.length - dropped.size;

    return (
      <div className="flex flex-col gap-[22px] px-5 pt-2 pb-10">
        <div className="flex flex-col gap-[10px]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="field text-[19px] font-semibold -tracking-[0.02em]"
          />
          {draft.sourceUrl ? (
            <a
              href={draft.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[12.5px] text-ink-faint"
            >
              from {draft.sourceDomain} · view original
            </a>
          ) : (
            <span className="text-[12.5px] text-ink-faint">pasted in by hand</span>
          )}
        </div>

        {draft.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.imageUrl}
            alt=""
            className="h-[168px] w-full rounded-[3px] object-cover"
            style={{ background: "var(--photo-empty)" }}
          />
        ) : null}

        <div className="flex gap-5 text-[12.5px] text-ink-soft">
          <span>{draft.servings} servings</span>
          {draft.totalMinutes ? <span>{formatMinutes(draft.totalMinutes)}</span> : null}
          <span>{draft.instructions.length} steps</span>
        </div>

        <div>
          <Heading>{keeping} ingredients</Heading>
          <div className="pt-2">
            {draft.ingredients.map((row, index) => {
              const out = dropped.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setDropped((current) => {
                      const next = new Set(current);
                      if (out) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                  className="flex h-10 w-full items-center gap-4 border-b border-rule text-left"
                >
                  <span
                    className="flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-[3px]"
                    style={
                      out
                        ? { border: "1.5px solid var(--rule-strong)" }
                        : { background: "var(--accent)", color: "#fff" }
                    }
                  >
                    {out ? null : <CheckIcon size={12} />}
                  </span>
                  <span
                    className="flex-1 truncate text-sm"
                    style={out ? { color: "var(--ink-faint)", textDecoration: "line-through" } : undefined}
                  >
                    {row.item}
                    {row.note ? <span className="text-ink-faint"> · {row.note}</span> : null}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {formatQuantity(row.quantity, row.unit)}
                    {row.pack_size_qty
                      ? ` (${formatQuantity(row.pack_size_qty, row.pack_size_unit)})`
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {draft.unparsed.length ? (
          <div>
            <Heading color="var(--rule-strong)">Couldn&apos;t read these</Heading>
            <div className="flex flex-col gap-[6px] pt-2">
              {draft.unparsed.map((line, index) => (
                <span key={index} className="text-[13px] text-ink-faint">
                  {line}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-accent">{error}</p> : null}

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => save(draft)}
            disabled={pending}
            className="text-[15px] text-accent"
          >
            {pending ? "Saving…" : "Save to my recipes"}
          </button>
          <button
            type="button"
            onClick={() => setStage({ at: "paste" })}
            className="text-[13.5px] text-ink-faint"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px] px-5 pt-2">
      <div className="flex gap-5 text-[13.5px]">
        <button
          type="button"
          onClick={() => setMode("link")}
          className={mode === "link" ? "text-accent" : "text-ink-faint"}
        >
          From a link
        </button>
        <button
          type="button"
          onClick={() => setMode("text")}
          className={mode === "text" ? "text-accent" : "text-ink-faint"}
        >
          Paste it in
        </button>
      </div>

      {mode === "link" ? (
        <>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && read()}
            placeholder="Paste a link to a recipe"
            className="field text-[14.5px]"
            type="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />

          <button
            type="button"
            onClick={read}
            disabled={pending || !url.trim()}
            className="self-start text-[15px] text-accent disabled:text-ink-ghost"
          >
            {pending ? "Reading the page…" : "Read it"}
          </button>
        </>
      ) : (
        <>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={"Paste the whole recipe — title, ingredients, and method\n\nIngredients:\n2 cups flour\n1 cup sugar\n\nInstructions:\n1. Mix it all together\n2. Bake at 350°F for 20 minutes"}
            rows={10}
            className="field text-[14.5px] leading-relaxed"
          />

          <button
            type="button"
            onClick={readPasted}
            disabled={pending || !pasted.trim()}
            className="self-start text-[15px] text-accent disabled:text-ink-ghost"
          >
            {pending ? "Reading it…" : "Extract it"}
          </button>
        </>
      )}

      {stage.at === "stuck" ? (
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-[13.5px] text-ink-soft">{stage.message}</p>
          {stage.lines.length ? (
            <>
              <Heading color="var(--rule-strong)">What was on the page</Heading>
              <div className="max-h-[260px] overflow-y-auto text-[13px] text-ink-faint">
                {stage.lines.map((line, index) => (
                  <p key={index} className="border-b border-rule py-[6px]">
                    {line}
                  </p>
                ))}
              </div>
            </>
          ) : null}
          <Link href="/recipes/new" className="text-[14px] text-accent">
            Write it out by hand ›
          </Link>
        </div>
      ) : (
        <p className="text-[13px] text-ink-faint">
          {mode === "link"
            ? "Most cooking sites work. The ingredients and method come across, quantities and all — you get a look before anything is saved."
            : "Include an \"Ingredients\" and \"Instructions\" line if you can — it makes the split reliable. Quantities are read out of each line the same way."}
        </p>
      )}
    </div>
  );
}
