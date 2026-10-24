import { PERMISSION_KEY, type PermissionKey } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { currencySymbolOf, DetailHeader, EmptyState, StatusBadge } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { paymentLabelsOf } from "../payments/payment-labels";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import {
  enrollmentActionsFor,
  type EnrollmentActionKey,
  type EnrollmentActionPermissions,
} from "./enrollment-action-items";
import { loadEnrollmentDetail, type EnrollmentDetailData } from "./enrollment-detail-data";
import { EnrollmentDetailActions, type EnrollmentActionLabels } from "./enrollment-detail-actions";
import { EnrollmentDetailHistory } from "./enrollment-detail-history";
import {
  enrollmentStatusLabels,
  enrollmentWordsOf,
  historyActionNames,
  periodStatusLabels,
} from "./enrollment-labels";
import {
  EnrollmentPeriodsSection,
  type EnrollmentPeriodsLabels,
} from "./enrollment-periods-section";

type Translate = Translator["t"];

function actionLabelsOf(t: Translate, enrollmentTerm: string): EnrollmentActionLabels {
  const actions = Object.fromEntries(
    (["activate", "freeze", "unfreeze", "renew", "cancel"] as const).map((key) => [
      key,
      t(`enrollment.action.${key}`),
    ]),
  ) as Record<EnrollmentActionKey, string>;
  return {
    actions,
    payHint: t("enrollment.detail.payHint"),
    conflict: t("enrollment.sheet.conflict"),
    reload: t("enrollment.sheet.reload"),
    cancelTitle: t("enrollment.cancel.title", { term: enrollmentTerm }),
    cancelDescription: t("enrollment.cancel.description"),
    cancelConfirm: t("enrollment.cancel.confirm"),
    cancelKeep: t("enrollment.cancel.keep"),
    cancelClose: t("enrollment.cancel.close"),
    cancelDone: t("enrollment.cancel.done"),
    refundable: t("enrollment.cancel.refundable"),
    refundLater: t("enrollment.cancel.refundLater"),
  };
}

function periodLabelsOf(t: Translate, data: EnrollmentDetailData): EnrollmentPeriodsLabels {
  const paymentLabels = paymentLabelsOf(t);
  return {
    title: t("enrollment.detail.periods"),
    fee: t("enrollment.detail.fee"),
    sessions: t("enrollment.detail.sessions"),
    receivePayment: t("enrollment.detail.receivePayment"),
    updating: t("enrollment.detail.updating"),
    reloadStatus: t("enrollment.detail.reloadStatus"),
    periodNames: Object.fromEntries(
      data.enrollment.periods.map((period) => [
        period.periodNumber,
        t("enrollment.detail.period", { number: period.periodNumber }),
      ]),
    ),
    statusNames: periodStatusLabels(t),
    sessionsOf: t("enrollment.detail.sessionsOf", { used: "{used}", allowed: "{allowed}" }),
    sheetLabels: {
      ...paymentLabels.receiveSheet,
      methodLabels: paymentLabels.method,
      requestTypeLabels: paymentLabels.requestType,
    },
  };
}

function FactsList(props: { data: EnrollmentDetailData; t: Translate }): ReactElement {
  const { data, t } = props;
  const { enrollment } = data;
  const nameOf = (contactId: string) =>
    data.contactNames.get(contactId) ?? t("enrollment.list.unknownContact");
  const facts: [string, string][] = [
    [t("enrollment.detail.contact"), nameOf(enrollment.contactId)],
    [t("enrollment.detail.startsOn"), enrollment.startsOn],
  ];
  if (enrollment.billToContactId !== enrollment.contactId) {
    facts.push([t("enrollment.detail.billTo"), nameOf(enrollment.billToContactId)]);
  }
  if (enrollment.endsOn) facts.push([t("enrollment.detail.endsOn"), enrollment.endsOn]);
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className="text-small text-secondary">{label}</dt>
          <dd className="text-body text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function actionPermissionsOf(access: OrgAccess): EnrollmentActionPermissions {
  const held = (key: PermissionKey) =>
    access.canWrite && holdsPermission(access.config.permissions, key);
  return {
    canUpdate: held(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_UPDATE),
    canRenew: held(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_RENEW),
    canCancel: held(PERMISSION_KEY.ENROLLMENT_ENROLLMENT_CANCEL),
  };
}

function EnrollmentHeader(props: {
  orgSlug: string;
  data: EnrollmentDetailData;
  planTerm: string;
  t: Translate;
}): ReactElement {
  const { data, t } = props;
  const { enrollment } = data;
  const statusLabel = enrollmentStatusLabels(t)[enrollment.status] ?? enrollment.status;
  return (
    <DetailHeader
      title={enrollment.enrollmentNumber}
      backHref={`/${props.orgSlug}/enrollments`}
      backLabel={t("enrollment.detail.back")}
      status={
        <StatusBadge requestType="ENROLLMENT" status={enrollment.status} label={statusLabel} />
      }
      facts={
        <span className="text-body text-primary">
          {[props.planTerm, data.planName, data.variantName].filter(Boolean).join(" · ")}
        </span>
      }
    />
  );
}

export async function EnrollmentDetailPage(props: {
  readonly orgSlug: string;
  readonly enrollmentId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const permissions = access.config.permissions;
  if (!holdsPermission(permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const data = await loadEnrollmentDetail(access, props.enrollmentId);
  const { enrollment } = data;
  const words = enrollmentWordsOf(translator, access.config.terms);
  const actions = enrollmentActionsFor({
    status: enrollment.status,
    freezeAllowed: enrollment.plan.freezeAllowed,
    permissions: actionPermissionsOf(access),
  });
  return (
    <div className="flex flex-col gap-6">
      <EnrollmentHeader orgSlug={props.orgSlug} data={data} planTerm={words.planTerm} t={t} />
      <FactsList data={data} t={t} />
      <EnrollmentDetailActions
        organizationId={access.organization.organizationId}
        enrollmentId={enrollment.enrollmentId}
        version={enrollment.version}
        actions={actions}
        locale={locale}
        labels={actionLabelsOf(t, words.enrollmentTerm)}
      />
      <EnrollmentPeriodsSection
        organizationId={access.organization.organizationId}
        enrollment={enrollment}
        periods={enrollment.periods}
        locationName={data.locationName}
        currency={data.currency}
        currencySymbol={currencySymbolOf(data.currency)}
        allowedMethods={data.allowedMethods}
        canReceive={data.canReceive}
        dueMinorByPeriodId={data.dueMinorByPeriodId}
        locale={locale}
        labels={periodLabelsOf(t, data)}
      />
      <EnrollmentDetailHistory
        history={enrollment.history}
        title={t("enrollment.detail.history")}
        actionNames={historyActionNames(t)}
      />
    </div>
  );
}
