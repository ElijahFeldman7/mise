import Link from "next/link";

const TABS = [
  { href: "/list", label: "List" },
  { href: "/list/cupboard", label: "Cupboard" },
];

export default function Segments({ active }: { active: "/list" | "/list/cupboard" }) {
  return (
    <div className="flex gap-[22px] px-5 pt-[2px]">
      {TABS.map((tab) => {
        const on = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="pb-[3px] text-[13.5px]"
            style={
              on
                ? { color: "var(--accent)", fontWeight: 600, borderBottom: "2px solid var(--accent)" }
                : { color: "var(--ink-soft)" }
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
