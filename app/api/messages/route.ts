import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

function currentUser(request: NextRequest) {
  const payload = request.cookies.get("hk_session")?.value?.split(".")[0];
  if (!payload) return null;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))) as { sub?: string; exp?: number };
  } catch { return null; }
}
async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_sub TEXT NOT NULL, sender_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_sub, id)").run();
}
export async function GET(request: NextRequest) {
  const user = currentUser(request);
  if (!user?.sub || !user.exp || user.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const rows = await env.DB.prepare("SELECT id, sender_role as senderRole, body, created_at as createdAt FROM messages WHERE user_sub = ? ORDER BY id ASC").bind(user.sub).all<{ id: number; senderRole: "user" | "admin"; body: string; createdAt: string }>();
  return NextResponse.json({ messages: rows.results ?? [] });
}
export async function POST(request: NextRequest) {
  const user = currentUser(request);
  if (!user?.sub || !user.exp || user.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { body } = await request.json().catch(() => ({})) as { body?: string };
  const text = body?.trim();
  if (!text || text.length > 1000) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  await setup();
  const row = await env.DB.prepare("INSERT INTO messages (user_sub, sender_role, body) VALUES (?, 'user', ?) RETURNING id, sender_role as senderRole, body, created_at as createdAt").bind(user.sub, text).first();
  return NextResponse.json({ message: row });
}