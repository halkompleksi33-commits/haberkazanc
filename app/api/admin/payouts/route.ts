import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../auth/route";

async function setup() {
  await env.DB!.prepare("CREATE TABLE IF NOT EXISTS payout_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, full_name TEXT NOT NULL, iban TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (!env.DB) return NextResponse.json({ payouts: [] });
  await setup();
  const rows = await env.DB.prepare("SELECT p.id, p.google_sub as userId, p.full_name as fullName, p.iban, p.amount, p.status, p.created_at as createdAt, c.name as googleName, c.email as email FROM payout_requests p LEFT JOIN contributors c ON c.google_sub = p.google_sub ORDER BY p.id DESC").all();
  return NextResponse.json({ payouts: rows.results ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id, status } = await request.json().catch(() => ({})) as { id?: number; status?: "Onaylandı" | "Reddedildi" };
  if (!env.DB || !Number.isSafeInteger(id) || !["Onaylandı", "Reddedildi"].includes(status || "")) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await setup();
  const payout = await env.DB.prepare("SELECT google_sub as userId, amount, status FROM payout_requests WHERE id = ?").bind(id).first<{ userId: string; amount: number; status: string }>();
  if (!payout) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (payout.status !== "İnceleniyor") return NextResponse.json({ error: "Bu talep zaten sonuçlandırılmış." }, { status: 409 });

  if (status === "Onaylandı") {
    const contributor = await env.DB.prepare("SELECT balance FROM contributors WHERE google_sub = ?").bind(payout.userId).first<{ balance: number }>();
    if (!contributor || contributor.balance < 250) return NextResponse.json({ error: "Kullanıcının bakiyesi artık yeterli değil." }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("UPDATE payout_requests SET status = 'Onaylandı' WHERE id = ? AND status = 'İnceleniyor'").bind(id),
      env.DB.prepare("UPDATE contributors SET balance = balance - 250 WHERE google_sub = ? AND balance >= 250").bind(payout.userId),
    ]);
  } else {
    await env.DB.prepare("UPDATE payout_requests SET status = 'Reddedildi' WHERE id = ? AND status = 'İnceleniyor'").bind(id).run();
  }
  return NextResponse.json({ ok: true, status });
}
