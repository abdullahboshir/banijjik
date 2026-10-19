"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { Select } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { stockListHref, type StockQuery } from "./stock-query";

export function StockLocationFilter(props: {
  basePath: string;
  query: StockQuery;
  locations: readonly LocationResponse[];
  label: string;
}): ReactElement {
  const router = useRouter();
  const value = props.query.locationId ?? props.locations[0]?.locationId ?? "";
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-small text-secondary">{props.label}</span>
      <Select
        id="stock-location-filter"
        value={value}
        onChange={(event) => {
          router.push(
            stockListHref(props.basePath, {
              ...props.query,
              locationId: event.target.value,
              page: 1,
            }),
          );
        }}
      >
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
