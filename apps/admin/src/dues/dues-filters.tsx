import type { ReactElement } from "react";
import type { ContactListItem } from "@banijjik/contracts/contact";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import type { Translator } from "@banijjik/i18n";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { DuesQuery } from "./dues-api";

export function DuesFilters(props: {
  query: DuesQuery;
  contacts: readonly ContactListItem[];
  contactSearch: string;
  t: Translator["t"];
}): ReactElement {
  const { query, t } = props;
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2">
      <FormField label={t("contacts.search.label")} htmlFor="dues-search">
        <TextInput id="dues-search" name="contactSearch" defaultValue={props.contactSearch} />
      </FormField>
      <FormField label={t("dues.contact")} htmlFor="dues-contact">
        <Select id="dues-contact" name="contactId" defaultValue={query.contactId ?? ""}>
          <option value="">{t("dues.all")}</option>
          {props.contacts.map((contact) => (
            <option key={contact.contactId} value={contact.contactId}>
              {contact.name ?? contact.phoneE164 ?? contact.contactId}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={t("dues.type")} htmlFor="dues-type">
        <Select id="dues-type" name="requestType" defaultValue={query.requestType ?? ""}>
          <option value="">{t("dues.all")}</option>
          {Object.values(PAYMENT_REQUEST_TYPE).map((type) => (
            <option key={type} value={type}>
              {t(`dues.type.${type}`)}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit">{t("dues.apply")}</Button>
    </form>
  );
}
