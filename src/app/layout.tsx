import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한끗 | 설명과 이해 사이",
  description:
    "금융상품 설명 뒤에 남은 이해의 차이를 AI로 찾고, 실제 결과로 확인하는 한끗 MVP",
  applicationName: "한끗",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f5ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
