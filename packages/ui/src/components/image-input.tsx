import { ImagePlus } from "lucide-react";
import type { ReactElement } from "react";
import { PickerButtons } from "./picker-buttons.js";

/** What the browser file dialog offers. The API checks the real content; this only narrows the list. */
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export interface ImageInputLabels {
  /** Button text when no image is chosen. */
  readonly choose: string;
  /** Button text when an image is already chosen. */
  readonly change: string;
  readonly remove: string;
  readonly uploading: string;
  /** Alternative text of the preview. */
  readonly previewAlt: string;
}

export interface ImageInputProps {
  readonly id: string;
  /** Where the current image can be shown; undefined when nothing is chosen. */
  readonly previewUrl: string | undefined;
  readonly onPick: (file: File) => void;
  readonly onClear?: (() => void) | undefined;
  readonly isUploading: boolean;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels: ImageInputLabels;
  /** The preview needs the session cookie (a private image on another origin). */
  readonly sendsCredentials?: boolean | undefined;
}

function pickLabel(labels: ImageInputLabels, isUploading: boolean, hasImage: boolean): string {
  if (isUploading) return labels.uploading;
  return hasImage ? labels.change : labels.choose;
}

/**
 * Picks one image. It knows nothing about the API: the caller uploads in `onPick` and passes back
 * the preview address, the uploading state and any error message.
 */
export function ImageInput(props: ImageInputProps): ReactElement {
  const { previewUrl, isUploading, labels } = props;
  const hasImage = previewUrl !== undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hasImage ? (
        <img
          src={previewUrl}
          alt={labels.previewAlt}
          crossOrigin={props.sendsCredentials ? "use-credentials" : undefined}
          className="h-24 w-24 rounded-sm border border-default object-cover"
        />
      ) : null}
      <PickerButtons
        id={props.id}
        accept={ACCEPTED_IMAGE_TYPES}
        icon={ImagePlus}
        pickLabel={pickLabel(labels, isUploading, hasImage)}
        removeLabel={labels.remove}
        isUploading={isUploading}
        isDisabled={props.disabled === true || isUploading}
        error={props.error}
        onFile={props.onPick}
        onClear={hasImage ? props.onClear : undefined}
      />
    </div>
  );
}
