"use client";
import type { CurrencyCode } from "@banijjik/contracts";
import { Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { CommissionPayFields } from "./commission-pay-fields";
import type { CommissionLocationOption } from "./commission-lookups";
import { useCommissionPayForm } from "./use-commission-pay-form";
export interface CommissionPayMemberOption {
  memberId: string;
  name: string;
}
export interface CommissionPaySheetProps {
  organizationId: string;
  currency: CurrencyCode;
  members: readonly CommissionPayMemberOption[];
  locations: readonly CommissionLocationOption[];
  defaultMemberId?: string | undefined;
  defaultUpTo: string;
  onClose: () => void;
}
export function CommissionPaySheet(props: CommissionPaySheetProps): ReactElement {
  const { t } = useTranslator();
  const state = useCommissionPayForm(props);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <SheetContent title={t("commission.pay.title")} closeLabel={t("commission.pay.close")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void state.confirm();
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <CommissionPayFields state={state} members={props.members} locations={props.locations} />
        </form>
      </SheetContent>
    </Sheet>
  );
}
