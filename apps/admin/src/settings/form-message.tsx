"use client";

import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { FormFailure } from "./form-failure";

/** The refusal that belongs to no field, from the message key the API sent. */
export function FormMessage({ failure }: { failure: FormFailure }): ReactElement | null {
  const { t } = useTranslator();
  const { formMessage } = failure;
  if (!formMessage) return null;
  return (
    <p role="alert" className="text-small text-danger">
      {t(formMessage.messageKey, formMessage.values)}
    </p>
  );
}
