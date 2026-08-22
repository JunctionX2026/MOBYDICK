import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppSidebar } from "./_components/app-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOBYDICK",
  description: "흩어진 공공데이터를 찾아서, 붙여서, 쓸 수 있는 형태로 내보내요.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex h-dvh overflow-hidden antialiased">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
