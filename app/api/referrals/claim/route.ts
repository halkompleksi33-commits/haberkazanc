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
  try { return JSON.parse(fromBase64Url(payload)) as { sub?: string; exp?: number }; } catch { return null; }
}

async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS contributors (google_sub TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, referral_code TEXT, referred_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await env.DB!.prepare("CREATE UNIQUE INDEX IF NOT EXISTS contributors_referral_code_idx ON contributors(referral_code)").run();
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS referrals (referred_sub TEXT PRIMARY KEY, referrer_sub TEXT NOT NULL, reward INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

export async function POST(request: NextRequest) {
  const user = currentUser(request);
  const { code } = await request.json().catch(() => ({})) as { code?: string };
  const referralCode = code?.trim();
  if (!user?.sub || !user.exp || user.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!referralCode || !/^[A-Za-z0-9_-]{8,64}$/.test(referralCode)) return NextResponse.json({ error: "Geçersiz referans kodu." }, { status: 400 });
  await setup();

  const contributor = await env.DB.prepare("SELECT referred_by as referredBy FROM contributors WHERE google_sub = ?").bind(user.sub).first<{ referredBy: string | null }>();
  if (!contributor) return NextResponse.json({ error: "Kullanıcı kaydı bulunamadı." }, { status: 404 });
  if (contributor.referredBy) return NextResponse.json({ error: "Referans kodu daha önce kullanılmış." }, { status: 409 });

  const referrer = await env.DB.prepare("SELECT google_sub FROM contributors WHERE referral_code = ?").bind(referralCode).first<{ google_sub: string }>();
  if (!referrer || referrer.google_sub === user.sub) return NextResponse.json({ error: "Bu referans kodu kullanılamaz." }, { status: 400 });

  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO referrals (referred_sub, referrer_sub, reward) VALUES (?, ?, 10)").bind(user.sub, referrer.google_sub),
    env.DB.prepare("UPDATE contributors SET referred_by = ? WHERE google_sub = ? AND referred_by IS NULL AND EXISTS (SELECT 1 FROM referrals WHERE referred_sub = ? AND referrer_sub = ?)").bind(referrer.google_sub, user.sub, user.sub, referrer.google_sub),
    env.DB.prepare("UPDATE contributors SET balance = balance + 10 WHERE google_sub = ? AND EXISTS (SELECT 1 FROM contributors WHERE google_sub = ? AND referred_by = ?)").bind(referrer.google_sub, user.sub, referrer.google_sub),
  ]);

  const result = await env.DB.prepare("SELECT balance FROM contributors WHERE google_sub = ?").bind(user.sub).first<{ balance: number }>();
  return NextResponse.json({ ok: true, balance: result?.balance ?? 0, referredBy: referrer.google_sub });
}
