import { Skeleton } from "@banijjik/ui";
import type { ReactElement } from "react";

/** The skeleton of the staff screens (13-UX section 5): no spinner, the title and the rows are already where they will be. */
export default function StaffLoading(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="title" />
      <Skeleton variant="row" count={6} />
    </div>
  );
}
