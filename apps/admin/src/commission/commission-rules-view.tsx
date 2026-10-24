"use client";

import type { CurrencyCode, OfferingKind } from "@banijjik/contracts";
import type { CommissionRuleResponse, CommissionRuleStatus } from "@banijjik/contracts/commission";
import { Button, EmptyState } from "@banijjik/ui";
import { useLazyComponent, useTranslator } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { useRecordAction } from "../catalog/use-record-action";
import { archiveCommissionRule } from "./commission-api";
import {
  rateTextOf,
  ruleStatusLabelOf,
  subjectTextOf,
  targetTextOf,
  type CommissionNameLookups,
} from "./commission-labels";
import type { CommissionMemberOption, CommissionNamedOption } from "./commission-lookups";
import type { CommissionRuleSheetProps } from "./commission-rule-sheet";

export interface CommissionRuleOptions {
  members: readonly CommissionMemberOption[];
  roles: readonly CommissionNamedOption[];
  categories: readonly CommissionNamedOption[];
  offerings: readonly CommissionNamedOption[];
  kinds: readonly OfferingKind[];
}

export interface CommissionRulesViewProps {
  organizationId: string;
  currency: CurrencyCode;
  rules: readonly CommissionRuleResponse[];
  options: CommissionRuleOptions;
  lookups: CommissionNameLookups;
  canWrite: boolean;
}

interface SheetState {
  rule?: CommissionRuleResponse | undefined;
  subjectLabel?: string | undefined;
  targetLabel?: string | undefined;
}

async function loadRuleSheet(): Promise<ComponentType<CommissionRuleSheetProps>> {
  const sheetModule = await import("./commission-rule-sheet");
  return sheetModule.CommissionRuleSheet;
}

function StatusText({ status }: { status: CommissionRuleStatus }): ReactElement {
  const { t } = useTranslator();
  return <span className="text-small text-secondary">{ruleStatusLabelOf(status, t)}</span>;
}

function RuleRow(props: {
  rule: CommissionRuleResponse;
  view: CommissionRulesViewProps;
  onEdit: () => void;
  onArchive: () => void;
  isBusy: boolean;
}): ReactElement {
  const { t, locale } = useTranslator();
  const { rule, view } = props;
  const subject = subjectTextOf(rule, view.lookups, t);
  const target = targetTextOf(rule, view.lookups, t);
  return (
    <li className="flex flex-col gap-3 rounded-md border border-default bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="min-w-0 break-words text-body font-semibold text-primary">
            {`${subject} — ${target}`}
          </span>
          <StatusText status={rule.status} />
        </div>
        <span className="text-body font-semibold text-primary">{rateTextOf(rule, locale)}</span>
      </div>
      {view.canWrite && rule.status === "ACTIVE" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={props.isBusy} onClick={props.onEdit}>
            {t("commission.rules.edit")}
          </Button>
          <Button variant="secondary" disabled={props.isBusy} onClick={props.onArchive}>
            {t("commission.rules.archive")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** The rule list with add, edit and archive; the rule sheet only loads when it is opened. */
export function CommissionRulesView(props: CommissionRulesViewProps): ReactElement {
  const { t } = useTranslator();
  const action = useRecordAction();
  const [sheet, setSheet] = useState<SheetState | undefined>();
  const Sheet = useLazyComponent(loadRuleSheet, sheet !== undefined);

  function archive(rule: CommissionRuleResponse): void {
    void action.run(() =>
      archiveCommissionRule(props.organizationId, rule.commissionRuleId, {
        version: rule.version,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {props.canWrite ? (
        <div>
          <Button onClick={() => setSheet({})}>{t("commission.rules.add")}</Button>
        </div>
      ) : null}
      <RuleActionFailure failure={action.failure} reload={action.reload} t={t} />
      {props.rules.length === 0 ? (
        <EmptyState message={t("commission.rules.empty")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {props.rules.map((rule) => (
            <RuleRow
              key={rule.commissionRuleId}
              rule={rule}
              view={props}
              isBusy={action.isBusy}
              onEdit={() =>
                setSheet({
                  rule,
                  subjectLabel: subjectTextOf(rule, props.lookups, t),
                  targetLabel: targetTextOf(rule, props.lookups, t),
                })
              }
              onArchive={() => archive(rule)}
            />
          ))}
        </ul>
      )}
      {Sheet !== null && sheet !== undefined ? (
        <Sheet
          organizationId={props.organizationId}
          currency={props.currency}
          members={props.options.members}
          roles={props.options.roles}
          categories={props.options.categories}
          offerings={props.options.offerings}
          kinds={props.options.kinds}
          rule={sheet.rule}
          subjectLabel={sheet.subjectLabel}
          targetLabel={sheet.targetLabel}
          onClose={() => setSheet(undefined)}
        />
      ) : null}
    </div>
  );
}

function RuleActionFailure(props: {
  failure: { isConflict: boolean; messageKey?: string | undefined } | undefined;
  reload: () => void;
  t: ReturnType<typeof useTranslator>["t"];
}): ReactElement | null {
  if (props.failure === undefined) return null;
  if (props.failure.isConflict)
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{props.t("commission.rules.conflict")}</p>
        <Button variant="secondary" onClick={props.reload}>
          {props.t("commission.rules.reload")}
        </Button>
      </div>
    );
  return (
    <p role="alert" className="text-small text-danger">
      {props.t(knownMessageKeyOrInternal(props.failure.messageKey ?? "errors.internal"))}
    </p>
  );
}
