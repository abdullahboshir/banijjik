"use client";
import type { ReactElement } from "react";

import { STORE_CREDIT_DIRECTION, type StoreCreditDirection } from "@banijjik/contracts/payment";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import { useState } from "react";
import type { StoreCreditProps } from "./store-credit-types";
import type { useStoreCreditAdjustment } from "./use-store-credit-adjustment";

export function StoreCreditAdjustForm(
  props: StoreCreditProps & { adjustment: ReturnType<typeof useStoreCreditAdjustment> },
): ReactElement {
  const { labels, adjustment } = props;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<StoreCreditDirection>(STORE_CREDIT_DIRECTION.CREDIT);
  const [locationId, setLocationId] = useState(props.locations[0]?.locationId ?? "");
  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-default p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void adjustment.open({ amount, reason, direction, locationId });
      }}
    >
      <h3 className="font-semibold">{labels.adjust}</h3>
      <DirectionField labels={labels} direction={direction} setDirection={setDirection} />
      <FormField label={labels.amount} htmlFor="store-credit-amount">
        <TextInput
          id="store-credit-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </FormField>
      <FormField label={labels.reason} htmlFor="store-credit-reason">
        <TextInput
          id="store-credit-reason"
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      <FormField label={labels.location} htmlFor="store-credit-location">
        <Select
          id="store-credit-location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
      {adjustment.error && !adjustment.pending ? <p role="alert">{adjustment.error}</p> : null}
      {adjustment.notice ? <p role="status">{adjustment.notice}</p> : null}
      <Button type="submit" disabled={props.locations.length === 0} isLoading={adjustment.busy}>
        {labels.save}
      </Button>
    </form>
  );
}

function DirectionField({
  labels,
  direction,
  setDirection,
}: {
  labels: StoreCreditProps["labels"];
  direction: StoreCreditDirection;
  setDirection: (value: StoreCreditDirection) => void;
}): ReactElement {
  return (
    <FormField label={labels.direction} htmlFor="store-credit-direction">
      <Select
        id="store-credit-direction"
        value={direction}
        onChange={(event) =>
          setDirection(
            event.target.value === STORE_CREDIT_DIRECTION.DEBIT
              ? STORE_CREDIT_DIRECTION.DEBIT
              : STORE_CREDIT_DIRECTION.CREDIT,
          )
        }
      >
        <option value={STORE_CREDIT_DIRECTION.CREDIT}>{labels.credit}</option>
        <option value={STORE_CREDIT_DIRECTION.DEBIT}>{labels.debit}</option>
      </Select>
    </FormField>
  );
}
