"use client";

import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, Checkbox } from "@banijjik/ui";
import type { ReactElement } from "react";
import { FieldInput } from "../fields/field-input";
import { fieldsOfSection } from "../fields/field-rules";
import { translatorFor } from "../i18n/client-translator";
import { localizedText } from "../i18n/localized-text";
import { ArchiveListingButton } from "./archive-listing-button";
import { PhotoUploadInput } from "./photo-upload-input";
import { showsPhotoUpload } from "./photo-upload";
import { useListingFormState, type ListingFormState } from "./listing-form-state";
import { listingIsOpenForEditing, type SectionStep } from "./listing-steps";

export interface ListingFormProps {
  readonly organizationId: string;
  readonly locale: Locale;
  readonly form: StorefrontDirectoryFormResponse;
  readonly listing: ListingResponse | undefined;
}

interface FormContext {
  readonly props: ListingFormProps;
  readonly state: ListingFormState;
  readonly translator: Translator;
}

/** The biodata form: one step per template section, then the consents. Each step saves the draft. */
export function ListingForm(props: ListingFormProps): ReactElement {
  const translator = translatorFor(props.locale);
  const state = useListingFormState(props);
  if (!listingIsOpenForEditing(props.listing)) {
    return (
      <ListingStatusPanel
        listing={props.listing}
        organizationId={props.organizationId}
        locale={props.locale}
        translator={translator}
      />
    );
  }
  const context: FormContext = { props, state, translator };
  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={(event) => event.preventDefault()}>
      <p className="text-small text-secondary">
        {translator.t("storefront.account.stepOf", {
          current: state.stepIndex + 1,
          total: state.steps.length,
        })}
      </p>
      <StepBody context={context} />
      {showsPhotoUpload(props.form.photoPolicy) &&
      props.listing !== undefined &&
      state.stepIndex >= state.steps.length - 1 ? (
        <PhotoUploadInput organizationId={props.organizationId} locale={props.locale} />
      ) : null}
      {state.notice ? (
        <p role="alert" className="text-body text-danger">
          {translator.t(state.notice)}
        </p>
      ) : null}
      <StepActions context={context} />
    </form>
  );
}

function StepBody({ context }: { readonly context: FormContext }): ReactElement | null {
  const step = context.state.steps[context.state.stepIndex];
  if (step === undefined) return null;
  if (step.kind === "consents") return <ConsentList context={context} />;
  return <SectionFields context={context} step={step} />;
}

function SectionFields({
  context,
  step,
}: {
  readonly context: FormContext;
  readonly step: SectionStep;
}): ReactElement {
  const { props, state, translator } = context;
  const sectionKeys = props.form.sections.map((section) => section.sectionKey);
  const fields = fieldsOfSection(props.form.fields, sectionKeys, step.sectionKey);
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="text-title font-semibold text-primary">
        {localizedText(step.label, props.locale)}
      </legend>
      {fields.map((field) => {
        const errorKey = state.errors[field.fieldKey];
        return (
          <FieldInput
            key={field.fieldKey}
            field={field}
            value={state.values[field.fieldKey]}
            error={errorKey === undefined ? undefined : translator.t(errorKey)}
            locale={props.locale}
            translator={translator}
            onChange={(value) => state.setValue(field.fieldKey, value)}
          />
        );
      })}
    </fieldset>
  );
}

function ConsentList({ context }: { readonly context: FormContext }): ReactElement {
  const { props, state, translator } = context;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-title font-semibold text-primary">
        {translator.t("storefront.account.consentsTitle")}
      </legend>
      {props.form.consents.map((consent) => (
        <Checkbox
          key={consent.consentKey}
          name="consents"
          value={consent.consentKey}
          checked={state.consentKeys.includes(consent.consentKey)}
          onChange={() => state.toggleConsent(consent.consentKey)}
          label={localizedText(consent.text, props.locale)}
        />
      ))}
    </fieldset>
  );
}

function StepActions({ context }: { readonly context: FormContext }): ReactElement {
  const { state, translator } = context;
  const isLast = state.stepIndex >= state.steps.length - 1;
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <Button
        variant="secondary"
        disabled={state.stepIndex === 0 || state.isBusy}
        onClick={state.back}
      >
        {translator.t("storefront.account.back")}
      </Button>
      {isLast ? (
        <Button variant="primary" isLoading={state.isBusy} onClick={() => void state.submit()}>
          {translator.t("storefront.account.submit")}
        </Button>
      ) : (
        <Button variant="primary" isLoading={state.isBusy} onClick={() => void state.next()}>
          {translator.t("storefront.account.next")}
        </Button>
      )}
    </div>
  );
}

function ListingStatusPanel({
  listing,
  organizationId,
  locale,
  translator,
}: {
  readonly listing: ListingResponse | undefined;
  readonly organizationId: string;
  readonly locale: Locale;
  readonly translator: Translator;
}): ReactElement {
  return (
    <section className="flex flex-col gap-4">
      <p className="text-body text-primary">
        {translator.t("storefront.account.status", { status: listing?.status ?? "" })}
      </p>
      {listing?.rejection?.note ? (
        <p className="text-body text-secondary">{listing.rejection.note}</p>
      ) : null}
      <ArchiveListingButton organizationId={organizationId} locale={locale} />
    </section>
  );
}
