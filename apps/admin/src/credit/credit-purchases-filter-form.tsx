import { CREDIT_PURCHASE_STATUS } from "@banijjik/contracts/credit";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { CreditPurchaseLabels } from "./credit-purchase-labels";
import { ALL_STATUSES, type CreditPurchasesQuery } from "./credit-purchase-query";

export interface CreditPurchasesFilterFormProps {
  query: CreditPurchasesQuery;
  labels: CreditPurchaseLabels;
}

export function CreditPurchasesFilterForm(props: CreditPurchasesFilterFormProps): ReactElement {
  const { query, labels } = props;
  const currentStatus = query.status ?? ALL_STATUSES;

  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-lg border border-default p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex-1 min-w-48">
        <FormField label={labels.filter.status} htmlFor="filter-status">
          <Select id="filter-status" name="status" defaultValue={currentStatus}>
            <option value={ALL_STATUSES}>{labels.filter.statusAll}</option>
            <option value={CREDIT_PURCHASE_STATUS.PENDING}>
              {labels.status[CREDIT_PURCHASE_STATUS.PENDING]}
            </option>
            <option value={CREDIT_PURCHASE_STATUS.VERIFIED}>
              {labels.status[CREDIT_PURCHASE_STATUS.VERIFIED]}
            </option>
            <option value={CREDIT_PURCHASE_STATUS.REJECTED}>
              {labels.status[CREDIT_PURCHASE_STATUS.REJECTED]}
            </option>
            <option value={CREDIT_PURCHASE_STATUS.CANCELLED}>
              {labels.status[CREDIT_PURCHASE_STATUS.CANCELLED]}
            </option>
          </Select>
        </FormField>
      </div>

      <div className="flex-1 min-w-64">
        <FormField label={labels.filter.search} htmlFor="filter-q">
          <TextInput
            id="filter-q"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder={labels.filter.search}
            autoComplete="off"
          />
        </FormField>
      </div>

      <div>
        <Button type="submit" variant="secondary">
          {labels.filter.apply}
        </Button>
      </div>
    </form>
  );
}
