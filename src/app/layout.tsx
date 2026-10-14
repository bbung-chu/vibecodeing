import type { Metadata } from "next";
import "./globals.css";
import { HydrationMarker } from "@/components/HydrationMarker";

export const metadata: Metadata = {
  title: "강의 정리",
  description: "대학생을 위한 강의 정리 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}
