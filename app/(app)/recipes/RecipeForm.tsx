"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images";
import { saveRecipe, deleteRecipe, type RecipeInput } from "@/lib/actions/recipes";
import Heading from "@/components/Heading";
import { CameraIcon } from "@/components/Icons";

export type FormValues = {
  id?: string;
  title: string;
  totalMinutes: string;
  servings: string;
  ovenTempF: string;
  cuisine: string;
  category: string;
  tags: string[];
  imagePath: string | null;
  imageUrl: string | null;
  ingredients: Array<{ quantityText: string; item: string }>;
  instructions: string[];
};

const CATEGORIES = ["breakfast", "lunch", "dinner", "side", "dessert", "snack", "prep"];

export default function RecipeForm({ initial }: { initial: FormValues }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setIngredient(index: number, patch: Partial<{ quantityText: string; item: string }>) {
    setValues((current) => {
      const next = [...current.ingredients];
      next[index] = { ...next[index], ...patch };

      if (index === next.length - 1 && (next[index].item || next[index].quantityText)) {
        next.push({ quantityText: "", item: "" });
      }
      return { ...current, ingredients: next };
    });
  }

  function setStep(index: number, text: string) {
    setValues((current) => {
      const next = [...current.instructions];
      next[index] = text;
      if (index === next.length - 1 && text.trim()) next.push("");
      return { ...current, instructions: next };
    });
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file, { maxEdge: 1600, quality: 0.85 });
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again");

      const path = `${user.id}/covers/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-photos")
        .upload(path, compressed.blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      set("imagePath", path);
      set("imageUrl", compressed.previewUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo would not upload");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    const payload: RecipeInput = {
      id: values.id,
      title: values.title,
      totalMinutes: values.totalMinutes ? Number(values.totalMinutes) : null,
      servings: Number(values.servings) || 4,
      ovenTempF: values.ovenTempF ? Number(values.ovenTempF) : null,
      cuisine: values.cuisine || null,
      category: values.category || "dinner",
      tags: values.tags,
      instructions: values.instructions.filter((step) => step.trim()),
      ingredients: values.ingredients.filter((row) => row.item.trim()),
      imagePath: values.imagePath,
    };

    startTransition(async () => {
      const result = await saveRecipe(payload);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.push(`/recipes/${result.id}`);
    });
  }

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <button type="button" onClick={() => router.back()} className="text-sm text-ink-faint">
          Cancel
        </button>
        <span className="text-[15px] font-semibold -tracking-[0.015em]">
          {values.id ? "Your version" : "New recipe"}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !values.title.trim()}
          className="text-sm font-semibold text-accent disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="flex flex-col gap-5 px-5 pt-2 pb-8">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadPhoto(file);
          }}
        />

        <div className="flex gap-2">
          {values.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.imageUrl}
              alt=""
              className="h-[104px] w-[104px] rounded-[3px] object-cover"
            />
          ) : null}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex h-[104px] w-[104px] flex-col items-center justify-center gap-[7px] rounded-[3px] bg-photo-empty text-ink-faint disabled:opacity-60"
          >
            <CameraIcon size={24} />
            <span className="text-[11px]">{uploading ? "saving…" : "take one"}</span>
          </button>
        </div>

        <div>
          <div className="text-[11.5px] text-ink-faint">Call it whatever you want</div>
          <input
            value={values.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Dad's brisket"
            className="mt-1 w-full pb-[9px] pt-[7px] text-[21px] font-semibold -tracking-[0.025em]"
            style={{ borderBottom: "1.5px solid var(--accent)" }}
          />
        </div>

        <div className="flex gap-[14px]">
          <label className="flex-1">
            <div className="text-[11.5px] text-ink-faint">Takes (min)</div>
            <input
              value={values.totalMinutes}
              onChange={(event) => set("totalMinutes", event.target.value)}
              inputMode="numeric"
              placeholder="45"
              className="field mt-1 py-2 text-[14.5px]"
            />
          </label>
          <label className="flex-1">
            <div className="text-[11.5px] text-ink-faint">Serves</div>
            <input
              value={values.servings}
              onChange={(event) => set("servings", event.target.value)}
              inputMode="numeric"
              placeholder="4"
              className="field mt-1 py-2 text-[14.5px]"
            />
          </label>
          <label className="flex-1">
            <div className="text-[11.5px] text-ink-faint">Oven °F</div>
            <input
              value={values.ovenTempF}
              onChange={(event) => set("ovenTempF", event.target.value)}
              inputMode="numeric"
              placeholder="425"
              className="field mt-1 py-2 text-[14.5px]"
            />
          </label>
        </div>

        <Heading>Ingredients</Heading>

        <div className="-mt-3 flex flex-col">
          {values.ingredients.map((row, index) => (
            <div key={index} className="flex h-[42px] items-center gap-[14px] border-b border-rule">
              <input
                value={row.quantityText}
                onChange={(event) => setIngredient(index, { quantityText: event.target.value })}
                placeholder="qty"
                className="w-[52px] text-[13.5px] text-ink-soft"
              />
              <input
                value={row.item}
                onChange={(event) => setIngredient(index, { item: event.target.value })}
                placeholder={index === values.ingredients.length - 1 ? "next ingredient" : ""}
                className="flex-1 text-[13.5px]"
              />
            </div>
          ))}
        </div>

        <Heading>How to make it</Heading>

        <div className="-mt-3 flex flex-col gap-[14px]">
          {values.instructions.map((step, index) => (
            <div key={index} className="flex gap-[14px]">
              <span className="w-[15px] flex-shrink-0 font-hand text-[23px] leading-none text-accent">
                {index + 1}
              </span>
              <textarea
                value={step}
                onChange={(event) => setStep(index, event.target.value)}
                placeholder={index === values.instructions.length - 1 ? "Write the next step" : ""}
                rows={Math.max(1, Math.ceil(step.length / 44))}
                className="flex-1 resize-none border-b border-rule pb-[11px] text-[13.5px] leading-relaxed"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-[18px]">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => set("category", option)}
              className="text-[12.5px]"
              style={
                values.category === option
                  ? { color: "var(--accent)", fontWeight: 600 }
                  : { color: "var(--ink-faint)" }
              }
            >
              {option}
            </button>
          ))}
        </div>

        {error ? <p className="text-[13px] text-accent">{error}</p> : null}

        {values.id ? (
          <button
            type="button"
            onClick={() => startTransition(async () => void (await deleteRecipe(values.id!)))}
            className="mt-2 self-start text-[13px] text-ink-faint"
          >
            Delete this recipe
          </button>
        ) : null}
      </div>
    </>
  );
}
