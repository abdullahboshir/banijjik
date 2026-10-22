import type { AccountResponse } from "@banijjik/contracts/accounting";
import type { LocationOption } from "./entry-form-view";
import { AccountSelect } from "./account-select";
import { JOURNAL_SOURCE_TYPE } from "@banijjik/contracts/accounting";
import { Button, FormField, Select, TextInput, buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { JOURNAL_SOURCE_LABEL } from "./labels";
import type { BookkeepingLabels } from "./entry-form-view";
export function BookkeepingFilters(props: {
  organizationId: string;
  labels: BookkeepingLabels;
  query: URLSearchParams;
  journal?: boolean;
  accounts?: readonly AccountResponse[];
  locations?: readonly LocationOption[];
  locale?: "bn" | "en";
}): ReactElement {
  const labels = props.labels;
  return (
    <form method="get" className="grid gap-3 print:hidden sm:grid-cols-3">
      {(["from", "to"] as const).map((key) => (
        <FormField key={key} label={labels[key] ?? ""} htmlFor={`filter-${key}`}>
          <TextInput
            id={`filter-${key}`}
            name={key}
            type="date"
            defaultValue={props.query.get(key) ?? ""}
          />
        </FormField>
      ))}
      {props.journal === true && (
        <>
          <FormField label={labels["source"]} htmlFor="filter-source">
            <Select
              id="filter-source"
              name="sourceType"
              defaultValue={props.query.get("sourceType") ?? ""}
            >
              <option value="">{labels["all"]}</option>
              {Object.values(JOURNAL_SOURCE_TYPE).map((type) => (
                <option key={type} value={type}>
                  {labels[JOURNAL_SOURCE_LABEL[type]]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={labels.account} htmlFor="filter-account">
            <AccountSelect
              organizationId={props.organizationId}
              accounts={props.accounts ?? []}
              labels={labels}
              locale={props.locale ?? "en"}
              inputId="filter-account"
              name="accountId"
              defaultValue={props.query.get("accountId") ?? ""}
            />
          </FormField>
        </>
      )}
      <StatementLocationFilter locations={props.locations} labels={labels} query={props.query} />
      <Button type="submit" variant="secondary">
        {labels["filter"]}
      </Button>
    </form>
  );
}
export function BookkeepingPager(props: {
  page: number;
  hasNext: boolean;
  labels: BookkeepingLabels;
  searchParams: Record<string, string | string[] | undefined>;
}): ReactElement {
  function href(page: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(props.searchParams))
      if (typeof value === "string") params.set(key, value);
    params.set("page", String(page));
    return "?" + params.toString();
  }
  return (
    <nav className="flex flex-wrap gap-3" aria-label={props.labels["journal"]}>
      {props.page > 1 && (
        <Link className={buttonVariants({ variant: "secondary" })} href={href(props.page - 1)}>
          {props.labels["previous"]}
        </Link>
      )}
      {props.hasNext && (
        <Link className={buttonVariants({ variant: "secondary" })} href={href(props.page + 1)}>
          {props.labels["next"]}
        </Link>
      )}
    </nav>
  );
}

function StatementLocationFilter(props: {
  locations: readonly LocationOption[] | undefined;
  labels: BookkeepingLabels;
  query: URLSearchParams;
}): ReactElement | null {
  const labels = props.labels;
  if (props.locations === undefined) return null;
  return (
    <FormField label={labels.location} htmlFor="filter-location">
      <Select id="filter-location" name="location" defaultValue={props.query.get("location") ?? ""}>
        <option value="">{labels.all}</option>
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
