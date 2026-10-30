"use client";

import { PublicImage } from "@banijjik/ui";
import type { ReactElement } from "react";

export function OfferingMediaBox({
  mediaUrl,
  title,
  kind,
}: {
  readonly mediaUrl: string | null;
  readonly title: string;
  readonly kind: string;
}): ReactElement {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg border border-default bg-subtle">
      {mediaUrl ? (
        <PublicImage src={mediaUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-secondary">{kind}</div>
      )}
    </div>
  );
}
