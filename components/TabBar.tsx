"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon, BookIcon, ListIcon, HouseIcon, PersonIcon, ShieldIcon,
} from "./Icons";

const TABS = [
  { href: "/week", label: "Week", Icon: CalendarIcon, match: /^\/(week|day)/ },
  { href: "/recipes", label: "Recipes", Icon: BookIcon, match: /^\/recipes/ },
  { href: "/list", label: "List", Icon: ListIcon, match: /^\/list/ },
  { href: "/household", label: "Household", Icon: HouseIcon, match: /^\/household/ },
  { href: "/you", label: "You", Icon: PersonIcon, match: /^\/you/ },
];

const ADMIN_TAB = { href: "/admin", label: "Admin", Icon: ShieldIcon, match: /^\/admin/ };

export default function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;
  const six = tabs.length === 6;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-rule bg-paper"
      style={{ height: 68, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, Icon, match }) => {
        const active = match.test(pathname);
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-[5px]"
            style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
          >
            <Icon size={six ? 19 : 20} />
            <span style={{ fontSize: six ? 10.5 : 11 }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
