import { FileUp } from "lucide-react";
import type { ReactElement } from "react";
import { PickerButtons } from "./picker-buttons.js";

/** The only document type the API takes. It checks the real content; this only narrows the dialog. */
const ACCEPTED_DOCUMENT_TYPES = "application/pdf";

export interface FileInputLabels {
  readonly choose: string;
  readonly change: string;
  readonly remove: string;
  readonly uploading: string;
  /** Shown while a file is attached, e.g. "File attached". */
  readonly attached: string;
}

export interface FileInputProps {
  readonly id: string;
  /** True when a file is chosen. The component never sees the file itself. */
  readonly hasFile: boolean;
  /** A link to open or download the chosen file, when the caller has one. */
  readonly href?: string | undefined;
  readonly onPick: (file: File) => void;
  readonly onClear?: (() => void) | undefined;
  readonly isUploading: boolean;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels: FileInputLabels;
}

function pickLabel(labels: FileInputLabels, isUploading: boolean, hasFile: boolean): string {
  if (isUploading) return labels.uploading;
  return hasFile ? labels.change : labels.choose;
}

function AttachedNote(props: { href: string | undefined; text: string }): ReactElement {
  if (props.href === undefined) return <p className="break-words text-body">{props.text}</p>;
  return (
    <p className="break-words text-body">
      <a href={props.href} className="text-primary underline" rel="noopener noreferrer">
        {props.text}
      </a>
    </p>
  );
}

/**
 * Picks one PDF. Like ImageInput it has no API knowledge: the caller uploads in `onPick` and passes
 * back the state. A chosen file is shown as a short note, with a link when the caller gives one.
 */
export function FileInput(props: FileInputProps): ReactElement {
  const { hasFile, isUploading, labels } = props;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hasFile ? <AttachedNote href={props.href} text={labels.attached} /> : null}
      <PickerButtons
        id={props.id}
        accept={ACCEPTED_DOCUMENT_TYPES}
        icon={FileUp}
        pickLabel={pickLabel(labels, isUploading, hasFile)}
        removeLabel={labels.remove}
        isUploading={isUploading}
        isDisabled={props.disabled === true || isUploading}
        error={props.error}
        onFile={props.onPick}
        onClear={hasFile ? props.onClear : undefined}
      />
    </div>
  );
}
