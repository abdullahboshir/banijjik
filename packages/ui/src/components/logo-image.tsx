import type { ReactElement } from "react";
import { PublicImage } from "./public-image.js";

export interface LogoImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** A business logo: a public image that loads at once, because it sits in the first screen. */
export function LogoImage({ src, alt, className }: LogoImageProps): ReactElement {
  return <PublicImage src={src} alt={alt} loading="eager" {...(className ? { className } : {})} />;
}
