import type { ReactElement } from "react";
import { cn } from "../lib/cn.js";

export interface SkeletonProps {
  /** `title` and `section` mirror PageLayout and PageSection; the others fill a list. */
  variant: "line" | "card" | "row" | "title" | "section";
  count?: number;
}

const VARIANT_CLASS = {
  line: "h-4 w-full rounded-sm",
  card: "h-24 w-full rounded-md",
  row: "h-12 w-full rounded-sm",
  title: "h-8 w-2/3 rounded-sm md:h-10 md:w-1/3",
  section: "h-32 w-full rounded-md",
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
