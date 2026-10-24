import type { Translator } from "@banijjik/i18n";
import { buttonVariants, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { CommissionMemberOption, CommissionNamedOption } from "./commission-lookups";
import type {
  CommissionEntryQuery,
  CommissionPayoutQuery,
  CommissionRuleQuery,
} from "./commission-query";

const FIELD_CLASS = "min-h-11 w-full rounded-md border border-default bg-surface px-3 text-body";

function MemberSelect(props: {
  id: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  members: readonly CommissionMemberOption[];
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id}>
      <Select
        id={props.id}
        name="memberId"
        defaultValue={props.value ?? ""}
        className={FIELD_CLASS}
      >
        <option value="">{props.allLabel}</option>
        {props.members.map((member) => (
          <option key={member.memberId} value={member.memberId}>
            {member.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function LocationSelect(props: {
  id: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  locations: readonly { locationId: string; name: string }[];
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor={props.id}>
      <Select
        id={props.id}
        name="locationId"
        defaultValue={props.value ?? ""}
        className={FIELD_CLASS}
      >
        <option value="">{props.allLabel}</option>
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function SubmitButton({ label }: { label: string }): ReactElement {
  return (
    <button type="submit" className={`${buttonVariants({ variant: "secondary" })} self-start`}>
      {label}
    </button>
  );
}

function DateRangeFields(props: {
  from: string | undefined;
  to: string | undefined;
  t: Translator["t"];
}): ReactElement {
  return (
    <>
      <FormField label={props.t("commission.filter.from")} htmlFor="commission-from">
        <TextInput id="commission-from" name="from" type="date" defaultValue={props.from ?? ""} />
      </FormField>
      <FormField label={props.t("commission.filter.to")} htmlFor="commission-to">
        <TextInput id="commission-to" name="to" type="date" defaultValue={props.to ?? ""} />
      </FormField>
    </>
  );
}

export function CommissionRuleFilterForm(props: {
  query: CommissionRuleQuery;
  members: readonly CommissionMemberOption[];
  roles: readonly CommissionNamedOption[];
  t: Translator["t"];
}): ReactElement {
  const { query, members, roles, t } = props;
  const subject = query.memberId ? `member:${query.memberId}` : subjectForRole(query.roleId);
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("commission.filter.label")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("commission.rules.filter.subject")} htmlFor="commission-rule-subject">
          <Select
            id="commission-rule-subject"
            name="subject"
            defaultValue={subject}
            className={FIELD_CLASS}
          >
            <option value="">{t("commission.rules.filter.everyone")}</option>
            <optgroup label={t("commission.rule.form.member")}>
              {members.map((member) => (
                <option key={member.memberId} value={`member:${member.memberId}`}>
                  {member.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("commission.rule.form.role")}>
              {roles.map((role) => (
                <option key={role.id} value={`role:${role.id}`}>
                  {role.name}
                </option>
              ))}
            </optgroup>
          </Select>
        </FormField>
        <FormField label={t("commission.rules.filter.status")} htmlFor="commission-rule-status">
          <Select
            id="commission-rule-status"
            name="status"
            defaultValue={query.status ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">{t("commission.rules.filter.allStatuses")}</option>
            <option value="ACTIVE">{t("commission.status.ACTIVE")}</option>
            <option value="ARCHIVED">{t("commission.status.ARCHIVED")}</option>
          </Select>
        </FormField>
      </div>
      <SubmitButton label={t("commission.filter.submit")} />
    </form>
  );
}

function subjectForRole(roleId: string | undefined): string {
  return roleId === undefined ? "" : `role:${roleId}`;
}

export function CommissionEntryFilterForm(props: {
  query: CommissionEntryQuery;
  members: readonly CommissionMemberOption[];
  locations: readonly { locationId: string; name: string }[];
  t: Translator["t"];
}): ReactElement {
  const { query, members, locations, t } = props;
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("commission.filter.label")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateRangeFields from={query.from} to={query.to} t={t} />
        <MemberSelect
          id="commission-entry-member"
          label={t("commission.filter.member")}
          allLabel={t("commission.filter.allMembers")}
          value={query.memberId}
          members={members}
        />
        <LocationSelect
          id="commission-entry-location"
          label={t("commission.filter.location")}
          allLabel={t("commission.filter.allLocations")}
          value={query.locationId}
          locations={locations}
        />
      </div>
      <SubmitButton label={t("commission.filter.submit")} />
    </form>
  );
}

export function CommissionPayoutFilterForm(props: {
  query: CommissionPayoutQuery;
  members: readonly CommissionMemberOption[];
  locations: readonly { locationId: string; name: string }[];
  t: Translator["t"];
}): ReactElement {
  const { query, members, locations, t } = props;
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("commission.filter.label")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <MemberSelect
          id="commission-payout-member"
          label={t("commission.filter.member")}
          allLabel={t("commission.filter.allMembers")}
          value={query.memberId}
          members={members}
        />
        <LocationSelect
          id="commission-payout-location"
          label={t("commission.filter.location")}
          allLabel={t("commission.filter.allLocations")}
          value={query.locationId}
          locations={locations}
        />
      </div>
      <SubmitButton label={t("commission.filter.submit")} />
    </form>
  );
}

export function CommissionMyFilterForm(props: {
  query: CommissionEntryQuery;
  t: Translator["t"];
}): ReactElement {
  const { query, t } = props;
  return (
    <form method="get" className="flex flex-col gap-3" aria-label={t("commission.filter.label")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateRangeFields from={query.from} to={query.to} t={t} />
      </div>
      <SubmitButton label={t("commission.filter.submit")} />
    </form>
  );
}
