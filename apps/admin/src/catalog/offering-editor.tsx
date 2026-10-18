"use client";

import { FILE_PURPOSE } from "@banijjik/contracts/file";
import {
  type CategoryResponse,
  type ModifierGroupResponse,
  type Money,
  type OfferingStatus,
  type UnitKey,
} from "@banijjik/contracts/catalog";
import { Button, PageSection, StickyActionBar } from "@banijjik/ui";
import { publicFileUrl, uploadFile } from "@banijjik/web-client";
import { useTranslator } from "@banijjik/web-client/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { API_BASE_URL } from "../config/api-base-url";
import { CustomFieldsSection } from "../custom-fields/custom-fields-section";
import type { CustomFieldsFormProps } from "../custom-fields/use-custom-fields-form";
import { apiFetch } from "../lib/api/api-client";
import { transitionOffering } from "./offering-api";
import type { EditorLabels } from "./catalog-labels";
import { EditorBasics } from "./editor-basics";
import type { ImageUploader } from "./editor-images";
import { EditorBranches } from "./editor-branches";
import { EditorDetails } from "./editor-details";
import { ToggleField } from "./editor-fields";
import { EditorPrice } from "./editor-price";
import { EditorVariants } from "./editor-variants";
import type { OfferingFormState } from "./offering-form";
import {
  useOfferingEditor,
  type EditorFailure,
  type OfferingEditorState,
} from "./use-offering-editor";

const IMAGE_VARIANT = "thumb";

export interface OfferingEditorProps {
  organizationId: string;
  orgSlug: string;
  initial: OfferingFormState;
  /** The words of this screen, read on the server. */
  labels: EditorLabels;
  unitNames: Readonly<Record<UnitKey, string>>;
  kindWord: string;
  status: OfferingStatus | undefined;
  currency: Money["currency"];
  currencySymbol: string;
  categories: readonly CategoryResponse[];
  modifierGroups: readonly ModifierGroupResponse[];
  locations: readonly { locationId: string; name: string }[];
  customFields: CustomFieldsFormProps | undefined;
  canWrite: boolean;
  canPublish: boolean;
  canArchive: boolean;
}

function ModifierGroupPicker(props: {
  props: OfferingEditorProps;
  form: OfferingFormState;
  update: (patch: Partial<OfferingFormState>) => void;
}): ReactElement {
  const { labels, modifierGroups, canWrite } = props.props;
  const { form, update } = props;
  return (
    <PageSection title={labels["section.addOns.title"]} help={labels["section.addOns.help"]}>
      {modifierGroups.length === 0 ? (
        <p className="text-small text-secondary">{labels["addOns.none"]}</p>
      ) : (
        modifierGroups.map((group) => (
          <ToggleField
            key={group.modifierGroupId}
            label={group.name}
            checked={form.modifierGroupIds.includes(group.modifierGroupId)}
            disabled={!canWrite}
            onChange={(isOn) =>
              update({
                modifierGroupIds: isOn
                  ? [...form.modifierGroupIds, group.modifierGroupId]
                  : form.modifierGroupIds.filter((id) => id !== group.modifierGroupId),
              })
            }
          />
        ))
      )}
    </PageSection>
  );
}

function FailureNotice(props: {
  failure: EditorFailure;
  labels: EditorLabels;
  orgSlug: string;
  onReload: () => void;
}): ReactElement | null {
  const { failure, labels } = props;
  const { t } = useTranslator();
  if (failure.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{labels["editor.conflict"]}</p>
        <Button variant="secondary" onClick={props.onReload}>
          {labels["editor.reload"]}
        </Button>
      </div>
    );
  }
  if (failure.isLimit) {
    return (
      <p role="alert" className="text-small text-danger">
        {labels["editor.limit"]}
      </p>
    );
  }
  if (failure.messageKey === undefined) return null;
  return (
    <p role="alert" className="text-small text-danger">
      {t(knownMessageKeyOrInternal(failure.messageKey))}{" "}
      {failure.skuOfferingId ? (
        <Link className="underline" href={`/${props.orgSlug}/catalog/${failure.skuOfferingId}`}>
          {labels["editor.skuTaken"]}
        </Link>
      ) : null}
    </p>
  );
}

