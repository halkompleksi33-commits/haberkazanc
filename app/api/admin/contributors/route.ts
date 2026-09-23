import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../auth/route";

async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS contributors (google_sub TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS referrals (referred_sub TEXT PRIMARY KEY, referrer_sub TEXT NOT NULL, reward INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_sub TEXT NOT NULL, sender_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (!env.DB) return NextResponse.json({ contributors: [] });
  await setup();
  const rows = await env.DB.prepare("SELECT google_sub as id, name, email, balance, created_at as createdAt FROM contributors ORDER BY created_at DESC").all<{ id: string; name: string; email: string; balance: number; createdAt: string }>();
  return NextResponse.json({ contributors: rows.results ?? [] });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id, balance } = await request.json().catch(() => ({})) as { id?: string; balance?: number };
  if (!env.DB || !id || !Number.isSafeInteger(balance) || balance < 0) return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
  await setup();
  const result = await env.DB.prepare("UPDATE contributors SET balance = ? WHERE google_sub = ?").bind(balance, id).run();
  if (!result.meta.changes) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, balance });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await request.json().catch(() => ({})) as { id?: string };
  if (!env.DB || !id) return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  await setup();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE user_sub = ?").bind(id),
    env.DB.prepare("DELETE FROM videos WHERE google_sub = ?").bind(id),
    env.DB.prepare("DELETE FROM referrals WHERE referred_sub = ? OR referrer_sub = ?").bind(id, id),
    env.DB.prepare("DELETE FROM contributors WHERE google_sub = ?").bind(id),
  ]);
  return NextResponse.json({ ok: true });
}
