import { NextRequest, NextResponse } from "next/server";

const clientId = "593474322689-nvov19qvp5ig22ojjhhjfbmgb8p2c96u.apps.googleusercontent.com";
const callbackPath = "/api/auth/google/callback";

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encode(new Uint8Array(signature));
}

export async function GET(request: NextRequest) {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) return new NextResponse("Google giriş yapılandırması eksik.", { status: 503 });
  const payload = btoa(JSON.stringify({ nonce: encode(crypto.getRandomValues(new Uint8Array(24))), exp: Date.now() + 10 * 60 * 1000 })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const state = `${payload}.${await sign(payload, secret)}`;
  const callback = new URL(callbackPath, request.url).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(url);
}
