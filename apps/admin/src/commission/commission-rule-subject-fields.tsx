"use client";

import {
  COMMISSION_SUBJECT_TYPE,
  type CommissionSubjectType,
} from "@banijjik/contracts/commission";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { ChoiceField, Options } from "./commission-rule-choice";
import type { CommissionMemberOption, CommissionNamedOption } from "./commission-lookups";
import type { CommissionRuleFormState } from "./commission-rule-form";

export function SubjectFields(props: {
  form: CommissionRuleFormState;
  members: readonly CommissionMemberOption[];
  roles: readonly CommissionNamedOption[];
  errors: FieldErrors;
  onPatch: (changes: Partial<CommissionRuleFormState>) => void;
}): ReactElement {
  const { t } = useTranslator();
  const { form, errors, onPatch } = props;
  const isMember = form.subjectType === COMMISSION_SUBJECT_TYPE.MEMBER;
  return (
    <>
      <ChoiceField
        id="commission-rule-subject-type"
        label={t("commission.rule.form.subjectType")}
        value={form.subjectType}
        errorKey={undefined}
        isRequired
        onChange={(value) =>
          onPatch({ subjectType: value as CommissionSubjectType, memberId: "", roleId: "" })
        }
      >
        <option value={COMMISSION_SUBJECT_TYPE.MEMBER}>{t("commission.rule.form.member")}</option>
        <option value={COMMISSION_SUBJECT_TYPE.ROLE}>{t("commission.rule.form.role")}</option>
      </ChoiceField>
      {isMember ? (
        <ChoiceField
          id="commission-rule-member"
          label={t("commission.rule.form.member")}
          value={form.memberId}
          errorKey={errors["memberId"]}
          isRequired
          onChange={(memberId) => onPatch({ memberId })}
        >
          <Options
            placeholder={t("commission.rule.form.chooseMember")}
            options={props.members.map((member) => ({ id: member.memberId, name: member.name }))}
          />
        </ChoiceField>
      ) : (
        <ChoiceField
          id="commission-rule-role"
          label={t("commission.rule.form.role")}
          value={form.roleId}
          errorKey={errors["roleId"]}
          isRequired
          onChange={(roleId) => onPatch({ roleId })}
        >
          <Options placeholder={t("commission.rule.form.chooseRole")} options={props.roles} />
        </ChoiceField>
      )}
    </>
  );
}
