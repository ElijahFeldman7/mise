import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, fromISODate } from "@/lib/dates";
import Heading from "@/components/Heading";
import DeleteReceipt from "./DeleteReceipt";
import { money } from "../page";
import type { Receipt, ReceiptLine } from "@/lib/types";

const LINE_NOTE: Record<ReceiptLine["status"], string> = {
  auto: "ticked off",
  confirmed: "ticked off",
  suggested: "left alone",
  rejected: "left alone",
  unmatched: "",
};

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("receipts")
    .select("*, receipt_lines(*)")
    .eq("id", id)
    .eq("household_id", session.household.id)
    .maybeSingle();

  if (!data) notFound();

  const receipt = data as Receipt & { receipt_lines: ReceiptLine[] };
  const lines = [...(receipt.receipt_lines ?? [])];
  const matched = lines.filter((line) => line.status === "auto" || line.status === "confirmed");
  const rest = lines.filter((line) => !matched.includes(line));

  let imageUrl: string | null = null;
  if (receipt.image_path) {
    const { data: signed } = await supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.image_path, 60);
    imageUrl = signed?.signedUrl ?? null;
  }

  const when = receipt.purchased_on
    ? formatLongDate(fromISODate(receipt.purchased_on))
    : formatLongDate(new Date(receipt.created_at));

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="truncate text-[18px] font-semibold -tracking-[0.02em]">
          {receipt.store ?? "Receipt"}
        </h1>
        <Link href="/list/receipts" className="text-[13.5px] text-ink-faint">
          All receipts
        </Link>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pt-2 pb-8">
        <div className="flex items-baseline justify-between">
          <span className="text-[12.5px] text-ink-faint">{when}</span>
          <span className="text-[15px]">{money(receipt.total, receipt.currency)}</span>
        </div>

        {receipt.location || receipt.phone ? (
          <div className="-mt-3 text-[12px] text-ink-faint">
            {[receipt.location, receipt.phone].filter(Boolean).join(" · ")}
          </div>
        ) : null}

        {receipt.tax !== null ? (
          <div className="-mt-3 text-[12px] text-ink-faint">
            {money(receipt.tax, receipt.currency)} tax
          </div>
        ) : null}

        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="max-h-[320px] w-full rounded-[3px] object-contain"
            style={{ background: "var(--photo-empty)" }}
          />
        ) : null}

        {matched.length ? (
          <div>
            <Heading>{matched.length} matched the list</Heading>
            <div className="pt-2">
              {matched.map((line) => (
                <div key={line.id} className="flex h-9 items-center gap-3 border-b border-rule">
                  <span className="flex-1 truncate text-sm">
                    {line.parsed_name ?? line.raw_line}
                    {line.quantity && line.quantity > 1 ? (
                      <span className="text-ink-faint"> ×{line.quantity}</span>
                    ) : null}
                  </span>
                  <span className="font-hand text-base text-got">{LINE_NOTE[line.status]}</span>
                  <span className="w-[52px] text-right text-xs text-ink-faint">
                    {line.price !== null ? money(line.price, receipt.currency) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rest.length ? (
          <div>
            <Heading color="var(--rule-strong)">Everything else on it</Heading>
            <div className="pt-2">
              {rest.map((line) => (
                <div key={line.id} className="flex h-9 items-center gap-3 border-b border-rule">
                  <span className="flex-1 truncate text-sm text-ink-soft">
                    {line.parsed_name ?? line.raw_line}
                  </span>
                  <span className="w-[52px] text-right text-xs text-ink-faint">
                    {line.price !== null ? money(line.price, receipt.currency) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <DeleteReceipt id={receipt.id} />
      </div>
    </>
  );
}
