import type { ReactNode } from "react";
import { Card } from "./card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  trend,
  trendTone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  trendTone?: "positive" | "negative" | "neutral";
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
        {icon ? <span className="text-accent">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            trendTone === "positive" && "text-success",
            trendTone === "negative" && "text-danger",
            trendTone === "neutral" && "text-ink-faint",
          )}
        >
          {trend}
        </p>
      ) : null}
    </Card>
  );
}
