import { NextRequest, NextResponse } from "next/server";

const fallbackPassword = "87654321az";

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(result))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function isAdmin(request: NextRequest) {
  const secret = process.env.ADMIN_PASSWORD || fallbackPassword;
  const token = request.cookies.get("hk_admin")?.value;
  return token === await signature("admin", secret);
}

export async function requireAdmin(request: NextRequest) {
  return await isAdmin(request) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const { password } = await request.json().catch(() => ({})) as { password?: string };
  const secret = process.env.ADMIN_PASSWORD || fallbackPassword;
  if (password !== secret) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("hk_admin", await signature("admin", secret), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
