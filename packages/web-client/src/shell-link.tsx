"use client";

import type { LinkProps } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

/**
 * Adapts Next's Link to the ui link contract. The contract spells out `| undefined` for optional props,
 * which Next's stricter prop types do not accept under exactOptionalPropertyTypes, so only the props
 * that are set are forwarded.
 */
export function ShellLink({ href, children, ...optionalProps }: LinkProps): ReactElement {
  const definedProps = Object.fromEntries(
    Object.entries(optionalProps).filter(([, value]) => value !== undefined),
  );
  return (
    <Link href={href} {...definedProps}>
      {children}
    </Link>
  );
}
