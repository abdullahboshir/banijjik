import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface FormFooterProps {
  formError: string | undefined;
  isSubmitting: boolean;
  submitLabel: string;
}

/** The message under the form (when the whole attempt failed) and the submit button. */
export function FormFooter({
  formError,
  isSubmitting,
  submitLabel,
}: FormFooterProps): ReactElement {
  return (
    <>
      {formError ? (
        <p role="alert" className="text-small text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </>
  );
}
