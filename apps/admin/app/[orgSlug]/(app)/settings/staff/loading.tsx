import { Skeleton } from "@banijjik/ui";
import type { ReactElement } from "react";

/** The skeleton of the staff screens (13-UX section 5): no spinner, the layout is already there. */
export default function StaffLoading(): ReactElement {
  return <Skeleton variant="row" count={6} />;
}
