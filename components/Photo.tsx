import { PlateIcon } from "./Icons";

export default function Photo({
  src,
  alt,
  size,
  className = "",
  rounded = 3,
}: {
  src?: string | null;
  alt?: string;
  size: number;
  className?: string;
  rounded?: number;
}) {
  const style = {
    width: size,
    height: size,
    borderRadius: rounded,
    flexShrink: 0,
  } as const;

  if (!src) {
    return (
      <div
        style={style}
        className={`flex items-center justify-center bg-photo-empty text-ink-ghost ${className}`}
      >
        <PlateIcon size={Math.round(size * 0.46)} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      style={style}
      className={`object-cover ${className}`}
      loading="lazy"
    />
  );
}

export function HeroPhoto({ src, alt }: { src?: string | null; alt?: string }) {
  if (!src) {
    return (
      <div className="flex h-[236px] w-full items-center justify-center bg-photo-empty text-ink-ghost">
        <PlateIcon size={84} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} className="h-[236px] w-full object-cover" />
  );
}
