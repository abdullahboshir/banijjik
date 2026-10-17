import { LoaderCircle } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Button } from "./button.js";

/** Ids of the hint and error messages, so inputs can point `aria-describedby` at them. */
export function formFieldMessageId(htmlFor: string, kind: "hint" | "error"): string {
  return `${htmlFor}-${kind}`;
}

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: FormFieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-small font-semibold text-primary">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={formFieldMessageId(htmlFor, "hint")} className="text-small text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={formFieldMessageId(htmlFor, "error")}
          role="alert"
          className="text-small text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Body-size (16 pixel) input text stops iOS Safari from zooming on focus. */
const INPUT_CLASS =
  "w-full rounded-sm border border-default bg-surface px-3 text-body text-primary placeholder:text-muted aria-[invalid=true]:border-danger disabled:opacity-50";

export function TextInput({ className, ...props }: ComponentProps<"input">): ReactElement {
  return <input className={cn(INPUT_CLASS, "min-h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">): ReactElement {
  return <textarea className={cn(INPUT_CLASS, "min-h-24 py-2", className)} {...props} />;
}

/** A native select: the best picker on mobile. */
export function Select({ className, ...props }: ComponentProps<"select">): ReactElement {
  return <select className={cn(INPUT_CLASS, "min-h-11", className)} {...props} />;
}

export interface CheckboxProps extends Omit<ComponentProps<"input">, "type"> {
  label: string;
}

export function Checkbox({ label, className, ...props }: CheckboxProps): ReactElement {
  return (
    <label className={cn("flex min-h-11 items-center gap-3 text-body text-primary", className)}>
      <input type="checkbox" className="size-5 accent-brand" {...props} />
      <span>{label}</span>
    </label>
  );
}

export interface SubmitBarProps {
  cancelLabel: string;
  submitLabel: string;
  isSubmitting: boolean;
  onCancel?: () => void;
}

/** Sticky bottom bar: the save button stays reachable with the keyboard open (13-UX section 4.3). */
export function SubmitBar({
  cancelLabel,
  submitLabel,
  isSubmitting,
  onCancel,
}: SubmitBarProps): ReactElement {
  return (
    <div className="sticky bottom-0 z-sticky -mx-4 flex gap-3 border-t border-default bg-surface p-4 md:-mx-6 md:px-6">
      <Button variant="secondary" className="flex-1" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" className="flex-1" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}
