"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import type { FormEvent, ReactElement, ReactNode } from "react";
import type { FormFailure } from "./api-failure";

export interface FormSheetProps {
  title: string;
  description?: string;
  submitLabel: string;
  isSubmitting: boolean;
  failure: FormFailure | undefined;
  /** Whether the submit button uses the danger look (suspend). */
  isDanger?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** A sheet (a dialog on desktop) holding one form: fields, the refusal of the API, then the submit button. */
export function FormSheet(props: FormSheetProps): ReactElement {
  const { t } = useTranslator();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    props.onSubmit();
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={props.title}
        description={props.description}
        closeLabel={t("shell.closeMenu")}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {props.children}
          {props.failure ? (
            <p role="alert" className="text-small text-danger">
              {t(props.failure.messageKey, props.failure.values)}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={props.onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={props.isDanger ? "danger" : "primary"}
              isLoading={props.isSubmitting}
            >
              {props.submitLabel}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
