"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/** Wraps next-themes, which toggles a `dark` class on <html> — matching
 * tailwind.config.ts's `darkMode: "class"` and the token overrides in
 * globals.css's `.dark { ... }` block. `disableTransitionOnChange`
 * prevents the entire page fading between themes on toggle, which reads
 * as sluggish rather than premium. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
