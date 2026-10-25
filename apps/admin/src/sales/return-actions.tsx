"use client";

import type { PaymentMethod } from "@banijjik/contracts/payment";
import { SALES_RETURN_STATUS, type SalesReturnResponse } from "@banijjik/contracts/sales";
import { Button, PageSection } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { OrderApprovalLabels } from "./order-labels";
import { LazyReturnReverseSheet } from "./lazy-return-reverse-sheet";
import type { ReturnLabels } from "./return-labels";

export interface ReturnActionsProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly salesReturn: SalesReturnResponse;
  readonly canReverse: boolean;
  /** Set for an exchange return, which the reverse screen does not reverse (plan R2). */
  readonly exchangeNote: string | undefined;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly methodLabels: Readonly<Record<string, string>>;
  readonly labels: ReturnLabels;
  readonly approvalLabels: OrderApprovalLabels;
}

/** The reverse action of an active, non-exchange return, for a user who holds `sales.return.reverse`. */
export function ReturnActions(props: ReturnActionsProps): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const isReversible =
    props.canReverse &&
    props.salesReturn.status === SALES_RETURN_STATUS.ACTIVE &&
    props.salesReturn.exchangeOrderId === null;
  if (props.exchangeNote !== undefined) {
    return <p className="text-body text-secondary">{props.exchangeNote}</p>;
  }
  if (!isReversible) return null;
  return (
    <PageSection title={props.labels.reverse.open}>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        {props.labels.reverse.open}
      </Button>
      {isOpen ? (
        <LazyReturnReverseSheet
          open
          onOpenChange={setIsOpen}
          orgSlug={props.orgSlug}
          organizationId={props.organizationId}
          salesReturn={props.salesReturn}
          allowedMethods={props.allowedMethods}
          methodLabels={props.methodLabels}
          labels={props.labels}
          approvalLabels={props.approvalLabels}
        />
      ) : null}
    </PageSection>
  );
}
