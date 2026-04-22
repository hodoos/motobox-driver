import "./globals.css";
import type { Metadata } from "next";
import SessionTimeout from "../components/auth/SessionTimeout";
import WebActivityTracker from "../components/auth/WebActivityTracker";

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
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">
        <SessionTimeout />
        <WebActivityTracker />
        {children}
      </body>
    </html>
  );
}