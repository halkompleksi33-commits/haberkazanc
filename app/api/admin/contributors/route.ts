import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET() {
  if (!env.DB) return NextResponse.json({ contributors: [] });
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS contributors (google_sub TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const rows = await env.DB.prepare("SELECT google_sub as id, name, email, balance, created_at as createdAt FROM contributors ORDER BY created_at DESC").all<{ id: string; name: string; email: string; balance: number; createdAt: string }>();
  return NextResponse.json({ contributors: rows.results ?? [] });
}