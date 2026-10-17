import { LoaderCircle, X, type LucideIcon } from "lucide-react";
import { useRef, type ChangeEvent, type ReactElement } from "react";
import { cn } from "../lib/cn.js";
import { formFieldMessageId } from "./form.js";

export interface PickerButtonsProps {
  readonly id: string;
  /** What the browser file dialog offers. The API checks the real content; this only narrows the list. */
  readonly accept: string;
  readonly icon: LucideIcon;
  /** The pick button text for the current state (choose, change or uploading). */
  readonly pickLabel: string;
  readonly removeLabel: string;
  readonly isUploading: boolean;
  readonly isDisabled: boolean;
  readonly error: string | undefined;
  readonly onFile: (file: File) => void;
  /** The remove button shows only when this is set. */
  readonly onClear: (() => void) | undefined;
}

const BUTTON_CLASS =
  "inline-flex min-h-11 items-center gap-2 rounded-sm px-3 text-body disabled:opacity-50";

/**
 * The hidden file box, the pick button and the optional remove button shared by ImageInput and
 * FileInput. Both buttons are 44 px high; the box is emptied after a pick so the same file can be
 * chosen again after an error.
 */
export function PickerButtons(props: PickerButtonsProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = props.icon;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file !== undefined) props.onFile(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        id={props.id}
        type="file"
        accept={props.accept}
        className="sr-only"
        disabled={props.isDisabled}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? formFieldMessageId(props.id, "error") : undefined}
        onChange={handleChange}
      />
      <button
        type="button"
        disabled={props.isDisabled}
        onClick={() => inputRef.current?.click()}
        className={cn(BUTTON_CLASS, "border border-default bg-surface text-primary")}
      >
        {props.isUploading ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Icon aria-hidden="true" className="size-4" />
        )}
        {props.pickLabel}
      </button>
      {props.onClear === undefined ? null : (
        <button
          type="button"
          disabled={props.isDisabled}
          onClick={props.onClear}
          className={cn(BUTTON_CLASS, "text-danger")}
        >
          <X aria-hidden="true" className="size-4" />
          {props.removeLabel}
        </button>
      )}
    </div>
  );
}
