import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { QueryProvider } from "@/components/ui/query-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Zello AI — Store Dashboard",
    template: "%s · Zello AI",
  },
  description: "Manage your Zello AI conversational sales agent.",
};

// No publishable key configured yet (local preview before Clerk is wired
// up with real credentials) — render without ClerkProvider instead of
// crashing, so the app is still viewable. Set
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable auth.
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body">
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>{children}</ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );

  return clerkConfigured ? <ClerkProvider>{body}</ClerkProvider> : body;
}
