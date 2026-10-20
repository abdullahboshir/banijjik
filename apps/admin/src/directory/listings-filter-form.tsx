import { LISTING_STATUS } from "@banijjik/contracts/directory";
import type { Translator } from "@banijjik/i18n";
import { TextInput, buttonVariants } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { DirectoryListingsQuery } from "./directory-query";

export function DirectoryListingsFilterForm(props: {
  query: DirectoryListingsQuery;
  t: Translator["t"];
}): ReactElement {
  const { query, t } = props;
  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-h-11 flex-col gap-1 text-small">
        <span className="font-semibold text-primary">{t("directory.filter.status")}</span>
        <select
          name="status"
          defaultValue={query.status ?? ""}
          className="min-h-11 rounded-sm border border-default bg-surface px-3 text-body"
        >
          <option value="">{t("directory.filter.statusAll")}</option>
          {Object.values(LISTING_STATUS).map((status) => (
            <option key={status} value={status}>
              {t(`directory.status.${status}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 flex-col gap-1 text-small sm:min-w-40">
        <span className="font-semibold text-primary">{t("directory.filter.listingNumber")}</span>
        <TextInput
          name="listingNumber"
          defaultValue={query.listingNumber ?? ""}
          autoComplete="off"
        />
      </label>
      <label className="flex min-h-11 flex-col gap-1 text-small">
        <span className="font-semibold text-primary">{t("directory.filter.from")}</span>
        <TextInput name="from" type="date" defaultValue={query.from ?? ""} />
      </label>
      <label className="flex min-h-11 flex-col gap-1 text-small">
        <span className="font-semibold text-primary">{t("directory.filter.to")}</span>
        <TextInput name="to" type="date" defaultValue={query.to ?? ""} />
      </label>
      <button type="submit" className={buttonVariants({ variant: "secondary" })}>
        {t("directory.filter.apply")}
      </button>
    </form>
  );
}
