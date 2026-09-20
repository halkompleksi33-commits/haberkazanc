import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HaberKazanç | Haberini kazanca dönüştür",
  description: "Haber gönder, onaylandığında kazan ve bakiyeni takip et.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

