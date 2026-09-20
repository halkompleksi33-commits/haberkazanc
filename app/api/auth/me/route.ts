import { NextRequest, NextResponse } from "next/server";

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

function parsePayload(token?: string) {
  if (!token) return null;
  const [payload] = token.split(".");
  if (!payload) return null;
  try { return JSON.parse(fromBase64Url(payload)); } catch { return null; }
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("hk_session")?.value;
  const [payload, signature] = token?.split(".") ?? [];
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!payload || !signature || !secret || signature !== await sign(payload, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = parsePayload(token) as { name?: string; picture?: string; exp?: number } | null;
  if (!user?.name || !user.exp || user.exp < Date.now()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ name: user.name, picture: user.picture });
}
