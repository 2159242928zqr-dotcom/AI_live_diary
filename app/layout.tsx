import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "怪咖日记",
  description: "AI 语音日记本"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className="dark" lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
