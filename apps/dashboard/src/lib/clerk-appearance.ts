/** Maps Clerk's themable elements onto this app's own CSS variable tokens,
 * so sign-in/sign-up render in the product's design system instead of
 * Clerk's default look, and repaint automatically on dark/light toggle.
 * Typed structurally against Clerk's `appearance` prop at the call site,
 * rather than importing `@clerk/types` directly (not a direct dependency). */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-accent)",
    colorText: "var(--color-ink)",
    colorTextSecondary: "var(--color-ink-soft)",
    colorBackground: "var(--color-surface)",
    colorInputBackground: "var(--color-bg)",
    colorInputText: "var(--color-ink)",
    colorDanger: "var(--color-danger)",
    colorSuccess: "var(--color-success)",
    borderRadius: "10px",
    fontFamily: "var(--font-body)",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full bg-transparent shadow-none border-0 p-0",
    header: "hidden",
    footer: "mt-4",
    footerActionText: "text-ink-soft",
    footerActionLink: "text-accent hover:text-accent-ink",
    formButtonPrimary:
      "bg-accent text-white hover:opacity-90 text-sm font-medium normal-case shadow-none",
    formFieldInput:
      "bg-bg border border-border text-ink rounded-[10px] focus:border-accent focus:ring-1 focus:ring-accent",
    formFieldLabel: "text-ink-soft text-sm",
    dividerLine: "bg-border",
    dividerText: "text-ink-faint",
    socialButtonsBlockButton: "border border-border text-ink hover:bg-surface-hover",
    identityPreview: "bg-bg border border-border",
    formFieldAction: "text-accent hover:text-accent-ink",
    otpCodeFieldInput: "border-border text-ink",
  },
};
