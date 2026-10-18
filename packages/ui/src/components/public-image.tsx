import type { ReactElement } from "react";

export interface PublicImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * A picture of a public file the API has already resized (an offering photo, ADR-109). A plain image
 * keeps the Next image component, and its client code, out of the page (13-UX section 11); it loads
 * lazily so a long list does not fetch every photo at once.
 */
export function PublicImage({ src, alt, className }: PublicImageProps): ReactElement {
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
