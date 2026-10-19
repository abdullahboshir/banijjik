import type { ExpenseCategoryResponse, ExpenseResponse } from "@banijjik/contracts/accounting";
import type { LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { PageSection } from "@banijjik/ui";
import type { ReactElement } from "react";
import { ExpenseAttachmentLinks } from "./expense-attachment-links";
import { localizedNameOf, paidViaLabelOf } from "./expense-labels";

function Fact(props: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{props.label}</dt>
      <dd className="break-words text-body text-primary">{props.children}</dd>
    </div>
  );
}

export function ExpenseDetailFacts(props: {
  expense: ExpenseResponse;
  category: ExpenseCategoryResponse | undefined;
  location: LocationResponse | undefined;
  organizationId: string;
  t: Translator["t"];
  locale: Translator["locale"];
}): ReactElement {
  const { expense, t } = props;
  return (
    <>
      <dl className="grid gap-4 md:grid-cols-2">
        <Fact label={t("expenses.column.category")}>
          {props.category
            ? localizedNameOf(props.category.name, props.locale)
            : expense.expenseCategoryId}
        </Fact>
        <Fact label={t("expenses.column.paidVia")}>{paidViaLabelOf(expense.paidVia, t)}</Fact>
        <Fact label={t("expenses.column.date")}>{expense.businessDate}</Fact>
        <Fact label={t("expenses.detail.location")}>
          {props.location?.name ?? expense.locationId}
        </Fact>
      </dl>
      {expense.note ? (
        <PageSection title={t("expenses.detail.note")}>
          <p className="whitespace-pre-wrap text-body text-primary">{expense.note}</p>
        </PageSection>
      ) : null}
      {expense.attachmentFileIds.length > 0 ? (
        <PageSection title={t("expenses.detail.attachments")}>
          <ExpenseAttachmentLinks
            organizationId={props.organizationId}
            fileIds={expense.attachmentFileIds}
            label={t("expenses.detail.attachment")}
          />
        </PageSection>
      ) : null}
    </>
  );
}
