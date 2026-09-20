"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function reset() {
    const response = await fetch("/api/admin/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    setMessage(response.ok ? "Yönetim verileri sıfırlandı." : "Şifre hatalı.");
  }
  return <main className="min-h-screen bg-[#f4f8fc] px-5 py-12 text-slate-950"><section className="mx-auto max-w-2xl"><a href="/" className="text-sm font-semibold text-[#1457d9]">← HaberKazanç’a dön</a><p className="mt-10 eyebrow">YÖNETİM ALANI</p><h1 className="mt-2 text-4xl font-black tracking-tight">Yönetim paneli</h1><p className="mt-3 text-slate-600">Video teyitleri, bakiye ve referans verilerini yönet.</p><section className="panel mt-8"><h2>Verileri sıfırla</h2><p className="mt-2 text-sm text-slate-600">Bu işlem video teyitlerini, kullanıcı bakiyelerini ve referans kayıtlarını kalıcı olarak temizler.</p><label className="mt-5 block text-sm font-semibold">Yönetim şifresi<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifre" /></label><button type="button" className="reject mt-4" onClick={reset}>Tüm yönetim verilerini sıfırla</button>{message && <p className="mt-4 text-sm font-semibold text-[#17663e]">{message}</p>}</section></section></main>;
}