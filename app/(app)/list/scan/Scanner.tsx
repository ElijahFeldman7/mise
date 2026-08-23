"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  guessDate, guessLocation, guessPhone, guessStore, matchReceiptLines, parseReceiptLine,
  splitReceiptLines, type LineMatch, type MatchTarget,
} from "@/lib/ocr";
import { prepareReceiptImage } from "@/lib/images";
import { applyReceipt, type ReceiptDecision } from "@/lib/actions/receipt";
import { keepInPantry, addManualItem } from "@/lib/actions/list";
import Heading from "@/components/Heading";
import { CameraIcon, CheckIcon, ReceiptIcon } from "@/components/Icons";

type Stage = "idle" | "reading" | "review" | "done";

export default function Scanner({ targets }: { targets: MatchTarget[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [matches, setMatches] = useState<LineMatch[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [meta, setMeta] = useState<{
    store: string | null;
    date: string | null;
    location: string | null;
    phone: string | null;
    raw: string;
  }>({
    store: null,
    date: null,
    location: null,
    phone: null,
    raw: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    setStage("reading");
    setProgress(0);

    try {
      const prepared = await prepareReceiptImage(file);

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (message: { status: string; progress: number }) => {
          if (message.status === "recognizing text") setProgress(message.progress);
        },
      });

      const {
        data: { text },
      } = await worker.recognize(prepared);
      await worker.terminate();

      const store = guessStore(text);
      const lines = splitReceiptLines(text)
        .map((line, index) => parseReceiptLine(line, { index, store }))
        .filter((line): line is NonNullable<typeof line> => Boolean(line));

      const results = matchReceiptLines(lines, targets);

      setMeta({
        store,
        date: guessDate(text),
        location: guessLocation(text),
        phone: guessPhone(text),
        raw: text,
      });
      setMatches(results);
      setAccepted(
        Object.fromEntries(
          results.map((match) => [match.line.raw, match.status === "auto"]),
        ),
      );
      setStage("review");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo could not be read");
      setStage("idle");
    }
  }

  function apply() {
    const decisions: ReceiptDecision[] = matches.map((match) => ({
      raw: match.line.raw,
      parsedName: match.line.name,
      price: match.line.price,
      quantity: match.line.quantity,
      itemId: match.itemId,
      confidence: match.confidence,
      accepted: Boolean(match.itemId && accepted[match.line.raw]),
    }));

    startTransition(async () => {
      const result = await applyReceipt({
        store: meta.store,
        location: meta.location,
        phone: meta.phone,
        purchasedOn: meta.date,
        rawText: meta.raw,
        decisions,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setStage("done");
      router.refresh();
    });
  }

  if (stage === "idle" || stage === "reading") {
    return (
      <div className="flex flex-col items-center px-5 pt-8">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <div className="flex h-[260px] w-full max-w-[280px] items-center justify-center rounded-[3px] bg-photo-empty text-ink-ghost">
          <ReceiptIcon size={72} />
        </div>

        {stage === "reading" ? (
          <>
            <p className="mt-7 text-sm text-ink-soft">Reading it…</p>
            <div className="mt-3 h-[3px] w-full max-w-[280px] rounded bg-rule">
              <div
                className="h-full rounded bg-accent transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-8 flex h-[50px] w-full max-w-[280px] items-center justify-center gap-[10px] rounded-[3px] bg-accent text-[15px] font-medium text-white"
            >
              <CameraIcon size={19} />
              <span>Take a photo</span>
            </button>
            <p className="mt-5 max-w-[280px] text-center text-[11.5px] leading-relaxed text-ink-faint">
              Read right here on your phone. The photo never leaves it.
            </p>
          </>
        )}

        {error ? <p className="mt-5 text-[13px] text-accent">{error}</p> : null}
      </div>
    );
  }

  if (stage === "done") {
    const checked = matches.filter((match) => match.itemId && accepted[match.line.raw]).length;
    return (
      <div className="flex flex-col items-center px-5 pt-16">
        <span className="font-hand text-[44px] font-bold leading-none text-got">
          {checked} crossed off
        </span>
        <button
          type="button"
          onClick={() => router.push("/list")}
          className="mt-9 h-[50px] rounded-[3px] bg-accent px-8 text-[15px] font-medium text-white"
        >
          Back to the list
        </button>
      </div>
    );
  }

  const auto = matches.filter((m) => m.status === "auto");
  const suggested = matches.filter((m) => m.status === "suggested");
  const unmatched = matches.filter((m) => m.status === "unmatched");
  const willCheck = matches.filter((m) => m.itemId && accepted[m.line.raw]).length;

  return (
    <div className="px-5 pt-2">
      <div className="flex items-center gap-[14px]">
        <div className="flex h-[60px] w-[46px] flex-shrink-0 items-center justify-center rounded-[2px] bg-photo-empty text-ink-ghost">
          <ReceiptIcon size={20} />
        </div>
        <div className="flex-1">
          <div className="text-[14.5px] font-medium -tracking-[0.01em]">
            {meta.store ?? "That receipt"}
            {meta.date ? ` · ${meta.date}` : ""}
          </div>
          <div className="mt-[3px] text-xs text-ink-faint">
            {matches.length} lines read, {auto.length + suggested.length} matched
          </div>
          {meta.location ? (
            <div className="mt-[2px] truncate text-[11px] text-ink-faint">{meta.location}</div>
          ) : null}
        </div>
      </div>

      {auto.length ? (
        <>
          <div className="pb-[10px] pt-6">
            <Heading color="var(--got)">Crossing these off</Heading>
          </div>
          {auto.map((match) => (
            <label
              key={match.line.raw}
              className="flex h-[42px] items-center gap-[13px] border-b border-rule"
            >
              <button
                type="button"
                onClick={() =>
                  setAccepted((state) => ({ ...state, [match.line.raw]: !state[match.line.raw] }))
                }
                className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[3px]"
                style={
                  accepted[match.line.raw]
                    ? { background: "var(--got)", color: "#fff" }
                    : { border: "1.5px solid var(--rule-strong)" }
                }
              >
                {accepted[match.line.raw] ? <CheckIcon size={11} /> : null}
              </button>
              <span className="flex-1 truncate text-[13.5px]">
                {match.itemName}
                {match.line.quantity && match.line.quantity > 1 ? (
                  <span className="text-ink-faint"> ×{match.line.quantity}</span>
                ) : null}
              </span>
              <span className="truncate text-[11px] text-ink-faint">{match.line.raw}</span>
            </label>
          ))}
        </>
      ) : null}

      {suggested.length ? (
        <>
          <div className="pb-[10px] pt-6">
            <Heading>Is this a match?</Heading>
          </div>
          {suggested.map((match) => (
            <div key={match.line.raw} className="border-b border-rule pb-4 pt-1">
              <div className="flex items-baseline gap-[9px]">
                <span className="text-xs text-ink-faint">{match.line.raw}</span>
                <span className="text-xs text-ink-ghost">→</span>
                <span className="text-[15px] font-medium">{match.itemName}</span>
              </div>
              <div className="mt-3 flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setAccepted((state) => ({ ...state, [match.line.raw]: true }))}
                  className="h-[38px] rounded-[3px] px-6 text-sm font-medium"
                  style={
                    accepted[match.line.raw]
                      ? { background: "var(--got)", color: "#fff" }
                      : { border: "1px solid var(--got)", color: "var(--got)" }
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setAccepted((state) => ({ ...state, [match.line.raw]: false }))}
                  className="text-sm"
                  style={{
                    color: accepted[match.line.raw] ? "var(--ink-soft)" : "var(--ink)",
                  }}
                >
                  No, not that
                </button>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {unmatched.length ? (
        <>
          <div className="pb-[10px] pt-6">
            <Heading>Wasn&apos;t on the list</Heading>
          </div>
          {unmatched.slice(0, 12).map((match) => (
            <div
              key={match.line.raw}
              className="flex h-[42px] items-center gap-3 border-b border-rule"
            >
              <span className="flex-1 truncate text-[13.5px]">
                {match.line.name}
                {match.line.quantity && match.line.quantity > 1 ? (
                  <span className="text-ink-faint"> ×{match.line.quantity}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() =>
                  startTransition(
                    async () => void (await keepInPantry(match.line.name, match.line.quantity)),
                  )
                }
                className="text-[13px] text-accent"
              >
                pantry
              </button>
              <button
                type="button"
                onClick={() =>
                  startTransition(
                    async () => void (await addManualItem(match.line.name, match.line.quantity)),
                  )
                }
                className="text-[13px] text-ink-soft"
              >
                add
              </button>
            </div>
          ))}
        </>
      ) : null}

      <div className="sticky bottom-0 -mx-5 mt-6 bg-paper px-5 pb-7 pt-4">
        <button
          type="button"
          onClick={apply}
          disabled={pending}
          className="flex h-[50px] w-full items-center justify-center rounded-[3px] bg-accent text-[15px] font-medium text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : `Cross off ${willCheck} ${willCheck === 1 ? "thing" : "things"}`}
        </button>
      </div>

      {error ? <p className="pb-4 text-[13px] text-accent">{error}</p> : null}
    </div>
  );
}
