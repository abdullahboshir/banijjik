import type { ReactElement } from "react";
import { env } from "../config/env";

/** The product name from the environment (ADR-038); there is no logo image yet. */
export function BrandLogo(): ReactElement {
  return <span className="text-title font-semibold text-brand">{env.NEXT_PUBLIC_BRAND_NAME}</span>;
}
