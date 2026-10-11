import Link from "next/link";
import type { ReactElement } from "react";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

export interface FilterChipLink {
  chipKey: string;
  label: string;
  href: string;
  isActive: boolean;
}

/** Chips for the few most used filter values; each is a link, so the filter lives in the URL. */
export function FilterChips({
  chips,
  navLabel,
}: {
  chips: FilterChipLink[];
  navLabel: string;
}): ReactElement {
  return (
    <nav aria-label={navLabel} className="flex items-center gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <Link
          key={chip.chipKey}
          href={chip.href}
          aria-current={chip.isActive ? "true" : undefined}
          className={`${CHIP_CLASS} ${chip.isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
