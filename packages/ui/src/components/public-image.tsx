import type { ReactElement } from "react";

export interface PublicImageProps {
  src: string;
  alt: string;
  className?: string;
  /** A list of photos loads lazily (the default); a logo in the top bar must not. */
  loading?: "lazy" | "eager";
}

/**
 * A picture of a public file the API has already resized (a logo or an offering photo, ADR-109). A
 * plain image keeps the Next image component, and its client code, out of the page (13-UX section 11).
 */
export function PublicImage({
  src,
  alt,
  className,
  loading = "lazy",
}: PublicImageProps): ReactElement {
  return <img src={src} alt={alt} className={className} loading={loading} />;
}
