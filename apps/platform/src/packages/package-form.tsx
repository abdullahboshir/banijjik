"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { PACKAGE_STATUS, type PlatformPackageResponse } from "@banijjik/contracts";
import { Button } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { createPackage, updatePackage } from "../api/platform-api";
import { announceSuccess } from "../forms/announce-success";
import type { FieldErrors } from "../forms/schema-errors";
import { useFormSubmit } from "../forms/use-form-submit";
import { ArchivePackageButton } from "./archive-package-button";
import { ClosureGaps } from "./closure-gaps";
import { LimitFields } from "./limit-fields";
import { ModulePicker } from "./module-picker";
import { draftOf, newDraft, type PackageDraft } from "./package-draft";
import type { PackageFormLabels, PackageFormTexts } from "./package-form-labels";
import { PackageIdentityFields } from "./package-identity-fields";
import { buildCreateRequest, buildUpdateRequest } from "./package-request";

export interface PackageFormProps {
  /** Present when an existing package is opened; absent on the create page. */
  existing: PlatformPackageResponse | undefined;
  /** Seed packages show their translated name here, read-only. */
  seedName: string | undefined;
  canWrite: boolean;
  texts: PackageFormTexts;
}

function usePackageSave({ existing, texts }: PackageFormProps) {
  const router = useRouter();
  const submit = useFormSubmit();
  const [errors, setErrors] = useState<FieldErrors>({});

  async function saveNew(draft: PackageDraft): Promise<void> {
    const result = await buildCreateRequest(draft);
    setErrors(result.isValid ? {} : result.errors);
    if (!result.isValid) return;
    if (!(await submit.run(() => createPackage(result.request)))) return;
    await announceSuccess(texts.labels["platform.package.created"]);
    router.replace("/packages");
  }

  async function saveExisting(pkg: PlatformPackageResponse, draft: PackageDraft): Promise<void> {
    const result = await buildUpdateRequest(draft, {
      version: pkg.version,
      canRename: pkg.nameKey === null,
    });
    setErrors(result.isValid ? {} : result.errors);
    if (!result.isValid) return;
    if (!(await submit.run(() => updatePackage(pkg.packageId, result.request)))) return;
    await announceSuccess(texts.labels["platform.package.saved"]);
    router.refresh();
  }

  const save = (draft: PackageDraft): Promise<void> =>
    existing ? saveExisting(existing, draft) : saveNew(draft);
  return { save, submit, errors };
}

interface PackageFormFooterProps {
  existing: PlatformPackageResponse | undefined;
  labels: PackageFormLabels;
  canWrite: boolean;
  isSubmitting: boolean;
  failureMessage: string | undefined;
}

function PackageFormFooter(props: PackageFormFooterProps): ReactElement {
  const { existing, labels, canWrite } = props;
  if (!canWrite)
    return <p className="text-small text-secondary">{labels["platform.package.readOnly"]}</p>;
  return (
    <>
      {props.failureMessage ? (
        <p role="alert" className="text-small text-danger">
          {props.failureMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={props.isSubmitting}>
          {labels[existing ? "platform.package.save" : "platform.package.create"]}
        </Button>
        {existing?.status === PACKAGE_STATUS.ACTIVE ? (
          <ArchivePackageButton
            packageId={existing.packageId}
            version={existing.version}
            labels={labels}
          />
        ) : null}
      </div>
    </>
  );
}

interface PackageModuleSectionProps {
  existing: PlatformPackageResponse | undefined;
  draft: PackageDraft;
  texts: PackageFormTexts;
  isReadOnly: boolean;
  onChange: (draft: PackageDraft) => void;
}

/** The module checkboxes, and for an open package the modules it names that are not built yet. */
function PackageModuleSection(props: PackageModuleSectionProps): ReactElement {
  const { existing, draft, texts } = props;
  return (
    <>
      <ModulePicker
        legend={texts.labels["platform.package.modules"]}
        selected={draft.moduleKeys}
        moduleLabels={texts.moduleLabels}
        classLabels={texts.classLabels}
        isReadOnly={props.isReadOnly}
        onChange={(moduleKeys) => props.onChange({ ...draft, moduleKeys })}
      />
      {existing && existing.unbuiltModuleKeys.length > 0 ? (
        <p className="text-small text-secondary">
          {texts.labels["platform.package.notBuilt"]}{" "}
          {existing.unbuiltModuleKeys.map((moduleKey) => texts.moduleLabels[moduleKey]).join(", ")}
        </p>
      ) : null}
    </>
  );
}

/** Create or edit a package: name, kind, modules by class, limits (and increments for an add-on). */
export function PackageForm(props: PackageFormProps): ReactElement {
  const { existing, texts, canWrite } = props;
  const { t } = useTranslator();
  const [draft, setDraft] = useState<PackageDraft>(() =>
    existing ? draftOf(existing) : newDraft(),
  );
  const { save, submit, errors } = usePackageSave(props);
  const { labels } = texts;
  const hasLimitError = errors["limits"] !== undefined || errors["limitIncrements"] !== undefined;

  return (
    <form
      noValidate
      className="flex max-w-5xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft);
      }}
    >
      <PackageIdentityFields
        draft={draft}
        labels={labels}
        errors={errors}
        isExisting={existing !== undefined}
        seedName={props.seedName}
        isReadOnly={!canWrite}
        onChange={setDraft}
      />
      <PackageModuleSection
        existing={existing}
        draft={draft}
        texts={texts}
        isReadOnly={!canWrite}
        onChange={setDraft}
      />
      <LimitFields
        draft={draft}
        limitLabels={texts.limitLabels}
        labels={labels}
        isReadOnly={!canWrite}
        error={hasLimitError ? t("validation.invalid_value") : undefined}
        onChange={setDraft}
      />
      <ClosureGaps
        gaps={submit.failure?.gaps ?? []}
        title={labels["platform.package.gapsTitle"]}
        pattern={labels["platform.package.gap"]}
        moduleLabels={texts.moduleLabels}
      />
      <PackageFormFooter
        existing={existing}
        labels={labels}
        canWrite={canWrite}
        isSubmitting={submit.isSubmitting}
        failureMessage={
          submit.failure ? t(submit.failure.messageKey, submit.failure.values) : undefined
        }
      />
    </form>
  );
}
