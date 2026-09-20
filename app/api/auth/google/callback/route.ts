import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

const clientId = "593474322689-nvov19qvp5ig22ojjhhjfbmgb8p2c96u.apps.googleusercontent.com";
const parentSite = "https://haberkazanc.halkompleksi33.workers.dev/";

function failed(reason: string) { return NextResponse.redirect(new URL(`?login=failed&reason=${reason}`, parentSite)); }
function toBase64Url(value: string) { return btoa(unescape(encodeURIComponent(value))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function randomReferralCode() { return Array.from(crypto.getRandomValues(new Uint8Array(12)), (value) => value.toString(36).padStart(2, "0")).join("").slice(0, 16); }
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function stateData(state: string, secret: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || signature !== await sign(payload, secret)) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))))) as { exp?: number; nonce?: string; ref?: string };
    return decoded.nonce && typeof decoded.exp === "number" && decoded.exp > Date.now() ? decoded : null;
  } catch { return null; }
}
async function setup() {
  if (!env.DB) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS contributors (google_sub TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, balance INTEGER NOT NULL DEFAULT 0, referral_code TEXT, referred_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const columns = await env.DB.prepare("PRAGMA table_info(contributors)").all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === "referral_code")) await env.DB.prepare("ALTER TABLE contributors ADD COLUMN referral_code TEXT").run();
  if (!columns.results?.some((column) => column.name === "referred_by")) await env.DB.prepare("ALTER TABLE contributors ADD COLUMN referred_by TEXT").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS contributors_referral_code_idx ON contributors(referral_code)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS referrals (referred_sub TEXT PRIMARY KEY, referrer_sub TEXT NOT NULL, reward INTEGER NOT NULL DEFAULT 10, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}
async function createContributor(profile: { sub: string; name: string; email: string }, referralCode?: string) {
  if (!env.DB) return;
  await setup();
  const existing = await env.DB.prepare("SELECT google_sub FROM contributors WHERE google_sub = ?").bind(profile.sub).first();
  if (existing) return;
  let ownCode = randomReferralCode();
  for (let i = 0; i < 4; i++) {
    const used = await env.DB.prepare("SELECT google_sub FROM contributors WHERE referral_code = ?").bind(ownCode).first();
    if (!used) break;
    ownCode = randomReferralCode();
  }
  const referrer = referralCode ? await env.DB.prepare("SELECT google_sub FROM contributors WHERE referral_code = ?").bind(referralCode).first<{ google_sub: string }>() : null;
  const validReferrer = referrer && referrer.google_sub !== profile.sub ? referrer.google_sub : null;
  await env.DB.prepare("INSERT INTO contributors (google_sub, name, email, balance, referral_code, referred_by) VALUES (?, ?, ?, 0, ?, ?)").bind(profile.sub, profile.name, profile.email, ownCode, validReferrer).run();
  if (validReferrer) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO referrals (referred_sub, referrer_sub, reward) VALUES (?, ?, 10)").bind(profile.sub, validReferrer),
      env.DB.prepare("UPDATE contributors SET balance = balance + 10 WHERE google_sub = ? AND EXISTS (SELECT 1 FROM referrals WHERE referred_sub = ?)").bind(validReferrer, profile.sub),
    ]);
  }
}
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (error) return failed("google_rejected");
  if (!code) return failed("missing_code");
  if (!secret) return failed("missing_secret");
  const stateInfo = state ? await stateData(state, secret) : null;
  if (!stateInfo) return failed("state_mismatch");
  const callback = new URL("/api/auth/google/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: secret, redirect_uri: callback, grant_type: "authorization_code" }) });
  const tokens = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokens.access_token) return failed(`token_${tokens.error || "exchange"}`);
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json() as { sub?: string; email?: string; name?: string; picture?: string };
  if (!profile.sub || !profile.email || !profile.name) return failed("profile_fetch");
  await createContributor({ sub: profile.sub, email: profile.email, name: profile.name }, stateInfo.ref);
  const payload = toBase64Url(JSON.stringify({ sub: profile.sub, email: profile.email, name: profile.name, picture: profile.picture, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const response = NextResponse.redirect(parentSite);
  response.cookies.set("hk_session", `${payload}.${await sign(payload, secret)}`, { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
