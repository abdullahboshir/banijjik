"use client";

import { useState, type ReactElement } from "react";
import { Button } from "./button.js";
import { Dialog, DialogContent } from "./dialog.js";
import { FormField, Select, TextInput } from "./form.js";

export interface ApprovalPinApproverOption {
  readonly memberId: string;
  readonly displayName: string;
  readonly hasPin: boolean;
}

export interface ApprovalPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  approverLabel: string;
  pinLabel: string;
  submitLabel: string;
  cancelLabel: string;
  closeLabel: string;
  lockedMessage: string;
  approvers: readonly ApprovalPinApproverOption[];
  errorMessage?: string;
  isLocked?: boolean;
  isSubmitting?: boolean;
  onSubmit: (input: { approverMemberId: string; pin: string }) => void;
}

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"] as const;

/**
 * Manager PIN entry for the same device. No API knowledge: the host loads approvers and calls
 * onSubmit (card 3.4b).
 */
export function ApprovalPinDialog(props: ApprovalPinDialogProps): ReactElement {
  const [approverMemberId, setApproverMemberId] = useState(props.approvers[0]?.memberId ?? "");
  const [pin, setPin] = useState("");
  const disabled = props.isLocked === true || props.isSubmitting === true;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent title={props.title} closeLabel={props.closeLabel}>
        <ApproverField
          label={props.approverLabel}
          value={approverMemberId}
          approvers={props.approvers}
          disabled={disabled}
          onChange={setApproverMemberId}
        />
        <PinField label={props.pinLabel} value={pin} disabled={disabled} onChange={setPin} />
        <PhoneKeypad disabled={disabled} onDigit={appendPinDigit(setPin)} />
        <ApprovalStatus
          isLocked={props.isLocked === true}
          lockedMessage={props.lockedMessage}
          errorMessage={props.errorMessage}
        />
        <ApprovalActions
          cancelLabel={props.cancelLabel}
          submitLabel={props.submitLabel}
          disabled={disabled || approverMemberId.length === 0 || pin.length < 4}
          onCancel={() => props.onOpenChange(false)}
          onSubmit={() => props.onSubmit({ approverMemberId, pin })}
        />
      </DialogContent>
    </Dialog>
  );
}

function appendPinDigit(setPin: (updater: (current: string) => string) => void) {
  return (digit: string): void => {
    if (digit === "") return;
    if (digit === "⌫") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => (current.length >= 8 ? current : `${current}${digit}`));
  };
}

function ApproverField(props: {
  label: string;
  value: string;
  approvers: readonly ApprovalPinApproverOption[];
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor="approval-approver">
      <Select
        id="approval-approver"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        disabled={props.disabled}
      >
        {props.approvers.map((approver) => (
          <option key={approver.memberId} value={approver.memberId}>
            {approver.displayName}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function PinField(props: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <FormField label={props.label} htmlFor="approval-pin">
      <TextInput
        id="approval-pin"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
        disabled={props.disabled}
      />
    </FormField>
  );
}

function PhoneKeypad(props: { disabled: boolean; onDigit: (digit: string) => void }): ReactElement {
  return (
    <div className="grid grid-cols-3 gap-2 sm:hidden" data-testid="approval-keypad">
      {KEYPAD_DIGITS.map((digit, index) =>
        digit === "" ? (
          <span key={`empty-${String(index)}`} />
        ) : (
          <Button
            key={digit === "⌫" ? "backspace" : digit}
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={props.disabled}
            onClick={() => props.onDigit(digit)}
          >
            {digit}
          </Button>
        ),
      )}
    </div>
  );
}

function ApprovalStatus(props: {
  isLocked: boolean;
  lockedMessage: string;
  errorMessage?: string;
}): ReactElement | null {
  if (props.isLocked) {
    return (
      <p className="text-small text-danger" role="alert">
        {props.lockedMessage}
      </p>
    );
  }
  if (props.errorMessage === undefined) return null;
  return (
    <p className="text-small text-danger" role="alert">
      {props.errorMessage}
    </p>
  );
}

function ApprovalActions(props: {
  cancelLabel: string;
  submitLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={props.onCancel}>
        {props.cancelLabel}
      </Button>
      <Button variant="primary" disabled={props.disabled} onClick={props.onSubmit}>
        {props.submitLabel}
      </Button>
    </div>
  );
}
