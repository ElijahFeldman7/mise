import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function requestOrigin(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const host = request.headers.get("x-forwarded-host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(message)}`);

  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("missing_code");

  const storedState = request.cookies.get("g_oauth_state")?.value;
  const verifier = request.cookies.get("g_oauth_verifier")?.value;
  const nextCookie = request.cookies.get("g_oauth_next")?.value ?? "/week";
  const joinCookie = request.cookies.get("g_oauth_join")?.value;

  if (!storedState || !verifier || storedState !== state) {
    return fail("invalid_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SECRET;
  if (!clientId || !clientSecret) return fail("google_not_configured");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${requestOrigin(request)}/auth/callback`,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) return fail("google_token_exchange_failed");
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return fail("missing_id_token");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokens.id_token,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(error.message)}`);
  }

  let joinError: string | null = null;
  if (joinCookie) {
    const { error: joinRpcError } = await supabase.rpc("join_household", { code: joinCookie });
    if (joinRpcError) joinError = joinRpcError.message;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  const destination = joinCookie
    ? `/household${joinError ? `?joinError=${encodeURIComponent(joinError)}` : ""}`
    : nextCookie;

  const response = NextResponse.redirect(`${base}${destination}`);
  for (const name of ["g_oauth_state", "g_oauth_verifier", "g_oauth_next", "g_oauth_join"]) {
    response.cookies.delete(name);
  }
  return response;
}
