import { NextRequest, NextResponse } from "next/server";

const clientId = "593474322689-nvov19qvp5ig22ojjhhjfbmgb8p2c96u.apps.googleusercontent.com";
const parentSite = "https://mersinmanset.tr/hk/";

function failed(reason: string) {
  return NextResponse.redirect(new URL(`?login=failed&reason=${reason}`, parentSite));
}

function toBase64Url(value: string) {
  return btoa(unescape(encodeURIComponent(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("hk_google_state")?.value;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (error) return failed("google_rejected");
  if (!code) return failed("missing_code");
  if (!state || state !== expectedState) return failed("state_mismatch");
  if (!secret) return failed("missing_secret");

  const callback = new URL("/api/auth/google/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri: callback, grant_type: "authorization_code" }) });
  const tokens = await tokenResponse.json() as { access_token?: string };
  if (!tokens.access_token) return failed("token_exchange");
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; picture?: string };
  if (!profile.sub || !profile.email || !profile.name) return failed("profile_fetch");

  const payload = toBase64Url(JSON.stringify({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture, exp: Date.now() + 7 * 24 * 60 * 60 }));
  const response = NextResponse.redirect(parentSite);
  response.cookies.set("hk_google_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("hk_session", `${payload}.${await sign(payload, secret)}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
