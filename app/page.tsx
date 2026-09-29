"use client";

import { useEffect, useState } from "react";

type ChatMessage = { id: number; senderRole: "user" | "admin"; body: string; createdAt: string };
type DashboardData = { balance: number; approvedCount: number; videos: { id: number; title: string; category: string; status: string; createdAt: string }[]; referralCode: string | null; referredBy: string | null; referralCount: number };

async function optimizeScreenshot(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Lütfen ekran görüntüsü seç.");
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source; });
    const longestSide = 1280;
    const scale = Math.min(1, longestSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob || blob.size > 700 * 1024) throw new Error("Ekran görüntüsü çok büyük. Lütfen daha küçük bir görsel seç.");
    return new File([blob], "teyit-ekran-goruntusu.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(source); }
}

export default function Home() {
  const [view, setView] = useState<"dashboard">("dashboard");
  const isAdminPath = typeof window !== "undefined" && window.location.pathname === "/admin";
  const [showForm, setShowForm] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [sent, setSent] = useState(false);
  const [user, setUser] = useState<{ name: string; picture?: string } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [presence, setPresence] = useState({ online: 0, visitors: 0 });
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [showPayout, setShowPayout] = useState(false);
  const [payoutName, setPayoutName] = useState("");
  const [payoutIban, setPayoutIban] = useState("");
  const referralCodeFromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref")?.trim() : null;
  const [manualReferralCode, setManualReferralCode] = useState(referralCodeFromUrl || "");
  const referralCodeForLogin = manualReferralCode.trim();
  const googleLoginUrl = /^[A-Za-z0-9_-]{8,64}$/.test(referralCodeForLogin)
    ? `https://haberkazanc.halkompleksi33.workers.dev/api/auth/google?ref=${encodeURIComponent(referralCodeForLogin)}`
    : "https://haberkazanc.halkompleksi33.workers.dev/api/auth/google";
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((currentUser) => {
      setUser(currentUser);
      if (currentUser) { setPayoutName(currentUser.name || ""); fetch("/api/dashboard").then((response) => response.ok ? response.json() : null).then(setDashboard).catch(() => setDashboard(null)); } else setDashboard(null);
    }).catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    fetch("/api/messages", { credentials: "include" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setMessages(data.messages || []); }).catch(() => undefined);
  }, [user]);
  useEffect(() => {
    let visitorId = localStorage.getItem("hk_visitor_id");
    if (!visitorId) { visitorId = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem("hk_visitor_id", visitorId); }
    const ping = () => fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitorId }) }).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setPresence(data); }).catch(() => undefined);
    ping();
    const timer = window.setInterval(ping, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const body = chatText.trim(); if (!body) return; const response = await fetch("/api/messages", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) }); const data = await response.json().catch(() => null); if (response.ok && data?.message) { setMessages((items) => [...items, data.message]); setChatText(""); } else alert("Mesaj gönderilemedi. Lütfen yeniden giriş yapıp tekrar dene."); };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const screenshot = form.get("screenshot");
      if (!(screenshot instanceof File)) throw new Error("Lütfen ekran görüntüsü seç.");
      form.set("screenshot", await optimizeScreenshot(screenshot));
      const response = await fetch("/api/videos", { method: "POST", credentials: "include", body: form });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { setSent(true); setShowForm(false); }
      else if (response.status === 401) alert("Oturumun sona ermiş. Lütfen Google ile yeniden giriş yap.");
      else alert(data.error || "Teyit kaydı gönderilemedi. Lütfen tekrar dene.");
    } catch (error) { alert(error instanceof Error ? error.message : "Teyit kaydı gönderilemedi."); }