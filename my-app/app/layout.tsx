import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: 'ENT 파일 병합 도구',
  description: '여러 개의 .ent 파일을 하나로 병합하는 도구입니다',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
