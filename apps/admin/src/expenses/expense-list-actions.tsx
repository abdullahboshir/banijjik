import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ExpenseCategoryResponse } from "@banijjik/contracts/accounting";
import type { CurrencyCode } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ExpenseFormButton } from "./expense-form-button";
import { formLabelsOf } from "./expense-list-labels";

export function ExpenseListActions(props: {
  access: OrgAccess;
  basePath: string;
  categories: ExpenseCategoryResponse[];
  locations: LocationResponse[];
  currency: CurrencyCode;
  t: Translator["t"];
}): ReactElement {
  const { access, basePath, t } = props;
  const canCreate =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.EXPENSE_EXPENSE_CREATE);
  const defaultLocationId = props.locations[0]?.locationId ?? "";
  return (
    <div className="flex flex-wrap gap-2">
      {holdsPermission(access.config.permissions, PERMISSION_KEY.EXPENSE_CATEGORY_UPDATE) ? (
        <Link href={`${basePath}/categories`} className={buttonVariants({ variant: "secondary" })}>
          {t("menu.expense.categories")}
        </Link>
      ) : null}
      {canCreate && defaultLocationId !== "" ? (
        <ExpenseFormButton
          label={t("expenses.add")}
          sheetProps={{
            organizationId: access.organization.organizationId,
            currency: props.currency,
            categories: props.categories.filter((category) => category.status === "ACTIVE"),
            locations: props.locations.map((location) => ({
              locationId: location.locationId,
              name: location.name,
            })),
            labels: formLabelsOf(t),
            defaultLocationId,
            defaultBusinessDate: new Date().toISOString().slice(0, 10),
          }}
        />
      ) : null}
    </div>
  );
}
