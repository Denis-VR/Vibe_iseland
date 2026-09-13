import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тихая высота — горы, музыка и твой путь",
  description: "Личное пространство для концентрации с горными пейзажами, музыкой и картой изучения Go.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
