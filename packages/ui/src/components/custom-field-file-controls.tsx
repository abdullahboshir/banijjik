import type { ReactElement } from "react";
import type { CustomFieldControlProps } from "./custom-field-controls.js";
import { FileInput } from "./file-input.js";
import { ImageInput } from "./image-input.js";

/** The IMAGE control of the custom field form. Without upload support it draws nothing. */
export function ImageControl(props: CustomFieldControlProps): ReactElement {
  const { files } = props;
  if (files === undefined) return <></>;
  return (
    <ImageInput
      id={props.inputId}
      previewUrl={files.previewUrlOf(props.value)}
      onPick={(file) => files.onPick(props.fieldKey, file)}
      onClear={props.isRequired ? undefined : () => files.onClear(props.fieldKey)}
      isUploading={files.isUploading(props.fieldKey)}
      error={props.error}
      disabled={props.disabled}
      labels={files.imageLabels}
      sendsCredentials={files.sendsCredentials}
    />
  );
}

/** The FILE control of the custom field form (PDF documents). */
export function FileControl(props: CustomFieldControlProps): ReactElement {
  const { files } = props;
  if (files === undefined) return <></>;
  return (
    <FileInput
      id={props.inputId}
      hasFile={typeof props.value === "string" && props.value !== ""}
      href={files.hrefOf(props.value)}
      onPick={(file) => files.onPick(props.fieldKey, file)}
      onClear={props.isRequired ? undefined : () => files.onClear(props.fieldKey)}
      isUploading={files.isUploading(props.fieldKey)}
      error={props.error}
      disabled={props.disabled}
      labels={files.fileLabels}
    />
  );
}
