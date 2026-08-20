import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import AdminUsers from "./AdminUsers";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await requireAdmin();
  const supabase = await createClient();

  let people = supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, is_admin, created_at, last_seen_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) people = people.or(`email.ilike.%${q}%,display_name.ilike.%${q}%`);

  const [{ data: profiles }, { count: userCount }, { count: householdCount }, { count: recipeCount }] =
    await Promise.all([
      people,
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("households").select("id", { count: "exact", head: true }),
      supabase.from("recipes").select("id", { count: "exact", head: true }),
    ]);

  const ids = (profiles ?? []).map((row) => row.id as string);
  const { data: memberships } = ids.length
    ? await supabase
        .from("household_members")
        .select("user_id, household:households(name)")
        .in("user_id", ids)
    : { data: [] };

  const householdByUser = new Map<string, string>();
  for (const row of (memberships ?? []) as unknown as Array<{
    user_id: string;
    household: { name: string } | null;
  }>) {
    if (row.household?.name && !householdByUser.has(row.user_id)) {
      householdByUser.set(row.user_id, row.household.name);
    }
  }

  return (
    <>
      <header className="flex h-[58px] items-center justify-between px-5">
        <h1 className="text-[18px] font-semibold -tracking-[0.02em]">Admin</h1>
      </header>

      <div className="flex flex-col gap-5 px-5 pt-2">
        <div className="flex gap-9">
          <div>
            <div className="text-[26px] font-semibold -tracking-[0.03em]">{userCount ?? 0}</div>
            <div className="mt-[2px] text-[11.5px] text-ink-faint">people</div>
          </div>
          <div>
            <div className="text-[26px] font-semibold -tracking-[0.03em]">
              {householdCount ?? 0}
            </div>
            <div className="mt-[2px] text-[11.5px] text-ink-faint">households</div>
          </div>
          <div>
            <div className="text-[26px] font-semibold -tracking-[0.03em]">
              {(recipeCount ?? 0).toLocaleString()}
            </div>
            <div className="mt-[2px] text-[11.5px] text-ink-faint">recipes</div>
          </div>
        </div>

        <AdminUsers
          initialQuery={q ?? ""}
          currentUserId={session.userId}
          users={(profiles ?? []).map((row) => ({
            id: row.id as string,
            email: row.email as string,
            name: (row.display_name as string) ?? "",
            isAdmin: row.is_admin as boolean,
            household: householdByUser.get(row.id as string) ?? null,
            joined: row.created_at as string,
          }))}
        />
      </div>
    </>
  );
}
