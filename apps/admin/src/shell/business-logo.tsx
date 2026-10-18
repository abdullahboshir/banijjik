import { LogoImage } from "@banijjik/ui";
import type { ReactElement } from "react";
import { API_BASE_URL } from "../config/api-base-url";

export interface BusinessLogoProps {
  /** The thumbnail path from `/me/orgs`, under the API origin. */
  logoUrl: string;
  alt: string;
}

/** The business's own logo in the top bar. */
export function BusinessLogo({ logoUrl, alt }: BusinessLogoProps): ReactElement {
  return (
    <LogoImage
      src={`${API_BASE_URL}${logoUrl}`}
      alt={alt}
      className="h-8 w-auto max-w-28 object-contain"
    />
  );
}
