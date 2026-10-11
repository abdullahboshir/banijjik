import type { StatusTone } from "@banijjik/ui";
import type { ReactElement } from "react";

/** Tinted text on the surface colour, the same tones as the ui StatusBadge (every tone meets AA on bg.surface). */
const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-success text-success",
  info: "border-info text-info",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
  neutral: "border-neutral text-neutral",
};

/**
 * A status badge for the platform's own states (organization, subscription, package). The ui StatusBadge
 * takes a request type and its tone table is pinned to docs/11 section 12, which has no rows for these.
 */
export function StatusPill({ tone, label }: { tone: StatusTone; label: string }): ReactElement {
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-caption font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
