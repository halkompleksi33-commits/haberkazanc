import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_sub TEXT NOT NULL, sender_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_sub, id)").run();
}
export async function GET() {
  if (!env.DB) return NextResponse.json({ threads: [] });
  await setup();
  const rows = await env.DB.prepare("SELECT m.user_sub as userId, c.name as name, c.email as email, m.body as lastMessage, m.created_at as createdAt FROM messages m LEFT JOIN contributors c ON c.google_sub = m.user_sub WHERE m.id IN (SELECT MAX(id) FROM messages GROUP BY user_sub) ORDER BY m.id DESC").all<{ userId: string; name: string | null; email: string | null; lastMessage: string; createdAt: string }>();
  return NextResponse.json({ threads: rows.results ?? [] });
}
export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const { userId, body } = await request.json().catch(() => ({})) as { userId?: string; body?: string };
  const text = body?.trim();
  if (!userId || !text || text.length > 1000) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  await setup();
  await env.DB.prepare("INSERT INTO messages (user_sub, sender_role, body) VALUES (?, 'admin', ?)").bind(userId, text).run();
  return NextResponse.json({ ok: true });
}