import type { ReactElement } from "react";

export interface LogoImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * A business logo. It is a public file the API has already resized (ADR-109), so a plain image is enough;
 * the Next image component would add its client code to every page that draws the shell (13-UX section 11).
 */
export function LogoImage({ src, alt, className }: LogoImageProps): ReactElement {
  return <img src={src} alt={alt} className={className} />;
}
