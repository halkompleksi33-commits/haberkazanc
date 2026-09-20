import { NextRequest, NextResponse } from "next/server";

const clientId = "593474322689-nvov19qvp5ig22ojjhhjfbmgb8p2c96u.apps.googleusercontent.com";
const callbackPath = "/api/auth/google/callback";

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function GET(request: NextRequest) {
  const state = encode(crypto.getRandomValues(new Uint8Array(24)));
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
  const response = NextResponse.redirect(url);
  response.cookies.set("hk_google_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
