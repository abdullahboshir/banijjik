"use client";

import { useEffect, useState, type ComponentType, type ReactElement } from "react";
import type { CommissionMenuLinkProps } from "./commission-menu-link";

type LinkComponent = ComponentType<CommissionMenuLinkProps>;

/** The link only renders inside the open account menu, so its code stays out of the route's first load. */
export function LazyCommissionMenuLink(props: CommissionMenuLinkProps): ReactElement | null {
  const [Link, setLink] = useState<LinkComponent | null>(null);

  useEffect(() => {
    if (Link) return;
    async function loadLink(): Promise<void> {
      const linkModule = await import("./commission-menu-link");
      setLink(() => linkModule.CommissionMenuLink);
    }
    void loadLink();
  }, [Link]);

  return Link ? <Link {...props} /> : null;
}
