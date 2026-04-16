import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Driver Report",
  description: "기사 업무 리포트 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}