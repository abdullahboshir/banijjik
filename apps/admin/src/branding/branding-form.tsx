"use client";

import { BRANDING_RULES } from "@banijjik/contracts";
import {
  Button,
  FormField,
  ImageInput,
  PageSection,
  StickyActionBar,
  TextInput,
  formFieldMessageId,
} from "@banijjik/ui";
import { useLazyComponent, useTranslator } from "@banijjik/web-client/client";
import { useState, type ComponentType, type FormEvent, type ReactElement } from "react";
import { ConflictNotice } from "../settings/conflict-notice";
import type { FormFailure } from "../settings/form-failure";
import { FormMessage } from "../settings/form-message";
import type { BrandingPreviewProps } from "./branding-preview";
import { fillTemplate, type BrandingLabels } from "./branding-labels";
import { INVALID_COLOUR_KEY, buildBrandingUpdate, type BrandingFormState } from "./branding-state";
import { ColourFields } from "./colour-fields";
import { useBrandingSave } from "./use-branding-save";
import { useLogoUpload } from "./use-logo-upload";

/** The preview card loads after the first scripts: it sits below the fields, and the page stays within its script budget (13-UX section 11). */
async function loadPreview(): Promise<ComponentType<BrandingPreviewProps>> {
  const loaded = await import("./branding-preview");
  return loaded.BrandingPreview;
}

export interface BrandingFormProps {
  organizationId: string;
  businessName: string;
  /** The version the page was drawn from. */
  version: number;
  initial: BrandingFormState;
  labels: BrandingLabels;
  /** False without the profile permission, or in READ_ONLY mode: every control is off and Save is absent. */
  canEdit: boolean;
}

interface SectionProps {
  state: BrandingFormState;
  disabled: boolean;
  labels: BrandingLabels;
  onChange: (changes: Partial<BrandingFormState>) => void;
}

function LogoSection(
  props: SectionProps & { organizationId: string; refusedKey: string | undefined },
): ReactElement {
  const { t } = useTranslator();
  const { state, disabled, labels, onChange } = props;
  const logo = useLogoUpload(props.organizationId, (fileId, previewUrl) =>
    onChange({ logoFileId: fileId, logoUrl: previewUrl }),
  );
  const refusedKey = logo.errorKey ?? props.refusedKey;
  const refusal = refusedKey ? t(refusedKey) : undefined;
  return (
    <PageSection title={labels.logoTitle} help={labels.logoHelp}>
      <ImageInput
        id="branding-logo"
        previewUrl={state.logoUrl}
        onPick={logo.upload}
        onClear={() => onChange({ logoFileId: undefined, logoUrl: undefined })}
        isUploading={logo.isUploading}
        disabled={disabled}
        error={refusal}
        labels={{
          choose: labels.logo.choose,
          change: labels.logo.change,
          remove: labels.logo.remove,
          uploading: labels.logo.uploading,
          previewAlt: labels.logo.alt,
        }}
      />
      {refusal ? (
        <p
          id={formFieldMessageId("branding-logo", "error")}
          role="alert"
          className="text-small text-danger"
        >
          {refusal}
        </p>
      ) : null}
    </PageSection>
  );
}

function TaglineSection(
  props: SectionProps & { errorText: string | undefined; onTagline: (text: string) => void },
): ReactElement {
  const { state, labels } = props;
  const counter = fillTemplate(labels.taglineCounter, {
    count: state.tagline.length,
    max: BRANDING_RULES.taglineMaxLength,
  });
  return (
    <PageSection title={labels.taglineTitle} help={labels.taglineHelp}>
      <FormField
        label={labels.taglineLabel}
        htmlFor="branding-tagline"
        hint={counter}
        error={props.errorText}
      >
        <TextInput
          id="branding-tagline"
          value={state.tagline}
          disabled={props.disabled}
          maxLength={BRANDING_RULES.taglineMaxLength}
          onChange={(event) => props.onTagline(event.target.value)}
        />
      </FormField>
    </PageSection>
  );
}

/** A version conflict asks for a reload; any other refusal that belongs to no box shows under the form. */
function SaveFailure(props: {
  failure: FormFailure | undefined;
  labels: BrandingLabels;
  onReload: () => void;
}): ReactElement {
  const { failure, labels } = props;
  if (failure === undefined) return <></>;
  return (
    <>
      {failure.isConflict ? (
        <ConflictNotice
          message={labels.conflict}
          reloadLabel={labels.reload}
          onReload={props.onReload}
        />
      ) : null}
      <FormMessage failure={failure} />
    </>
  );
}

/**
 * The branding page's form (plan 3.12 decision 6): logo, colours and tagline with a live preview.
 * Save sends only what changed through the profile endpoint; a version conflict asks for a reload.
 */
export function BrandingForm(props: BrandingFormProps): ReactElement {
  const { t } = useTranslator();
  const Preview = useLazyComponent(loadPreview, true);
  const { initial, canEdit, labels } = props;
  const [state, setState] = useState<BrandingFormState>(initial);
  const saving = useBrandingSave({
    organizationId: props.organizationId,
    version: props.version,
    initial,
    current: state,
    savedMessage: labels.saved,
  });
  const update = buildBrandingUpdate(state, initial);
  const hasChanges = !update.ok || update.branding !== undefined;
  const disabled = !canEdit || saving.isSaving;
  const change = (changes: Partial<BrandingFormState>): void => setState({ ...state, ...changes });
  const errorText = (messageKey: string): string =>
    messageKey === INVALID_COLOUR_KEY ? labels.invalidColour : t(messageKey);
  const taglineError = saving.errors["tagline"];
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void saving.save();
  }
  const section = { state, disabled, labels, onChange: change };
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {canEdit ? null : <p className="text-small text-secondary">{labels.readOnly}</p>}
      <LogoSection
        {...section}
        organizationId={props.organizationId}
        refusedKey={saving.errors["logoFileId"]}
      />
      <PageSection title={labels.coloursTitle} help={labels.coloursHelp}>
        <ColourFields {...section} errors={saving.errors} errorText={errorText} />
      </PageSection>
      <TaglineSection
        {...section}
        errorText={taglineError ? errorText(taglineError) : undefined}
        onTagline={(tagline) => change({ tagline })}
      />
      {Preview === null ? null : (
        <Preview businessName={props.businessName} state={state} labels={labels} />
      )}
      <SaveFailure failure={saving.failure} labels={labels} onReload={saving.reload} />
      {canEdit ? (
        <StickyActionBar label={labels.actions}>
          <Button type="submit" isLoading={saving.isSaving} disabled={!hasChanges}>
            {labels.save}
          </Button>
        </StickyActionBar>
      ) : null}
    </form>
  );
}
