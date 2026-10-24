import { ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import { Button, FormField, Select } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import type { EnrollmentsQuery } from "./enrollment-query";

export interface EnrollmentFilterLabels {
  readonly status: string;
  readonly statusAll: string;
  readonly plan: string;
  readonly planAll: string;
  readonly overdue: string;
  readonly apply: string;
  readonly reset: string;
  readonly statusNames: Readonly<Record<string, string>>;
}

/** A plain GET form: the filters live in the address, so the page stays server-rendered and shareable. */
export function EnrollmentFilterForm(props: {
  basePath: string;
  query: EnrollmentsQuery;
  plans: readonly { readonly offeringId: string; readonly name: string }[];
  labels: EnrollmentFilterLabels;
}): ReactElement {
  const { labels, query } = props;
  return (
    <form
      method="get"
      action={props.basePath}
      className="grid grid-cols-1 gap-3 rounded-lg border border-default bg-surface p-4 sm:grid-cols-3"
    >
      <FormField label={labels.status} htmlFor="filter-status">
        <Select id="filter-status" name="status" defaultValue={query.status ?? ""}>
          <option value="">{labels.statusAll}</option>
          {Object.values(ENROLLMENT_STATUS).map((status) => (
            <option key={status} value={status}>
              {labels.statusNames[status] ?? status}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={labels.plan} htmlFor="filter-plan">
        <Select id="filter-plan" name="offeringId" defaultValue={query.offeringId ?? ""}>
          <option value="">{labels.planAll}</option>
          {props.plans.map((plan) => (
            <option key={plan.offeringId} value={plan.offeringId}>
              {plan.name}
            </option>
          ))}
        </Select>
      </FormField>
      <label className="flex min-h-11 items-center gap-3 self-end text-body text-primary">
        <input
          type="checkbox"
          name="overdue"
          value="true"
          defaultChecked={query.overdue}
          className="size-5 accent-brand"
        />
        <span>{labels.overdue}</span>
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-3 sm:justify-end">
        <Link
          href={props.basePath}
          className="inline-flex min-h-11 items-center rounded-md border border-default px-4 text-body text-primary"
        >
          {labels.reset}
        </Link>
        <Button type="submit">{labels.apply}</Button>
      </div>
    </form>
  );
}
