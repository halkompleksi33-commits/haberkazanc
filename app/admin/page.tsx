"use client";

import { useEffect, useState } from "react";

type Video = { id: number; title: string; category: string; status: string; createdAt: string; screenshot?: string | null };

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  function login() {
    if (password === "87654321az") { setAuthenticated(true); setMessage(""); }
    else setMessage("Şifre hatalı.");
  }

  useEffect(() => {
    if (!authenticated) return;
    fetch("/api/admin/videos").then((r) => r.json()).then((data) => setVideos(data.videos || [])).catch(() => setMessage("Teyit kayıtları yüklenemedi."));
  }, [authenticated]);

  async function decide(id: number, status: "Onaylandı" | "Reddedildi") {
    setBusyId(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/videos/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error();
      setVideos((items) => items.map((item) => item.id === id ? { ...item, status } : item));
      setMessage(status === "Onaylandı" ? "Teyit onaylandı, kullanıcı bakiyesine 50 TL eklendi." : "Teyit kaydı reddedildi.");
    } catch {
      setMessage("İşlem tamamlanamadı. Lütfen tekrar dene.");
    } finally {
      setBusyId(null);
    }
  }

  return <main className="min-h-screen bg-[#f4f8fc] px-5 py-12 text-slate-950"><section className="mx-auto max-w-2xl"><a href="/" className="text-sm font-semibold text-[#1457d9]">← HaberKazanç’a dön</a><p className="mt-10 eyebrow">YÖNETİM ALANI</p><h1 className="mt-2 text-4xl font-black tracking-tight">Yönetim paneli</h1><p className="mt-3 text-slate-600">Video teyitleri, bakiye ve referans verilerini yönet.</p><section className="panel mt-8">{!authenticated ? <><h2>Yönetici girişi</h2><p className="mt-2 text-sm text-slate-600">Yönetim paneline erişmek için şifreni gir.</p><label className="mt-5 block text-sm font-semibold">Yönetim şifresi<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifre" /></label><button type="button" className="primary mt-4" onClick={login}>Panele giriş yap</button></> : <><h2>Yönetim araçları</h2><p className="mt-2 text-sm text-slate-600">Gönderilen ekran görüntüsünü inceleyip teyiti sonuçlandır.</p><div className="mt-5"><h3 className="text-base font-bold">Video teyitleri</h3>{videos.length ? <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">{videos.map((video) => <div key={video.id} className="px-4 py-4 text-sm"><strong className="block">{video.title}</strong><span className="text-slate-500">{video.category} · {video.status} · {new Date(video.createdAt).toLocaleDateString("tr-TR")}</span>{video.screenshot ? <a href={video.screenshot} target="_blank" rel="noreferrer"><img src={video.screenshot} alt="Gönderi teyit ekran görüntüsü" className="mt-3 max-h-64 rounded-xl border border-slate-200 object-contain" /></a> : <p className="mt-3 text-xs text-slate-500">Bu eski kayda ait ekran görüntüsü saklanmamış.</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={busyId === video.id || video.status === "Onaylandı"} className="approve px-3 py-2 text-xs disabled:opacity-50" onClick={() => decide(video.id, "Onaylandı")}>{busyId === video.id ? "İşleniyor…" : "Onayla +50 TL"}</button><button type="button" disabled={busyId === video.id || video.status === "Reddedildi"} className="reject px-3 py-2 text-xs disabled:opacity-50" onClick={() => decide(video.id, "Reddedildi")}>Reddet</button></div></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Henüz video teyiti yok.</p>}</div></>}{message && <p className="mt-4 text-sm font-semibold text-[#17663e]">{message}</p>}</section></section></main>;
}