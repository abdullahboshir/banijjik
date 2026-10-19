"use client";

import { ImageInput } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { useExpenseAttachments } from "./use-expense-attachments";

/** Attachment pickers for the expense sheet (purpose ATTACHMENT). */
export function ExpenseAttachmentFields(props: {
  label: string;
  fileIds: readonly string[];
  attachments: ReturnType<typeof useExpenseAttachments>;
}): ReactElement {
  const { t } = useTranslator();
  const { attachments } = props;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-secondary">{props.label}</p>
      {props.fileIds.map((fileId) => (
        <ImageInput
          key={fileId}
          id={`expense-attachment-${fileId}`}
          previewUrl={attachments.previewUrlOf(fileId)}
          onPick={() => undefined}
          onClear={() => attachments.remove(fileId)}
          isUploading={false}
          labels={attachments.imageLabels}
          sendsCredentials
        />
      ))}
      {attachments.canAddMore ? (
        <ImageInput
          id="expense-attachment-new"
          previewUrl={undefined}
          onPick={attachments.upload}
          isUploading={attachments.isUploading}
          error={attachments.uploadError ? t(attachments.uploadError) : undefined}
          labels={attachments.imageLabels}
          sendsCredentials
        />
      ) : null}
    </div>
  );
}
