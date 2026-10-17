import type { ReactElement } from "react";

export type EmptyStateKind = "none" | "noResults" | "noPermission";

const SVG_PROPS = {
  viewBox: "0 0 96 96",
  width: 96,
  height: 96,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

/** A tray with nothing in it: the list has no items yet. */
function NoItemsArt(): ReactElement {
  return (
    <svg {...SVG_PROPS}>
      <path d="M16 56 28 28h40l12 28" />
      <path d="M16 56v14a4 4 0 0 0 4 4h56a4 4 0 0 0 4-4V56H60a12 12 0 0 1-24 0H16Z" />
      <path d="M40 16v-4M56 16v-4M48 18v-6" />
    </svg>
  );
}

/** A magnifying glass over empty space: the search or filter found nothing. */
function NoResultsArt(): ReactElement {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="42" cy="42" r="22" />
      <path d="m58 58 20 20" />
      <path d="M34 42h16" />
    </svg>
  );
}

/** A padlock: the person may not see this. */
function NoPermissionArt(): ReactElement {
  return (
    <svg {...SVG_PROPS}>
      <rect x="22" y="42" width="52" height="38" rx="6" />
      <path d="M34 42V32a14 14 0 0 1 28 0v10" />
      <path d="M48 56v10" />
    </svg>
  );
}

const ART_BY_KIND: Record<EmptyStateKind, () => ReactElement> = {
  none: NoItemsArt,
  noResults: NoResultsArt,
  noPermission: NoPermissionArt,
};

/** Inline line art, no image files and no external URLs (ADR-112). It is decoration, so it is hidden from screen readers. */
export function EmptyIllustration({ kind }: { kind: EmptyStateKind }): ReactElement {
  const Art = ART_BY_KIND[kind];
  return (
    <span className="text-muted">
      <Art />
    </span>
  );
}
