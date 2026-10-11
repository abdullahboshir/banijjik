import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

export interface ListPagerProps {
  page: number;
  hasNext: boolean;
  previousHref: string;
  nextHref: string;
  labels: { previous: string; next: string; current: string };
}

/** Previous, the current page number, next. The API answers `hasNext` and no total, so no page list is possible. */
export function ListPager({
  page,
  hasNext,
  previousHref,
  nextHref,
  labels,
}: ListPagerProps): ReactElement | null {
  if (page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={previousHref} className={linkClass}>
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">{labels.current}</span>
      {hasNext ? (
        <Link href={nextHref} className={linkClass}>
          {labels.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
