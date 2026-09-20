import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function POST(request: NextRequest) {
  if (!env.DB) return NextResponse.json({ online: 0, visitors: 0 });
  const body = await request.json().catch(() => null) as { visitorId?: string } | null;
  const visitorId = body?.visitorId;
  if (!visitorId || !/^[a-zA-Z0-9_-]{16,80}$/.test(visitorId)) return NextResponse.json({ error: "Invalid visitor" }, { status: 400 });

  await env.DB.prepare("CREATE TABLE IF NOT EXISTS visitor_presence (visitor_id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL)").run();
  const now = Date.now();
  await env.DB.prepare("INSERT INTO visitor_presence (visitor_id, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen = excluded.last_seen").bind(visitorId, now, now).run();
  const online = await env.DB.prepare("SELECT COUNT(*) AS count FROM visitor_presence WHERE last_seen >= ?").bind(now - 5 * 60 * 1000).first<{ count: number }>();
  const visitors = await env.DB.prepare("SELECT COUNT(*) AS count FROM visitor_presence").first<{ count: number }>();
  return NextResponse.json({ online: online?.count ?? 0, visitors: visitors?.count ?? 0 });
}