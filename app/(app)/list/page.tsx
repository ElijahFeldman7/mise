import Link from "next/link";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { currentListId } from "@/lib/server/list";
import { startOfWeek, toISODate, formatWeekRange } from "@/lib/dates";
import { CameraIcon } from "@/components/Icons";
import Segments from "./Segments";
import Nudge from "./Nudge";
import GroceryList from "./GroceryList";
import type { GroceryItem } from "@/lib/types";

export default async function ListPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const weekStart = startOfWeek(new Date());
  const listId = await currentListId(session.household.id, toISODate(weekStart));

  const [{ data: items }, { data: members }, { count: mealCount }] = await Promise.all([
    listId
      ? supabase
          .from("grocery_items")
          .select("*")
          .eq("list_id", listId)
          .order("aisle")
          .order("position")
      : Promise.resolve({ data: [] as GroceryItem[] }),
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .in(
        "id",
        (
          await supabase
            .from("household_members")
            .select("user_id")
            .eq("household_id", session.household.id)
        ).data?.map((row) => row.user_id) ?? [],
      ),
    supabase
      .from("plan_entries")
      .select("id", { count: "exact", head: true })
      .eq("household_id", session.household.id)
      .gte("on_date", toISODate(weekStart)),
  ]);

  const { data: running } = await supabase
    .from("pantry_items")
    .select("item, item_key, used_since_buy")
    .eq("household_id", session.household.id)
    .eq("status", "have")
    .eq("kind", "staple")
    .gte("used_since_buy", 6)
    .order("used_since_buy", { ascending: false })
    .limit(1)
    .maybeSingle();

  const people = new Map(
    (members ?? []).map((person) => [
      person.id as string,
      ((person.display_name as string) ?? (person.email as string) ?? "?").charAt(0).toUpperCase(),
    ]),
  );

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Grocery list</h1>
        <div className="flex items-center gap-[18px]">
          <Link href="/list/receipts" className="text-[13.5px] text-ink-soft">
            Receipts
          </Link>
          <Link href="/list/scan" className="flex items-center gap-[7px] text-[13.5px] text-accent">
            <CameraIcon size={17} />
            <span>Scan</span>
          </Link>
        </div>
      </header>

      <Segments active="/list" />

      {running ? (
        <div className="px-5 pt-3">
          <Nudge
            item={running.item as string}
            itemKey={running.item_key as string}
            times={running.used_since_buy as number}
          />
        </div>
      ) : null}

      <GroceryList
        items={(items ?? []) as GroceryItem[]}
        listId={listId}
        householdId={session.household.id}
        currentUserId={session.userId}
        people={Object.fromEntries(people)}
        summary={`From ${mealCount ?? 0} ${mealCount === 1 ? "meal" : "meals"}, ${formatWeekRange(weekStart)}`}
      />
    </>
  );
}
