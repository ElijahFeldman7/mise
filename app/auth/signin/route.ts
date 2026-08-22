import { NextResponse, type NextRequest } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function b64url(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

function requestOrigin(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const host = request.headers.get("x-forwarded-host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${new URL(request.url).origin}/signin?error=google_not_configured`);
  }

  const origin = requestOrigin(request);
  const next = new URL(request.url).searchParams.get("next") ?? "/week";
  const join = new URL(request.url).searchParams.get("join")?.trim().slice(0, 16) || null;

  const state = crypto.randomUUID();
  const { verifier, challenge } = await pkcePair();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: 600,
  };

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`);
  response.cookies.set("g_oauth_state", state, base);
  response.cookies.set("g_oauth_verifier", verifier, base);
  response.cookies.set("g_oauth_next", next.startsWith("/") ? next : "/week", base);
  if (join) response.cookies.set("g_oauth_join", join, base);
  return response;
}
