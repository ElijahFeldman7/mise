import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import Heading from "@/components/Heading";
import HouseholdName from "./HouseholdName";
import InviteCode from "./InviteCode";
import JoinAnother from "./JoinAnother";
import MemberRow from "./MemberRow";
import CooksFor from "./CooksFor";
import { dietSentence, householdDiet } from "@/lib/server/diet";
import { DIET_LABEL } from "@/lib/ingredients";

export default async function HouseholdPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at")
    .eq("household_id", session.household.id)
    .order("joined_at");

  const ids = (memberRows ?? []).map((row) => row.user_id as string);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, display_name, email, avatar_url").in("id", ids)
    : { data: [] };

  const byId = new Map((people ?? []).map((person) => [person.id as string, person]));
  const diet = await householdDiet(session.household.id);

  const members = (memberRows ?? []).map((row) => {
    const person = byId.get(row.user_id as string);
    return {
      userId: row.user_id as string,
      role: row.role as "owner" | "member",
      name: (person?.display_name as string) ?? (person?.email as string) ?? "Someone",
      email: (person?.email as string) ?? "",
      avatarUrl: (person?.avatar_url as string) ?? null,
    };
  });

  return (
    <>
      <header className="flex h-[58px] items-center px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Household</h1>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pt-2">
        <HouseholdName name={session.household.name} canEdit={session.role === "owner"} />

        <CooksFor
          count={session.household.cooks_for ?? 2}
          diet={dietSentence(diet.dietTags, DIET_LABEL)}
        />

        <div className="-mt-2">
          <Heading>Who&apos;s in it</Heading>
        </div>

        <div className="-mt-3 flex flex-col">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isYou={member.userId === session.userId}
              youAreOwner={session.role === "owner"}
            />
          ))}
        </div>

        <Heading>Add someone</Heading>
        <InviteCode code={session.household.invite_code} canRoll={session.role === "owner"} />

        <p className="border-t border-rule pt-[18px] text-[12.5px] leading-relaxed text-ink-faint text-pretty">
          Everyone here sees the same week and the same list. Anything they tick off shows up on
          your phone straight away.
        </p>

        <JoinAnother />
      </div>
    </>
  );
}
