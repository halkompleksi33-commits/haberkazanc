import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";

function user(request: NextRequest) {
  const token = request.cookies.get("hk_session")?.value?.split(".")[0];
  try {
    return token ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(token.length / 4) * 4, "=")), (char) => char.charCodeAt(0)))) : null;
  } catch { return null; }
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

export async function POST(request: NextRequest) {
  const currentUser = user(request) as { sub?: string; exp?: number } | null;
  if (!currentUser?.sub || !currentUser.exp || currentUser.exp < Date.now() || !env.DB) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const image = form.get("screenshot");
  if (!(image instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) return NextResponse.json({ error: "PNG, JPG veya WebP ekran görüntüsü gerekli." }, { status: 400 });
  if (image.size > 700 * 1024) return NextResponse.json({ error: "Ekran görüntüsü çok büyük. Lütfen daha küçük bir görsel seç." }, { status: 413 });

  await env.DB.prepare("CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, google_sub TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'İnceleniyor', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  const columns = await env.DB.prepare("PRAGMA table_info(videos)").all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === "screenshot")) await env.DB.prepare("ALTER TABLE videos ADD COLUMN screenshot TEXT").run();

  const bytes = new Uint8Array(await image.arrayBuffer());
  const screenshot = `data:${image.type};base64,${toBase64(bytes)}`;
  await env.DB.prepare("INSERT INTO videos (google_sub, title, category, status, screenshot) VALUES (?, ?, ?, 'İnceleniyor', ?)").bind(currentUser.sub, `WhatsApp teyiti: ${image.name}`, "Video teyidi", screenshot).run();
  return NextResponse.json({ ok: true });
}
