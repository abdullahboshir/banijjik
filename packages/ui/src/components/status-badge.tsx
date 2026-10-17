import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { statusTone, type StatusRequestType, type StatusTone } from "../status/status-tone.js";

export interface StatusBadgeProps {
  requestType: StatusRequestType;
  status: string;
  label: string;
}

/** Tinted text on the surface colour: every tone meets AA on bg.surface (see color.test.ts). */
const TONE_CLASS: Record<StatusTone, string> = {
  success: "border-success text-success",
  info: "border-info text-info",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
  neutral: "border-neutral text-neutral",
};

export function StatusBadge({ requestType, status, label }: StatusBadgeProps): ReactElement {
  const tone = statusTone(requestType, status);
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex items-center rounded-full border bg-surface px-2.5 py-0.5 text-caption font-semibold",
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}
