import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import Segments from "../Segments";
import Cupboard from "./Cupboard";
import type { PantryItem } from "@/lib/types";

export default async function CupboardPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("pantry_items")
    .select("item_key, item, aisle, status, quantity, unit")
    .eq("household_id", session.household.id)
    .order("item");

  const rows = (items ?? []) as Array<
    Pick<PantryItem, "item_key" | "item" | "aisle" | "status" | "quantity" | "unit">
  >;

  const out = rows.filter((row) => row.status !== "have").length;

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Cupboard</h1>
        <span className="text-[12.5px] text-ink-faint">
          {rows.length} in{out ? `, ${out} to buy` : ""}
        </span>
      </header>

      <Segments active="/list/cupboard" />
      <Cupboard items={rows} />
    </>
  );
}
