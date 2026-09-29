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

export async function POST(request: NextRequest) {
  const user = currentUser(request);
  const { fullName, iban } = await request.json().catch(() => ({})) as { fullName?: string; iban?: string };
  const name = fullName?.trim();
  const normalizedIban = iban?.replaceAll(" ", "").toUpperCase();
  if (!user?.sub || !user.exp || user.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!name || name.length < 3 || name.length > 120) return NextResponse.json({ error: "Ad soyad bilgisi gerekli." }, { status: 400 });
  if (!normalizedIban || !/^TR\d{24}$/.test(normalizedIban)) return NextResponse.json({ error: "Geçerli bir Türkiye IBAN'ı gir." }, { status: 400 });

  await env.DB.prepare("CREATE TABLE IF NOT EXISTS payout_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, full_name TEXT NOT NULL, iban TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const contributor = await env.DB.prepare("SELECT balance FROM contributors WHERE google_sub = ?").bind(user.sub).first<{ balance: number }>();
  if (!contributor || contributor.balance < 250) return NextResponse.json({ error: "Ödeme talebi için bakiyen en az 250 TL olmalı." }, { status: 400 });
  const active = await env.DB.prepare("SELECT id FROM payout_requests WHERE google_sub = ? AND status = 'İnceleniyor'").bind(user.sub).first();
  if (active) return NextResponse.json({ error: "İncelenmekte olan bir ödeme talebin var." }, { status: 409 });

  await env.DB.prepare("INSERT INTO payout_requests (google_sub, full_name, iban, amount) VALUES (?, ?, ?, ?)").bind(user.sub, name, normalizedIban, contributor.balance).run();
  return NextResponse.json({ ok: true, amount: contributor.balance });
}
