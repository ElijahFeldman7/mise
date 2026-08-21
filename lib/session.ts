import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Household, Profile } from "./types";

export type Session = {
  userId: string;
  profile: Profile;
  household: Household;
  role: "owner" | "member";
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const { data: repaired } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email ?? "",
        display_name:
          (user.user_metadata?.full_name as string) ??
          (user.user_metadata?.name as string) ??
          user.email?.split("@")[0] ??
          null,
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      })
      .select("*")
      .single();
    profile = repaired;
  }

  if (!profile) return null;

  let householdId = profile.active_household_id;

  if (!householdId) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    householdId = membership?.household_id ?? null;
  }

  if (!householdId) {
    householdId = await makeHousehold(supabase, user.id, profile.display_name ?? "My");
  }

  if (!householdId) return null;

  const [{ data: household }, { data: membership }] = await Promise.all([
    supabase.from("households").select("*").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("role")
      .eq("household_id", householdId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!household) return null;

  return {
    userId: user.id,
    profile: profile as Profile,
    household: household as Household,
    role: (membership?.role as "owner" | "member") ?? "member",
  };
});

async function makeHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  who: string,
): Promise<string | null> {
  const code = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
  ).join("");

  const { data: household } = await supabase
    .from("households")
    .insert({ name: `${who}'s kitchen`, invite_code: code, created_by: userId })
    .select("id")
    .single();

  if (!household) return null;
  const householdId = household.id as string;

  await supabase
    .from("household_members")
    .insert({ household_id: householdId, user_id: userId, role: "owner" });

  await supabase.from("slot_templates").insert([
    { household_id: householdId, name: "Breakfast", at_time: "07:30", position: 0 },
    { household_id: householdId, name: "Lunch", at_time: "12:30", position: 1 },
    { household_id: householdId, name: "Dinner", at_time: "18:30", position: 2 },
  ]);

  await supabase
    .from("profiles")
    .update({ active_household_id: householdId })
    .eq("id", userId);

  return householdId;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/signin");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.profile.is_admin) redirect("/week");
  return session;
}

export function photoUrl(
  bucket: string,
  path: string | null | undefined,
  fallback?: string | null,
): string | null {
  if (!path) return fallback ?? null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return fallback ?? null;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
