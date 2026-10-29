"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { DomainWizardProps } from "./domain-wizard";

/** The wizard is a separate chunk so the route's first HTML stays within the 180 KiB budget. */
const DomainWizardLazy = dynamic(async () => (await import("./domain-wizard")).DomainWizard, {
  loading: () => <p className="text-small text-secondary">…</p>,
});

export function LazyDomainWizard(props: DomainWizardProps): ReactElement {
  return <DomainWizardLazy {...props} />;
}
