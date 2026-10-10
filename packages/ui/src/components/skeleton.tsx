import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";

export interface SkeletonProps {
  variant: "line" | "card" | "row";
  count?: number;
}

const VARIANT_CLASS = {
  line: "h-4 w-full rounded-sm",
  card: "h-24 w-full rounded-md",
  row: "h-12 w-full rounded-sm",
} as const;

export function Skeleton({ variant, count = 1 }: SkeletonProps): ReactElement {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={cn("animate-pulse bg-subtle", VARIANT_CLASS[variant])} />
      ))}
    </div>
  );
}
