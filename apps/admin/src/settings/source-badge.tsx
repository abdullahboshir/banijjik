import type { ReactElement } from "react";

export type BadgeTone = "neutral" | "info" | "warning";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "border-neutral text-neutral",
  info: "border-info text-info",
  warning: "border-warning text-warning",
};

/** A small tinted label: where a value comes from, or a trait of a field. Colours match the status badges. */
export function SourceBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: BadgeTone;
}): ReactElement {
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-caption font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
