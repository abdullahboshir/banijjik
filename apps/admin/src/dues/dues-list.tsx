import type { ReactElement } from "react";
import type { DueItemResponse } from "@banijjik/contracts/payment";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, formatMoney, type DisplayLocale } from "@banijjik/ui";
import Link from "next/link";

export function DuesList(props: {
  items: readonly DueItemResponse[];
  orgSlug: string;
  locale: DisplayLocale;
  t: Translator["t"];
}): ReactElement {
  const { t } = props;
  if (props.items.length === 0) return <EmptyState kind="noResults" message={t("dues.empty")} />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {props.items.map((item) => (
        <li
          key={`${item.requestType}-${item.requestId}`}
          className="min-w-0 rounded-lg border border-default p-4"
        >
          <h2 className="break-words font-semibold">{t(`dues.type.${item.requestType}`)}</h2>
          <p className="break-all text-small text-secondary">{item.requestId}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <dt>{t("dues.total")}</dt>
            <dd>{formatMoney(item.total, { locale: props.locale })}</dd>
            <dt>{t("dues.due")}</dt>
            <dd>{formatMoney(item.due, { locale: props.locale })}</dd>
            <dt>{t("dues.status")}</dt>
            <dd>{t(`dues.status.${item.paymentStatus}`)}</dd>
          </dl>
          {item.contactId ? (
            <Link
              className="inline-flex min-h-11 items-center text-brand underline"
              href={`/${props.orgSlug}/contacts/${item.contactId}`}
            >
              {t("dues.contact")}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
