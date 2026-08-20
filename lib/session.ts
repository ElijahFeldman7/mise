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

/**
 * Everything a page needs to know about who is asking. Cached per request, so
 * a layout and its page share one round trip.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

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

/** Public URL for a stored photo, or the remote one a library recipe came with. */
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