function ArchiveButton(props: { props: OfferingEditorProps; version: number }): ReactElement {
  const { labels, organizationId } = props.props;
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  async function archive(): Promise<void> {
    setIsBusy(true);
    await transitionOffering(organizationId, {
      offeringId: props.props.initial.offeringId ?? "",
      version: props.version,
      action: "archive",
    });
    router.push(`/${props.props.orgSlug}/catalog`);
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        {labels["editor.archive"]}
      </Button>
      {isConfirming ? (
        <div role="alertdialog" aria-label={labels["editor.archiveTitle"]} className="w-full">
          <p className="text-body font-semibold text-primary">{labels["editor.archiveTitle"]}</p>
          <p className="text-small text-secondary">{labels["editor.archiveBody"]}</p>
          <Button isLoading={isBusy} onClick={() => void archive()}>
            {labels["editor.archive"]}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function useImageUploader(organizationId: string): ImageUploader {
  return {
    upload: async (file: File) => {
      const uploaded = await uploadFile(apiFetch, {
        organizationId,
        purpose: FILE_PURPOSE.OFFERING_IMAGE,
        file,
      });
      return {
        fileId: uploaded.fileId,
        url: publicFileUrl(API_BASE_URL, uploaded.fileId, IMAGE_VARIANT),
      };
    },
  };
}

/** The saved variants, for the branch prices: only rows the API already knows have an id. */
function savedVariantsOf(form: OfferingFormState, fallbackName: string) {
  return form.rows
    .filter((row) => row.variantId !== undefined)
    .map((row) => ({
      variantId: row.variantId ?? "",
      name: Object.values(row.optionValues).join(" / ") || fallbackName,
    }));
}

function useTranslatedErrors(errors: Readonly<Record<string, string | undefined>>) {
  const { t } = useTranslator();
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(errors).map(([field, key]) => [
          field,
          key === undefined ? undefined : t(knownMessageKeyOrInternal(key)),
        ]),
      ),
    [errors, t],
  );
}

function EditorSections(props: {
  props: OfferingEditorProps;
  editor: OfferingEditorState;
}): ReactElement {
  const { props: p, editor } = props;
  const { form, update } = editor;
  const section = {
    form,
    update,
    labels: p.labels,
    errors: useTranslatedErrors(editor.errors),
    isReadOnly: !p.canWrite,
  };
  const uploader = useImageUploader(p.organizationId);
  return (
    <>
      <EditorBasics {...section} categories={p.categories} uploader={uploader} />
      <EditorPrice {...section} unitNames={p.unitNames} currencySymbol={p.currencySymbol} />
      <EditorDetails {...section} currencySymbol={p.currencySymbol} />
      <EditorVariants
        {...section}
        currencySymbol={p.currencySymbol}
        originalRows={p.initial.rows}
      />
      <ModifierGroupPicker props={p} form={form} update={update} />
      <CustomFieldsSection
        idPrefix="offering-custom"
        organizationId={p.organizationId}
        props={p.customFields}
        form={editor.custom}
      />
      {form.offeringId ? (
        <EditorBranches
          organizationId={p.organizationId}
          offeringId={form.offeringId}
          locations={p.locations}
          variants={savedVariantsOf(form, p.labels["field.price"])}
          currency={p.currency}
          labels={p.labels}
          isReadOnly={!p.canWrite}
        />
      ) : null}
    </>
  );
}

/** The create and edit form of an offering, one page of titled sections (13-UX 4.1a). Loaded lazily by the route. */
export default function OfferingEditor(props: OfferingEditorProps): ReactElement {
  const editor = useOfferingEditor({
    organizationId: props.organizationId,
    orgSlug: props.orgSlug,
    initial: props.initial,
    currency: props.currency,
    customFields: props.customFields,
  });
  const { labels } = props;
  const isEdit = props.initial.offeringId !== undefined;
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void editor.submit("save");
      }}
    >
      <EditorSections props={props} editor={editor} />
      <FailureNotice
        failure={editor.failure}
        labels={labels}
        orgSlug={props.orgSlug}
        onReload={editor.reload}
      />
      {props.canWrite ? (
        <StickyActionBar label={labels["editor.actions"]}>
          <Button type="submit" isLoading={editor.isSaving}>
            {isEdit ? labels["editor.save"] : labels["editor.saveDraft"]}
          </Button>
          {props.canPublish && props.status !== "ACTIVE" ? (
            <Button
              variant="secondary"
              disabled={editor.isSaving}
              onClick={() => void editor.submit("publish")}
            >
              {isEdit ? labels["editor.publish"] : labels["editor.saveAndPublish"]}
            </Button>
          ) : null}
          {isEdit && props.canArchive && props.status !== "ARCHIVED" ? (
            <ArchiveButton props={props} version={editor.form.version ?? 0} />
          ) : null}
        </StickyActionBar>
      ) : null}
    </form>
  );
}
