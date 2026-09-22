"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Built on the native <dialog> element rather than a hand-rolled portal +
 * focus-trap: the browser already gives us modal focus trapping, Escape-
 * to-close, and a ::backdrop for free — see MDN's <dialog> docs. This is
 * the "don't reach for a library when the platform already does it"
 * version of a modal. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        "w-full max-w-lg rounded-card border border-border bg-surface p-0 text-ink shadow-card backdrop:bg-ink/40",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-ink-faint hover:bg-surface-hover hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
