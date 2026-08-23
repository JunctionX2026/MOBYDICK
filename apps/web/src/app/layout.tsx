import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RelayProvider } from "@/relay/relay-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Swish",
    template: "%s · Swish",
  },
  description: "흩어진 공공데이터를 찾아서, 붙여서, 쓸 수 있는 형태로 내보내요.",
  icons: {
    icon: [
      { sizes: "16x16", type: "image/svg+xml", url: "/brand/swish-favicon-16.svg" },
      { sizes: "32x32", type: "image/svg+xml", url: "/brand/swish-favicon-32.svg" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-bg-layer-default text-fg-neutral min-h-dvh antialiased">
        <RelayProvider>{children}</RelayProvider>
      </body>
    </html>
  );
}
