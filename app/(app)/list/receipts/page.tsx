import Link from "next/link";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, fromISODate } from "@/lib/dates";
import { CameraIcon } from "@/components/Icons";
import type { Receipt } from "@/lib/types";

export function money(total: number | null, currency: string): string {
  if (total === null) return "";
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${total.toFixed(2)}`;
}

export default async function ReceiptsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("receipts")
    .select("*")
    .eq("household_id", session.household.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const receipts = (data ?? []) as Receipt[];
  const spent = receipts.reduce((sum, receipt) => sum + (receipt.total ?? 0), 0);

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Receipts</h1>
        <Link href="/list/scan" className="flex items-center gap-[7px] text-[13.5px] text-accent">
          <CameraIcon size={17} />
          <span>Scan one</span>
        </Link>
      </header>

      <div className="margin-rule relative px-5 pt-1">
        <div className="relative flex items-baseline justify-between pb-[14px]">
          <Link href="/list" className="text-[12.5px] text-ink-faint">
            ‹ Back to the list
          </Link>
          {spent > 0 ? (
            <span className="text-[12.5px] text-accent">
              {money(spent, receipts[0]?.currency ?? "USD")} in {receipts.length}
            </span>
          ) : null}
        </div>

        {receipts.length === 0 ? (
          <p className="relative py-8 text-[13.5px] text-ink-faint">
            Nothing scanned yet. Photograph a receipt at the door and it ticks the list off
            for you.
          </p>
        ) : null}

        {receipts.map((receipt) => (
          <Link
            key={receipt.id}
            href={`/list/receipts/${receipt.id}`}
            className="relative flex h-[58px] items-center gap-4 border-b border-rule"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{receipt.store ?? "Unnamed shop"}</div>
              <div className="mt-[3px] text-xs text-ink-faint">
                {receipt.purchased_on
                  ? formatLongDate(fromISODate(receipt.purchased_on))
                  : formatLongDate(new Date(receipt.created_at))}
                {" · "}
                {receipt.matched_count} of {receipt.line_count} matched
              </div>
            </div>
            <span className="text-[13.5px]">{money(receipt.total, receipt.currency)}</span>
            <span className="text-ink-ghost">›</span>
          </Link>
        ))}
      </div>
    </>
  );
}
