"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { ListingFormProps } from "./listing-form";

/** The steps form loads on demand: the signed-out and read-only pages never download it (M.6 C8). */
const ListingFormLazy = dynamic(async () => (await import("./listing-form")).ListingForm, {
  loading: () => <p className="text-body text-secondary">…</p>,
});

export function LazyListingForm(props: ListingFormProps): ReactElement {
  return <ListingFormLazy {...props} />;
}
