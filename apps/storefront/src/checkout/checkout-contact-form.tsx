"use client";

import type { Translator } from "@banijjik/i18n";
import { Button, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";

function ContactInputs({
  contactName,
  contactPhone,
  t,
  onNameChange,
  onPhoneChange,
}: {
  readonly contactName: string;
  readonly contactPhone: string;
  readonly t: Translator["t"];
  readonly onNameChange: (v: string) => void;
  readonly onPhoneChange: (v: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={t("storefront.checkout.nameLabel")} htmlFor="checkout-name" required>
        <TextInput
          id="checkout-name"
          name="name"
          value={contactName}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </FormField>

      <FormField
        label={t("storefront.checkout.phoneLabel")}
        htmlFor="checkout-phone"
        hint={t("storefront.checkout.phoneHint")}
        required
      >
        <TextInput
          id="checkout-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          value={contactPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          required
        />
      </FormField>
    </>
  );
}

export function CheckoutContactForm({
  contactName,
  contactPhone,
  isSubmitting,
  errorMessage,
  disabled,
  t,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: {
  readonly contactName: string;
  readonly contactPhone: string;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
  readonly disabled: boolean;
  readonly t: Translator["t"];
  readonly onNameChange: (v: string) => void;
  readonly onPhoneChange: (v: string) => void;
  readonly onSubmit: () => void;
}): ReactElement {
  return (
    <form
      className="flex flex-col gap-5 rounded-lg border border-default bg-surface p-6 lg:col-span-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <h2 className="text-title font-semibold text-primary">
        {t("storefront.checkout.contactTitle")}
      </h2>

      <ContactInputs
        contactName={contactName}
        contactPhone={contactPhone}
        t={t}
        onNameChange={onNameChange}
        onPhoneChange={onPhoneChange}
      />

      {errorMessage ? (
        <p role="alert" className="text-body text-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          className="min-h-11 w-full text-base font-semibold"
          isLoading={isSubmitting}
          disabled={disabled}
        >
          {t("storefront.checkout.placeOrder")}
        </Button>
      </div>
    </form>
  );
}
