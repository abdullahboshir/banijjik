"use client";

import { buttonVariants } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { ExpenseVoidDialog, type ExpenseVoidLabels } from "./expense-void-dialog";

export interface ExpenseVoidButtonProps {
  organizationId: string;
  expenseId: string;
  version: number;
  labels: ExpenseVoidLabels & { trigger: string };
}

/** Opens the void confirm dialog on tap; kept out of the server detail page. */
export function ExpenseVoidButton(props: ExpenseVoidButtonProps): ReactElement {
  const [open, setOpen] = useState(false);
  const { trigger, ...dialogLabels } = props.labels;
  return (
    <>
      <button
        type="button"
        className={`${buttonVariants({ variant: "danger" })} self-start`}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </button>
      {open ? (
        <ExpenseVoidDialog
          organizationId={props.organizationId}
          expenseId={props.expenseId}
          version={props.version}
          labels={dialogLabels}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
