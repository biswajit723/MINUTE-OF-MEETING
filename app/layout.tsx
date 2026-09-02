import type {
  Metadata,
} from "next";

import type {
  ReactNode,
} from "react";

import "./globals.css";
import AuthGate from "./auth-gate";

export const metadata: Metadata = {
  title: "MOM Meeting Hub",
  description:
    "Secure TBM and meeting point management.",
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
        <AuthGate>
          {children}
        </AuthGate>
      </body>
    </html>
  );
}