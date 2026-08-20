import Link from "next/link";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import Heading from "@/components/Heading";
import TastePrefs from "./TastePrefs";
import SignOut from "./SignOut";

export default async function YouPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: pantry } = await supabase
    .from("pantry_items")
    .select("item_key, item")
    .eq("household_id", session.household.id)
    .order("item");

  const name = session.profile.display_name ?? session.profile.email;

  return (
    <>
      <header className="flex h-[58px] items-center px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">You</h1>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pt-2">
        <div className="flex items-center gap-4">
          {session.profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.profile.avatar_url}
              alt=""
              className="h-[62px] w-[62px] rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-[62px] w-[62px] items-center justify-center rounded-full text-[23px] font-semibold"
              style={{ background: "#e0c3b3", color: "#8a4527" }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold -tracking-[0.02em]">{name}</div>
            <div className="mt-[3px] truncate text-xs text-ink-faint">{session.profile.email}</div>
          </div>
          {session.profile.is_admin ? (
            <span className="text-[11.5px] text-accent">admin</span>
          ) : null}
        </div>

        <TastePrefs
          dietTags={session.profile.diet_tags ?? []}
          avoid={session.profile.avoid_ingredients ?? []}
          weeknightMax={session.profile.weeknight_max_minutes ?? 45}
        />

        <Heading>Always in the cupboard</Heading>
        <div className="-mt-3 flex flex-wrap gap-x-[18px] gap-y-2">
          {(pantry ?? []).map((row) => (
            <span key={row.item_key as string} className="text-[13.5px]">
              {row.item as string}
            </span>
          ))}
          {(pantry ?? []).length === 0 ? (
            <span className="text-[13px] text-ink-faint">
              Tap &quot;always have&quot; on any list row and it moves here.
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex flex-col">
          {session.profile.is_admin ? (
            <Link
              href="/admin"
              className="flex h-[54px] items-center border-t border-rule text-[14.5px]"
            >
              <span className="flex-1">Admin</span>
              <span className="text-ink-ghost">›</span>
            </Link>
          ) : null}
          <Link
            href="/list"
            className="flex h-[54px] items-center border-t border-rule text-[14.5px]"
          >
            <span className="flex-1">This week&apos;s list</span>
            <span className="text-ink-ghost">›</span>
          </Link>
          <SignOut />
        </div>
      </div>
    </>
  );
}
