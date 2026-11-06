"use client";

import type { ReactElement } from "react";
import { FormField, TextInput } from "@banijjik/ui";
import type { AdminDeliveryAddress } from "./new-order-submit";
import type { OrderLabels } from "./order-labels";

export interface NewOrderDeliveryFieldsProps {
  readonly address: AdminDeliveryAddress | null | undefined;
  readonly labels: OrderLabels;
  readonly isSaving: boolean;
  readonly onChange: (field: string, value: string) => void;
}

const EMPTY_DELIVERY_ADDRESS: AdminDeliveryAddress = {
  recipientName: "",
  phone: "",
  addressLine: "",
  districtCode: "dhaka",
  areaCode: "",
  postalCode: "",
};

interface SubFieldsProps {
  readonly current: AdminDeliveryAddress;
  readonly labels: OrderLabels;
  readonly isSaving: boolean;
  readonly onChange: (field: string, value: string) => void;
}

function DeliveryDistrictAreaFields(props: SubFieldsProps): ReactElement {
  const { current, labels, isSaving, onChange } = props;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormField label={labels.newOrder.districtCode} htmlFor="delivery-district">
        <TextInput
          id="delivery-district"
          value={current.districtCode}
          disabled={isSaving}
          onChange={(e) => onChange("districtCode", e.target.value)}
        />
      </FormField>
      <FormField label={labels.newOrder.areaCode} htmlFor="delivery-area" required>
        <TextInput
          id="delivery-area"
          value={current.areaCode}
          disabled={isSaving}
          onChange={(e) => onChange("areaCode", e.target.value)}
        />
      </FormField>
      <FormField label={labels.newOrder.postalCode} htmlFor="delivery-postal">
        <TextInput
          id="delivery-postal"
          value={current.postalCode ?? ""}
          disabled={isSaving}
          onChange={(e) => onChange("postalCode", e.target.value)}
        />
      </FormField>
    </div>
  );
}

export function NewOrderDeliveryFields(props: NewOrderDeliveryFieldsProps): ReactElement {
  const { address, labels, isSaving, onChange } = props;
  const current = address ?? EMPTY_DELIVERY_ADDRESS;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-default p-3">
      <h3 className="text-body font-semibold text-primary">{labels.newOrder.deliveryAddress}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={labels.newOrder.recipientName} htmlFor="delivery-name" required>
          <TextInput
            id="delivery-name"
            value={current.recipientName}
            disabled={isSaving}
            onChange={(e) => onChange("recipientName", e.target.value)}
          />
        </FormField>
        <FormField label={labels.newOrder.recipientPhone} htmlFor="delivery-phone" required>
          <TextInput
            id="delivery-phone"
            value={current.phone}
            disabled={isSaving}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </FormField>
      </div>
      <FormField label={labels.newOrder.addressLine} htmlFor="delivery-address" required>
        <TextInput
          id="delivery-address"
          value={current.addressLine}
          disabled={isSaving}
          onChange={(e) => onChange("addressLine", e.target.value)}
        />
      </FormField>
      <DeliveryDistrictAreaFields
        current={current}
        labels={labels}
        isSaving={isSaving}
        onChange={onChange}
      />
    </div>
  );
}
