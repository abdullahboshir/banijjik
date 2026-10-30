"use client";

import type { CheckoutFulfillment } from "@banijjik/contracts/website";
import type { Translator } from "@banijjik/i18n";
import { FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";

export type CartDeliveryAddress = NonNullable<CheckoutFulfillment["address"]>;

function methodLabelKey(method: "PICKUP" | "COURIER" | "OWN_RIDER"): string {
  if (method === "PICKUP") return "storefront.cart.pickup";
  if (method === "COURIER") return "storefront.cart.courier";
  return "storefront.cart.ownRider";
}

const METHODS = ["PICKUP", "COURIER", "OWN_RIDER"] as const;

function DistrictAreaInputs({
  address,
  t,
  onChange,
}: {
  readonly address: CartDeliveryAddress;
  readonly t: Translator["t"];
  readonly onChange: (field: keyof CartDeliveryAddress, val: string) => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <FormField label={t("storefront.cart.district")} htmlFor="delivery-district">
        <Select
          id="delivery-district"
          value={address.districtCode || "dhaka"}
          onChange={(e) => onChange("districtCode", e.target.value)}
        >
          <option value="dhaka">{t("storefront.cart.districtDhaka")}</option>
          <option value="chattogram">{t("storefront.cart.districtChattogram")}</option>
          <option value="sylhet">{t("storefront.cart.districtSylhet")}</option>
          <option value="rajshahi">{t("storefront.cart.districtRajshahi")}</option>
        </Select>
      </FormField>
      <FormField label={t("storefront.cart.area")} htmlFor="delivery-area">
        <TextInput
          id="delivery-area"
          name="areaCode"
          value={address.areaCode || ""}
          onChange={(e) => onChange("areaCode", e.target.value)}
        />
      </FormField>
      <FormField label={t("storefront.cart.postalCode")} htmlFor="delivery-postal">
        <TextInput
          id="delivery-postal"
          name="postalCode"
          value={address.postalCode ?? ""}
          onChange={(e) => onChange("postalCode", e.target.value)}
        />
      </FormField>
    </div>
  );
}

function DeliveryAddressFields({
  address,
  t,
  onChange,
}: {
  readonly address: CartDeliveryAddress;
  readonly t: Translator["t"];
  readonly onChange: (field: keyof CartDeliveryAddress, val: string) => void;
}): ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
      <h3 className="text-body font-semibold text-primary">
        {t("storefront.cart.deliveryAddress")}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t("storefront.cart.recipientName")} htmlFor="delivery-name" required>
          <TextInput
            id="delivery-name"
            name="recipientName"
            value={address.recipientName}
            onChange={(e) => onChange("recipientName", e.target.value)}
          />
        </FormField>
        <FormField label={t("storefront.cart.recipientPhone")} htmlFor="delivery-phone" required>
          <TextInput
            id="delivery-phone"
            name="phone"
            type="tel"
            value={address.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </FormField>
      </div>
      <FormField label={t("storefront.cart.addressLine")} htmlFor="delivery-address" required>
        <TextInput
          id="delivery-address"
          name="addressLine"
          value={address.addressLine}
          onChange={(e) => onChange("addressLine", e.target.value)}
        />
      </FormField>
      <DistrictAreaInputs address={address} t={t} onChange={onChange} />
    </div>
  );
}

export function CartFulfillmentOptions({
  fulfillmentMethod,
  deliveryAddress,
  t,
  onMethodChange,
  onAddressChange,
}: {
  readonly fulfillmentMethod: "PICKUP" | "COURIER" | "OWN_RIDER";
  readonly deliveryAddress: CartDeliveryAddress;
  readonly t: Translator["t"];
  readonly onMethodChange: (m: "PICKUP" | "COURIER" | "OWN_RIDER") => void;
  readonly onAddressChange: (field: keyof CartDeliveryAddress, val: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-4">
      <h2 className="text-title font-semibold text-primary">{t("storefront.cart.fulfillment")}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {METHODS.map((method) => {
          const isSelected = fulfillmentMethod === method;
          const labelKey = methodLabelKey(method);
          const borderClass = isSelected
            ? "border-brand bg-brand/5 font-semibold text-primary"
            : "border-default text-secondary";
          return (
            <label
              key={method}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border p-3 ${borderClass}`}
            >
              <input
                type="radio"
                name="fulfillment"
                value={method}
                checked={isSelected}
                onChange={() => onMethodChange(method)}
                className="h-4 w-4 text-brand"
              />
              {t(labelKey)}
            </label>
          );
        })}
      </div>

      {fulfillmentMethod !== "PICKUP" ? (
        <DeliveryAddressFields address={deliveryAddress} t={t} onChange={onAddressChange} />
      ) : null}
    </div>
  );
}
