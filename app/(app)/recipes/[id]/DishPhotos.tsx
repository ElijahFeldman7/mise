"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images";
import { addRecipePhoto, removeRecipePhoto } from "@/lib/actions/recipes";
import { CameraIcon } from "@/components/Icons";

/**
 * Photos of the dish as this house actually made it. Compressed on the phone
 * before they go anywhere — a camera frame lands at a couple of hundred KB.
 */
export default function DishPhotos({
  recipeId,
  photos,
}: {
  recipeId: string;
  photos: Array<{ id: string; url: string }>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file, { maxEdge: 1400, quality: 0.82 });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in again");

      const path = `${user.id}/${recipeId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-photos")
        .upload(path, compressed.blob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) throw uploadError;

      await addRecipePhoto({
        recipeId,
        storagePath: path,
        width: compressed.width,
        height: compressed.height,
        bytes: compressed.bytes,
      });

      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo would not upload");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="-mt-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <div className="flex gap-2 overflow-x-auto">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() =>
              startTransition(async () => {
                await removeRecipePhoto(photo.id, recipeId);
                router.refresh();
              })
            }
            title="Remove this photo"
            className="h-[82px] w-[82px] flex-shrink-0 rounded-[3px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              className="h-full w-full rounded-[3px] object-cover"
              loading="lazy"
            />
          </button>
        ))}

        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-[82px] w-[82px] flex-shrink-0 flex-col items-center justify-center gap-[6px] rounded-[3px] bg-photo-empty text-ink-faint disabled:opacity-60"
        >
          <CameraIcon size={21} />
          <span className="text-[10.5px]">{busy ? "saving…" : "add one"}</span>
        </button>
      </div>

      {error ? <p className="mt-3 text-[13px] text-accent">{error}</p> : null}
      {photos.length === 0 && !busy ? (
        <p className="mt-3 text-[12.5px] text-ink-faint">
          Take one next time you cook it — it becomes the photo everyone sees.
        </p>
      ) : null}
    </div>
  );
}
