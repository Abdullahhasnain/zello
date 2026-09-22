import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-hover text-ink-soft",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-[color-mix(in_srgb,var(--color-success)_16%,transparent)] text-success",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-warning",
  danger: "bg-danger-soft text-danger",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Maps the backend's various status/reason strings to a Badge tone —
 * one shared mapping instead of every page re-deciding what "cancelled"
 * should look like. */
export function statusTone(status: string): Tone {
  const success = ["active", "succeeded", "fulfilled", "confirmed", "paid", "delivered"];
  const warning = ["pending", "pilot", "trialing", "draft", "processing"];
  const danger = ["out_of_stock", "cancelled", "failed", "refunded", "overdue", "suspended", "abandoned"];
  const accent = ["escalated"];

  if (success.includes(status)) return "success";
  if (warning.includes(status)) return "warning";
  if (danger.includes(status)) return "danger";
  if (accent.includes(status)) return "accent";
  return "neutral";
}
