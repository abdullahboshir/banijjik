import type { Translator } from "@banijjik/i18n";
import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { expenseListHref, type ExpenseQuery } from "./expense-query";

export function ExpenseListPager(props: {
  basePath: string;
  query: ExpenseQuery;
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement | null {
  const { basePath, query, hasNext, t } = props;
  if (query.page === 1 && !hasNext) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {query.page > 1 ? (
        <Link
          href={expenseListHref(basePath, { ...query, page: query.page - 1 })}
          className={linkClass}
        >
          {t("expenses.page.previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-small text-secondary">
        {t("expenses.page.current", { page: query.page })}
      </span>
      {hasNext ? (
        <Link
          href={expenseListHref(basePath, { ...query, page: query.page + 1 })}
          className={linkClass}
        >
          {t("expenses.page.next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
