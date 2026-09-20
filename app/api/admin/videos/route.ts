import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";

export async function GET() {
  if (!env.DB) return NextResponse.json({ videos: [] });
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const columns = await env.DB.prepare("PRAGMA table_info(videos)").all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === "screenshot")) await env.DB.prepare("ALTER TABLE videos ADD COLUMN screenshot TEXT").run();
  const rows = await env.DB.prepare("SELECT id, title, category, status, screenshot, created_at as createdAt FROM videos ORDER BY id DESC").all<{id:number;title:string;category:string;status:string;screenshot:string|null;createdAt:string}>();
  return NextResponse.json({ videos: rows.results ?? [] });
}