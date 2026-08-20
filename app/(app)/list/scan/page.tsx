import Link from "next/link";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft } from "@/components/Icons";
import Scanner from "./Scanner";

export default async function ScanPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("grocery_items")
    .select("id, item, item_key, checked")
    .eq("household_id", session.household.id)
    .eq("checked", false);

  return (
    <>
      <header className="flex h-[58px] items-center gap-2 px-5">
        <Link
          href="/list"
          className="-ml-2 flex h-[34px] w-[34px] items-center justify-center text-ink-soft"
          aria-label="Back to the list"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Scan a receipt</h1>
      </header>

      <Scanner
        targets={(items ?? []).map((item) => ({
          id: item.id as string,
          item: item.item as string,
          item_key: item.item_key as string,
          checked: false,
        }))}
      />
    </>
  );
}
