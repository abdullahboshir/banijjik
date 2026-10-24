"use client";

import { buttonVariants } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";

export interface CommissionMenuLinkProps {
  href: string;
}

/** "My commission" in the account menu: a full page load, like switching business (ADR-022). */
export function CommissionMenuLink(props: CommissionMenuLinkProps): ReactElement {
  const { t } = useTranslator();
  return (
    <a href={props.href} className={`${buttonVariants({ variant: "secondary" })} w-full`}>
      {t("account.commission")}
    </a>
  );
}
