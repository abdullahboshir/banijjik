import type { CommissionPayoutMethod } from "@banijjik/contracts/commission";
import { Button, FormField, Select, TextInput, Textarea, formatMoney } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import { needsPayoutReference } from "./commission-pay-form";
import type { CommissionPayMemberOption } from "./commission-pay-sheet";
import type { PayFormController } from "./use-commission-pay-form";
import type { CommissionLocationOption } from "./commission-lookups";

const METHODS: readonly CommissionPayoutMethod[] = ["CASH", "BKASH", "NAGAD", "BANK"];

export function CommissionPayFields(props: {
  state: PayFormController;
  members: readonly CommissionPayMemberOption[];
  locations: readonly CommissionLocationOption[];
}): ReactElement {
  const { t } = useTranslator();
  const { state } = props;
  return (
    <>
      <ChoiceFields state={state} members={props.members} locations={props.locations} />
      <Button
        variant="secondary"
        isLoading={state.isPreviewing}
        onClick={() => void state.runPreview()}
      >
        {t("commission.pay.preview")}
      </Button>
      <PreviewSummary state={state} />
      <PayoutDetailFields state={state} />
      <Button type="submit" isLoading={state.isSaving} disabled={!state.expectedTotal}>
        {t("commission.pay.confirm")}
      </Button>
    </>
  );
}

function PreviewSummary(props: { state: PayFormController }): ReactElement {
  const { t, locale } = useTranslator();
  const { state } = props;
  return (
    <>
      {state.preview ? (
        <p className="text-body font-semibold text-primary">
          {t("commission.pay.entryCount", { count: state.preview.entryCount })} {" · "}{" "}
          {t("commission.pay.total", { total: formatMoney(state.preview.total, { locale }) })}
        </p>
      ) : null}
      {state.changedTotal ? (
        <p role="alert" className="text-small text-danger">
          {t("commission.pay.changed", { total: formatMoney(state.changedTotal, { locale }) })}
        </p>
      ) : null}
      {!state.preview && !state.changedTotal ? (
        <p className="text-small text-secondary">{t("commission.pay.previewFirst")}</p>
      ) : null}
    </>
  );
}

function PayoutDetailFields(props: { state: PayFormController }): ReactElement {
  const { t } = useTranslator();
  const { state } = props;
  const referenceRequired = needsPayoutReference(state.form.method);
  return (
    <>
      <FormField label={t("commission.pay.method")} htmlFor="commission-pay-method" required>
        <Select
          id="commission-pay-method"
          value={state.form.method}
          onChange={(event) =>
            state.patch({ method: event.target.value as CommissionPayoutMethod })
          }
        >
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {t(`commission.method.${method}`)}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label={t("commission.pay.reference")}
        htmlFor="commission-pay-reference"
        required={referenceRequired}
        hint={t("commission.pay.referenceHint")}
        error={state.errors.externalReference ? t(state.errors.externalReference) : undefined}
      >
        <TextInput
          id="commission-pay-reference"
          value={state.form.externalReference}
          onChange={(event) => state.patch({ externalReference: event.target.value })}
        />
      </FormField>
      <FormField label={t("commission.pay.note")} htmlFor="commission-pay-note">
        <Textarea
          id="commission-pay-note"
          value={state.form.note}
          onChange={(event) => state.patch({ note: event.target.value })}
        />
      </FormField>
    </>
  );
}

function ChoiceFields(props: {
  state: PayFormController;
  members: readonly CommissionPayMemberOption[];
  locations: readonly CommissionLocationOption[];
}): ReactElement {
  const { t } = useTranslator();
  const { state } = props;
  return (
    <>
      <FormField
        label={t("commission.pay.member")}
        htmlFor="commission-pay-member"
        required
        error={state.errors.memberId ? t(state.errors.memberId) : undefined}
      >
        <Select
          id="commission-pay-member"
          value={state.form.memberId}
          onChange={(event) => state.patch({ memberId: event.target.value })}
        >
          {props.members.map((member) => (
            <option key={member.memberId} value={member.memberId}>
              {member.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label={t("commission.pay.location")}
        htmlFor="commission-pay-location"
        required
        error={state.errors.locationId ? t(state.errors.locationId) : undefined}
      >
        <Select
          id="commission-pay-location"
          value={state.form.locationId}
          onChange={(event) => state.patch({ locationId: event.target.value })}
        >
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
      <UpToField state={state} />
    </>
  );
}

function UpToField(props: { state: PayFormController }): ReactElement {
  const { t } = useTranslator();
  const { state } = props;
  return (
    <FormField
      label={t("commission.pay.upTo")}
      htmlFor="commission-pay-up-to"
      required
      error={state.errors.upToBusinessDate ? t(state.errors.upToBusinessDate) : undefined}
    >
      <TextInput
        id="commission-pay-up-to"
        type="date"
        value={state.form.upTo}
        onChange={(event) => state.patch({ upTo: event.target.value })}
      />
    </FormField>
  );
}
