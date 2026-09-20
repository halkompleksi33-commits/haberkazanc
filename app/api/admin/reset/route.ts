import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
const password = "87654321az";
export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({})) as { password?: string };
  if (data.password !== password) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.DB) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM videos"),
    env.DB.prepare("DELETE FROM referrals"),
    env.DB.prepare("DELETE FROM contributors"),
  ]);
  return NextResponse.json({ ok: true });
}