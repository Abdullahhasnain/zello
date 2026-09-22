import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zello AI — Ops Console",
  description: "Internal administration for the Zello AI platform.",
  robots: { index: false, follow: false },
};

// Renders without ClerkProvider until a publishable key is configured, so
// the app builds and previews before Clerk credentials exist — same
// pattern as apps/dashboard/src/app/layout.tsx.
const clerkConfigured = process.env.AUTH_PROVIDER !== "auth0" && Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  return clerkConfigured ? <ClerkProvider>{body}</ClerkProvider> : body;
}
