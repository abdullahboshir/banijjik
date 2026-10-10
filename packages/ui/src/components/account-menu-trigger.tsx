import type { ReactElement } from "react";
import { Button } from "./button.js";

export interface AccountMenuTriggerProps {
  initials: string;
  label: string;
  onClick: () => void;
}

/**
 * The round button in the top bar that opens the account sheet. It lives apart from the sheet on purpose: apps
 * load the sheet (Radix dialog) on demand, and a shared module would pull it into the first page load.
 */
export function AccountMenuTrigger({
  initials,
  label,
  onClick,
}: AccountMenuTriggerProps): ReactElement {
  return (
    <Button
      variant="ghost"
      aria-label={label}
      aria-haspopup="dialog"
      className="rounded-full bg-subtle px-0"
      onClick={onClick}
    >
      <span aria-hidden="true">{initials}</span>
    </Button>
  );
}
