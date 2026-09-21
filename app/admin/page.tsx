"use client";

import { useEffect, useState } from "react";

type Video = { id: number; title: string; category: string; status: string; createdAt: string; screenshot?: string | null };
type Contributor = { id: string; name: string; email: string; balance: number; createdAt: string };
type Thread = { userId: string; name: string | null; email: string | null; lastMessage: string; createdAt: string };

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  function login() {
    if (password === "87654321az") { setAuthenticated(true); setMessage(""); }
    else setMessage("Şifre hatalı.");
  }

  useEffect(() => {
    if (!authenticated) return;
    Promise.all([fetch("/api/admin/videos").then((r) => r.json()), fetch("/api/admin/contributors").then((r) => r.json()), fetch("/api/admin/messages").then((r) => r.json())]).then(([videoData, contributorData, messageData]) => { setVideos(videoData.videos || []); setContributors(contributorData.contributors || []); setThreads(messageData.threads || []); }).catch(() => setMessage("Yönetim verileri yüklenemedi."));
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

  async function replyTo(userId: string) { const body = reply[userId]?.trim(); if (!body) return; const response = await fetch("/api/admin/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, body }) }); if (response.ok) { setReply((items) => ({ ...items, [userId]: "" })); setMessage("Yanıt kullanıcıya gönderildi."); } else setMessage("Mesaj gönderilemedi."); }

  return <main className="min-h-screen bg-[#f4f8fc] px-5 py-12 text-slate-950"><section className="mx-auto max-w-2xl"><a href="/" className="text-sm font-semibold text-[#1457d9]">← HaberKazanç’a dön</a><p className="mt-10 eyebrow">YÖNETİM ALANI</p><h1 className="mt-2 text-4xl font-black tracking-tight">Yönetim paneli</h1><p className="mt-3 text-slate-600">Video teyitleri, bakiye ve referans verilerini yönet.</p><section className="panel mt-8">{!authenticated ? <><h2>Yönetici girişi</h2><p className="mt-2 text-sm text-slate-600">Yönetim paneline erişmek için şifreni gir.</p><label className="mt-5 block text-sm font-semibold">Yönetim şifresi<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifre" /></label><button type="button" className="primary mt-4" onClick={login}>Panele giriş yap</button></> : <><h2>Yönetim araçları</h2><p className="mt-2 text-sm text-slate-600">Gönderilen ekran görüntüsünü inceleyip teyiti sonuçlandır.</p><div className="mt-5"><h3 className="text-base font-bold">Özel mesajlar <span className="text-slate-400">({threads.length})</span></h3>{threads.length ? <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">{threads.map((thread) => <div className="px-4 py-4 text-sm" key={thread.userId}><strong>{thread.name || "Kullanıcı"}</strong><span className="ml-2 text-xs text-slate-500">{thread.email}</span><p className="mt-2 text-slate-600">{thread.lastMessage}</p><div className="mt-3 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" value={reply[thread.userId] || ""} onChange={(event) => setReply((items) => ({ ...items, [thread.userId]: event.target.value }))} placeholder="Yanıt yaz..." /><button type="button" className="approve px-3" onClick={() => replyTo(thread.userId)}>Gönder</button></div></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Henüz özel mesaj yok.</p>}</div><div className="mt-7"><h3 className="text-base font-bold">Google ile giriş yapanlar <span className="text-slate-400">({contributors.length})</span></h3>{contributors.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-semibold">Kullanıcı</th><th className="px-4 py-3 font-semibold">E-posta</th><th className="px-4 py-3 font-semibold">Bakiye</th><th className="px-4 py-3 font-semibold">Giriş tarihi</th></tr></thead><tbody className="divide-y divide-slate-100">{contributors.map((contributor) => <tr key={contributor.id}><td className="px-4 py-3 font-semibold">{contributor.name}</td><td className="px-4 py-3 text-slate-600">{contributor.email}</td><td className="px-4 py-3 font-semibold text-[#17663e]">{contributor.balance} TL</td><td className="px-4 py-3 text-slate-500">{new Date(contributor.createdAt).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-slate-500">Henüz Google ile giriş yapan kullanıcı yok.</p>}</div><div className="mt-7"><h3 className="text-base font-bold">Video teyitleri</h3>{videos.length ? <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">{videos.map((video) => <div key={video.id} className="px-4 py-4 text-sm"><strong className="block">{video.title}</strong><span className="text-slate-500">{video.category} · {video.status} · {new Date(video.createdAt).toLocaleDateString("tr-TR")}</span>{video.screenshot ? <a href={video.screenshot} target="_blank" rel="noreferrer"><img src={video.screenshot} alt="Gönderi teyit ekran görüntüsü" className="mt-3 max-h-64 rounded-xl border border-slate-200 object-contain" /></a> : <p className="mt-3 text-xs text-slate-500">Bu eski kayda ait ekran görüntüsü saklanmamış.</p>}<div className="mt-3 flex gap-2"><button type="button" disabled={busyId === video.id || video.status === "Onaylandı"} className="approve px-3 py-2 text-xs disabled:opacity-50" onClick={() => decide(video.id, "Onaylandı")}>{busyId === video.id ? "İşleniyor…" : "Onayla +50 TL"}</button><button type="button" disabled={busyId === video.id || video.status === "Reddedildi"} className="reject px-3 py-2 text-xs disabled:opacity-50" onClick={() => decide(video.id, "Reddedildi")}>Reddet</button></div></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Henüz video teyiti yok.</p>}</div></>}{message && <p className="mt-4 text-sm font-semibold text-[#17663e]">{message}</p>}</section></section></main>;
}