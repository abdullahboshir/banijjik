import Image from "next/image";
import type { ReactElement } from "react";
import { API_BASE_URL } from "../config/api-base-url";

const LOGO_WIDTH = 112;
const LOGO_HEIGHT = 32;

export interface BusinessLogoProps {
  /** The thumbnail path from `/me/orgs`, under the API origin. */
  logoUrl: string;
  alt: string;
}

/** The business's own logo in the top bar. A plain image: the address is a public file of the API (ADR-109). */
export function BusinessLogo({ logoUrl, alt }: BusinessLogoProps): ReactElement {
  return (
    <Image
      src={`${API_BASE_URL}${logoUrl}`}
      alt={alt}
      width={LOGO_WIDTH}
      height={LOGO_HEIGHT}
      unoptimized
      className="h-8 w-auto max-w-28 object-contain"
    />
  );
}
