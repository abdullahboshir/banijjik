import type { Translator } from "@banijjik/i18n";
import { buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";

export interface CommissionPagerProps {
  page: number;
  previousHref: string | undefined;
  nextHref: string | undefined;
  t: Translator["t"];
}

/** Previous / next links of a commission list; nothing when there is only one page. */
export function CommissionPager(props: CommissionPagerProps): ReactElement | null {
  const { page, previousHref, nextHref, t } = props;
  if (previousHref === undefined && nextHref === undefined) return null;
  const linkClass = buttonVariants({ variant: "secondary" });
  return (
    <nav className="mt-4 flex items-center justify-between gap-3">
      {previousHref === undefined ? (
        <span />
      ) : (
        <Link href={previousHref} className={linkClass}>
          {t("commission.page.previous")}
        </Link>
      )}
      <span className="text-small text-secondary">{t("commission.page.current", { page })}</span>
      {nextHref === undefined ? (
        <span />
      ) : (
        <Link href={nextHref} className={linkClass}>
          {t("commission.page.next")}
        </Link>
      )}
    </nav>
  );
}
