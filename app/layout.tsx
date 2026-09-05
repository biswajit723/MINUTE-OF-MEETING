import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AuthGate from "./auth-gate";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "MOM Meeting Hub",
  description: "Secure TBM and meeting point management.",
  applicationName: "MOM Meeting Hub",
  manifest: "/manifest.webmanifest",
  themeColor: "#06101d",
  viewport:
    "width=device-width, initial-scale=1, viewport-fit=cover",
  icons: {
    icon: "/mom-icon.svg",
    shortcut: "/mom-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "MOM Hub",
    statusBarStyle: "black-translucent",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}