"use client";

import { newId } from "@banijjik/ids";
import { Button, ContactLinkInput, FormField, Textarea } from "@banijjik/ui";
import type { ReactElement } from "react";
import { LazyOrderQuotePanel } from "./lazy-order-quote-panel";
import { OrderDiscountFields } from "./order-discount-fields";
import { searchContactChoices } from "./order-contact";
import type { OrderEditSheetProps } from "./order-edit-sheet";
import { OrderLinesEditor } from "./order-lines-editor";
import { emptyOrderLine } from "./order-lines";
import type { OrderEditForm } from "./use-order-edit-form";

type BodyProps = OrderEditSheetProps & { readonly form: OrderEditForm };

function ignoreQuote(): void {
  // The panel shows the totals; the save action takes a fresh quote for the approval amount.
}

function EditContactField(props: BodyProps): ReactElement {
  const { form, labels, order } = props;
  return (
    <FormField
      label={labels.newOrder.contact}
      htmlFor="edit-order-contact"
      {...(form.errors.contact === undefined ? {} : { error: form.errors.contact })}
    >
      <ContactLinkInput
        id="edit-order-contact"
        value={form.values.contact}
        onChange={(contact) => form.setValues({ contact })}
        search={(text) => searchContactChoices(props.organizationId, text, form.contactNames)}
        nameOf={(contactId) =>
          contactId === order.contactId ? props.contactName : form.contactNames.get(contactId)
        }
        labels={labels.contact}
        disabled={form.isSaving}
      />
    </FormField>
  );
}

function EditLines(props: BodyProps): ReactElement {
  const { form, labels } = props;
  return (
    <>
      {form.lines.length === 0 ? (
        <p className="text-body text-secondary">{labels.edit.noLines}</p>
      ) : (
        <OrderLinesEditor
          organizationId={props.organizationId}
          lines={form.lines}
          modifierGroups={props.modifierGroups}
          unitLabels={props.unitLabels}
          currency={props.currency}
          locale={props.locale}
          labels={labels.line}
          performers={
            props.performersEnabled
              ? { locationId: props.order.locationId, labels: labels.line }
              : undefined
          }
          disabled={form.isSaving}
          onChange={form.setLines}
        />
      )}
      <Button
        variant="secondary"
        disabled={form.isSaving}
        onClick={() => form.setLines([...form.lines, emptyOrderLine(newId())])}
      >
        {labels.newOrder.addLine}
      </Button>
    </>
  );
}

function EditTotals(props: BodyProps): ReactElement {
  const { form, labels } = props;
  return (
    <>
      {form.lineInputs.length > 0 ? (
        <LazyOrderQuotePanel
          organizationId={props.organizationId}
          locationId={props.order.locationId}
          lines={form.lineInputs}
          orderDiscount={form.discountInvalid ? undefined : form.nextDiscount}
          currency={props.currency}
          locale={props.locale}
          labels={labels.quote}
          onQuote={ignoreQuote}
        />
      ) : null}
      {form.errors.totals === undefined ? null : (
        <p role="alert" className="text-body text-danger">
          {form.errors.totals}
        </p>
      )}
      {form.errors.message === undefined ? null : (
        <p role="alert" className="text-body text-danger">
          {form.errors.message}
        </p>
      )}
    </>
  );
}

function EditForm(props: BodyProps): ReactElement {
  const { form, labels } = props;
  return (
    <>
      <EditContactField {...props} />
      <EditLines {...props} />
      <OrderDiscountFields
        idPrefix="edit-order"
        labels={labels}
        type={form.values.discountType}
        text={form.values.discountText}
        isInvalid={form.discountInvalid}
        disabled={form.isSaving}
        onChange={(next) => form.setValues({ discountType: next.type, discountText: next.text })}
      />
      <FormField label={labels.newOrder.note} htmlFor="edit-order-note">
        <Textarea
          id="edit-order-note"
          value={form.values.note}
          disabled={form.isSaving}
          onChange={(event) => form.setValues({ note: event.target.value })}
        />
      </FormField>
      <EditTotals {...props} />
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          disabled={form.isSaving}
          onClick={() => props.onOpenChange(false)}
        >
          {labels.edit.close}
        </Button>
        <Button isLoading={form.isSaving} onClick={() => void form.save()}>
          {labels.edit.save}
        </Button>
      </div>
    </>
  );
}

/** The sheet's content: a loading note, a load failure, or the form once the stored products are in. */
export function OrderEditBody(props: BodyProps): ReactElement | null {
  const { form, labels } = props;
  if (form.drafts.isLoading) {
    return <p className="text-body text-secondary">{labels.quote.calculating}</p>;
  }
  if (form.drafts.loadFailed) {
    return (
      <p role="alert" className="text-body text-danger">
        {labels.line.loadFailed}
      </p>
    );
  }
  return <EditForm {...props} />;
}
