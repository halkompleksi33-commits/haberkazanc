import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)));
}

function currentUser(request: NextRequest) {
  const token = request.cookies.get("hk_session")?.value;
  const [payload] = token?.split(".") ?? [];
  if (!payload) return null;
  try { return JSON.parse(fromBase64Url(payload)) as { sub?: string; name?: string; email?: string; exp?: number }; } catch { return null; }
}

async function ensureColumn(name: string, definition: string) {
  const columns = await env.DB!.prepare("PRAGMA table_info(contributors)").all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === name)) {
    await env.DB!.prepare(`ALTER TABLE contributors ADD COLUMN ${definition}`).run();
  }
}

async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS contributors (google_sub TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await ensureColumn("referral_code", "referral_code TEXT");
  await ensureColumn("referred_by", "referred_by TEXT");
  await env.DB!.prepare("CREATE UNIQUE INDEX IF NOT EXISTS contributors_referral_code_idx ON contributors(referral_code)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS referrals (referred_sub TEXT PRIMARY KEY, referrer_sub TEXT NOT NULL, reward INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

export async function GET(request: NextRequest) {
  const user = currentUser(request);
  if (!user?.sub || !user.name || !user.email || !user.exp || user.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  await env.DB.prepare("INSERT INTO contributors (google_sub, name, email, balance) VALUES (?, ?, ?, 0) ON CONFLICT(google_sub) DO UPDATE SET name = excluded.name, email = excluded.email").bind(user.sub, user.name, user.email).run();
  const contributor = await env.DB.prepare("SELECT balance, referral_code as referralCode FROM contributors WHERE google_sub = ?").bind(user.sub).first<{ balance: number; referralCode: string | null }>();
  const videos = await env.DB.prepare("SELECT id, title, category, status, created_at as createdAt FROM videos WHERE google_sub = ? ORDER BY id DESC").bind(user.sub).all<{ id: number; title: string; category: string; status: string; createdAt: string }>();
  const approved = await env.DB.prepare("SELECT COUNT(*) as count FROM videos WHERE google_sub = ? AND status = 'Onaylandı'").bind(user.sub).first<{ count: number }>();
  const referralCount = await env.DB.prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_sub = ?").bind(user.sub).first<{ count: number }>();
  return NextResponse.json({ balance: contributor?.balance ?? 0, approvedCount: approved?.count ?? 0, videos: videos.results ?? [], referralCode: contributor?.referralCode ?? null, referralCount: referralCount?.count ?? 0 });
}
