import type { Metadata } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansKR = Noto_Sans_KR({ subsets: ["latin"], variable: "--font-noto" });

export const metadata: Metadata = {
  title: "Songtext",
  description: "외국 가사를 한 줄씩 깊이 있게 해설해드립니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${notoSansKR.variable} h-full`}>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-inter), var(--font-noto), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
