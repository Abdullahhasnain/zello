import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {description ? <p className="max-w-sm text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
