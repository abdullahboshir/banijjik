import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { posDevicesHref, type PosDevicesQuery } from "./pos-devices-query";
import type { PosDeviceLocationOption } from "./pos-device-add-sheet";
import type { PosDevicesFilterLabels } from "./pos-devices-labels";

const CHIP_CLASS =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small transition-colors";

/** The location filter of the page: one chip per location the caller may use, and "all". */
export function PosDevicesLocationChips(props: {
  basePath: string;
  locations: readonly PosDeviceLocationOption[];
  selectedLocationId: string | undefined;
  labels: PosDevicesFilterLabels;
}): ReactElement {
  const { basePath, locations, selectedLocationId, labels } = props;
  const chips = [
    { key: "all", label: labels.all, locationId: undefined },
    ...locations.map((location) => ({
      key: location.locationId,
      label: location.name,
      locationId: location.locationId,
    })),
  ];
  return (
    <nav aria-label={labels.label} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const isActive = chip.locationId === selectedLocationId;
        const href = posDevicesHref(basePath, { locationId: chip.locationId, page: 1 });
        return (
          <Link
            key={chip.key}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={`${CHIP_CLASS} ${isActive ? "border-brand bg-brand text-on-brand" : "border-default bg-subtle text-primary"}`}
          >
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Previous and next page of the devices list; the page number is kept in the URL. */
export function PosDevicesPager(props: {
  basePath: string;
  query: PosDevicesQuery;
  hasNext: boolean;
  labels: PosDevicesFilterLabels;
  pageText: string;
}): ReactElement | null {
  const { basePath, query, hasNext, labels, pageText } = props;
  if (query.page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={posDevicesHref(basePath, { ...query, page: query.page - 1 })}
          className={linkClass}
        >
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">{pageText}</span>
      {hasNext ? (
        <Link
          href={posDevicesHref(basePath, { ...query, page: query.page + 1 })}
          className={linkClass}
        >
          {labels.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
