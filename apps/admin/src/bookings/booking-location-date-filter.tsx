"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { Select, TextInput } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { bookingCalendarHref, type BookingCalendarQuery } from "./booking-query";

export function BookingLocationDateFilter(props: {
  basePath: string;
  query: BookingCalendarQuery;
  locations: readonly LocationResponse[];
  locationLabel: string;
  dateLabel: string;
}): ReactElement {
  const router = useRouter();
  const locationId = props.query.locationId ?? props.locations[0]?.locationId ?? "";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {props.locations.length > 0 ? (
        <label className="flex min-w-0 flex-col gap-1 sm:min-w-[12rem]">
          <span className="text-small text-secondary">{props.locationLabel}</span>
          <Select
            id="booking-location-filter"
            value={locationId}
            onChange={(event) => {
              router.push(
                bookingCalendarHref(props.basePath, {
                  ...props.query,
                  locationId: event.target.value,
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
      ) : null}
      <label className="flex min-w-0 flex-col gap-1 sm:min-w-[10rem]">
        <span className="text-small text-secondary">{props.dateLabel}</span>
        <TextInput
          id="booking-date-filter"
          type="date"
          value={props.query.date}
          onChange={(event) => {
            router.push(
              bookingCalendarHref(props.basePath, {
                ...props.query,
                date: event.target.value,
              }),
            );
          }}
        />
      </label>
    </div>
  );
}
