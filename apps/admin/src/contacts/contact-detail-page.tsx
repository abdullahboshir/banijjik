import {
  CURRENCY_CODE,
  CUSTOM_FIELD_TYPE,
  PERMISSION_KEY,
  type ContactRole,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import type { ContactResponse } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import {
  DetailHeader,
  EmptyState,
  PageSection,
  StatusBadge,
  formatPhoneForDisplay,
} from "@banijjik/ui";
import { fieldAppliesToContactRoles } from "@banijjik/validation";
import Link from "next/link";
import type { ReactElement } from "react";
import { ContactCredits } from "../credit/contact-credits";
import { CustomFieldDetailList } from "../custom-fields/custom-field-detail-list";
import type { LinkedContacts } from "../custom-fields/custom-field-display";
import { customFieldPartsOf } from "../custom-fields/custom-field-parts";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ContactActions } from "./contact-actions";
import { ContactAddresses } from "./contact-addresses";
import { ContactFormButton } from "./contact-form-button";
import {
  canSeeSensitiveContactDetails,
  contactFormSheetPropsOf,
  contactWordsOf,
} from "./contact-form-props";
import { contactTermOf, roleLabelOf, type ContactWords } from "./contact-labels";
import { addressLabelsOf, contactActionLabelsOf } from "./contact-detail-labels";
import { WebsiteLogin } from "./website-login";

function Fact(props: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-small text-secondary">{props.label}</dt>
      <dd className="break-words text-body text-primary">{props.children}</dd>
    </div>
  );
}

function PhoneLink({ phone }: { phone: string }): ReactElement {
  return (
    <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center text-brand underline">
      {formatPhoneForDisplay(phone)}
    </a>
  );
}

function ContactFacts(props: { contact: ContactResponse; words: ContactWords }): ReactElement {
  const { contact, words } = props;
  const { t } = words;
  const phones = [contact.phoneE164, ...contact.additionalPhonesE164].filter(
    (phone): phone is string => phone !== null,
  );
  return (
    <dl className="grid gap-4 md:grid-cols-3">
      <Fact label={t("contacts.detail.roles")}>
        {contact.contactRoles.map((role) => roleLabelOf(role, words)).join(", ")}
      </Fact>
      {phones.length > 0 ? (
        <Fact label={t("contacts.detail.phones")}>
          <>
            {phones.map((phone) => (
              <PhoneLink key={phone} phone={phone} />
            ))}
          </>
        </Fact>
      ) : null}
      {contact.email ? <Fact label={t("contacts.detail.email")}>{contact.email}</Fact> : null}
      {contact.tagKeys.length > 0 ? (
        <Fact label={t("contacts.detail.tags")}>{contact.tagKeys.join(", ")}</Fact>
      ) : null}
    </dl>
  );
}

function RelationList(props: {
  contact: ContactResponse;
  basePath: string;
  t: Translator["t"];
}): ReactElement {
  const { contact, basePath, t } = props;
  if (contact.relations.length === 0) {
    return <p className="text-body text-secondary">{t("contacts.relations.empty")}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {contact.relations.map((relation) => (
        <li key={`${relation.relationKey}-${relation.relatedContactId}`}>
          <Link
            href={`${basePath}/${relation.relatedContactId}`}
            className="flex min-h-11 items-center rounded-md border border-default bg-surface p-3 text-body text-primary"
          >
            {t(`contacts.relation.${relation.relationKey}`, {
              name: relation.relatedContactName ?? t("contacts.noName"),
            })}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function isContactLinkField(field: EffectiveCustomField): boolean {
  return (
    field.fieldType === CUSTOM_FIELD_TYPE.REFERENCE &&
    field.referenceEntity === "contact" &&
    field.link !== undefined
  );
}

/** The contacts that contact-link fields point to, with the pages that show them. */
async function loadLinkedContacts(
  fields: readonly EffectiveCustomField[],
  contact: ContactResponse,
  access: OrgAccess,
): Promise<LinkedContacts> {
  const ids = fields
    .filter(isContactLinkField)
    .map((field) => contact.customFields[field.fieldKey])
    .filter((value): value is string => typeof value === "string");
  const { organizationId, slug } = access.organization;
  const linked = await Promise.all(
    ids.map(async (id) => {
      const result = await fetchBusinessResource<ContactResponse>(
        `/orgs/${organizationId}/contacts/${id}`,
      );
      return [id, { name: result.data.name ?? "", href: `/${slug}/contacts/${id}` }] as const;
    }),
  );
  return Object.fromEntries(linked);
}

/** The contact fields that apply to the contact's roles; a field limited to other roles is not shown (ADR-113). */
function fieldsForRoles(
  fields: readonly EffectiveCustomField[],
  roles: readonly ContactRole[],
): EffectiveCustomField[] {
  return fields.filter((field) => fieldAppliesToContactRoles(field, roles));
}

interface Abilities {
  canEdit: boolean;
  canArchive: boolean;
  canAnonymize: boolean;
}

function abilitiesOf(access: OrgAccess, contact: ContactResponse): Abilities {
  const { permissions } = access.config;
  const may = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  const isActive = contact.status === "ACTIVE";
  return {
    canEdit: isActive && may(PERMISSION_KEY.CONTACT_CONTACT_UPDATE),
    canArchive: isActive && may(PERMISSION_KEY.CONTACT_CONTACT_ARCHIVE),
    canAnonymize: contact.anonymizedAt === null && may(PERMISSION_KEY.CONTACT_CONTACT_ANONYMIZE),
  };
}

function Notices(props: { contact: ContactResponse; t: Translator["t"] }): ReactElement | null {
  const { contact, t } = props;
  if (contact.anonymizedAt !== null) {
    return <p className="text-body text-secondary">{t("contacts.detail.erased")}</p>;
  }
  if (contact.status === "ARCHIVED") {
    return <p className="text-body text-secondary">{t("contacts.detail.archivedNote")}</p>;
  }
  return null;
}

/** Everything the page shows, read once on the server. */
interface DetailData {
  contact: ContactResponse;
  words: ContactWords;
  parts: ReturnType<typeof customFieldPartsOf>;
  linkedContacts: LinkedContacts;
  abilities: Abilities;
}

async function loadDetailData(
  access: OrgAccess,
  translator: Translator,
  contactId: string,
): Promise<DetailData> {
  const { organizationId } = access.organization;
  const { data: contact } = await fetchBusinessResource<ContactResponse>(
    `/orgs/${organizationId}/contacts/${contactId}`,
  );
  const fields = fieldsForRoles(access.config.fields["contact"] ?? [], contact.contactRoles);
  const linkedContacts = await loadLinkedContacts(fields, contact, access);
  const parts = customFieldPartsOf({
    fields,
    values: contact.customFields,
    canSeeSensitive: canSeeSensitiveContactDetails(access),
    translator,
    timeZone: access.timeZone,
    currencyCode: CURRENCY_CODE.BDT,
    linkedContacts,
  });
  return {
    contact,
    words: contactWordsOf(access, translator),
    parts,
    linkedContacts,
    abilities: abilitiesOf(access, contact),
  };
}

function DetailActions(props: {
  access: OrgAccess;
  translator: Translator;
  data: DetailData;
}): ReactElement {
  const { access, translator, data } = props;
  const { t } = translator;
  const { contact, abilities } = data;
  return (
    <ContactActions
      organizationId={access.organization.organizationId}
      contactId={contact.contactId}
      version={contact.version}
      actions={[
        ...(abilities.canArchive ? (["archive"] as const) : []),
        ...(abilities.canAnonymize ? (["anonymize"] as const) : []),
      ]}
      editButton={
        abilities.canEdit ? (
          <ContactFormButton
            label={t("contacts.action.edit")}
            variant="secondary"
            sheetProps={contactFormSheetPropsOf({
              access,
              translator,
              contact,
              linkedContacts: data.linkedContacts,
            })}
          />
        ) : null
      }
      groupLabel={t("contacts.action.group")}
      archiveLabel={t("contacts.action.archive")}
      anonymizeLabel={t("contacts.action.anonymize")}
      labels={contactActionLabelsOf(t)}
    />
  );
}

function DetailHead(props: {
  data: DetailData;
  basePath: string;
  t: Translator["t"];
}): ReactElement {
  const { contact, words } = props.data;
  const { t } = props;
  return (
    <>
      <DetailHeader
        title={contact.name ?? t("contacts.noName")}
        backHref={props.basePath}
        backLabel={t("contacts.detail.back", { term: contactTermOf(words) })}
        status={
          <StatusBadge
            requestType="CONTACT"
            status={contact.status}
            label={t(`contacts.status.${contact.status}`)}
          />
        }
      />
      <Notices contact={contact} t={t} />
      <ContactFacts contact={contact} words={words} />
    </>
  );
}

/** `/{orgSlug}/contacts/{contactId}`: key facts, details, addresses, relations and the actions (13-UX section 4.2). */
export async function ContactDetailPage({
  orgSlug,
  contactId,
}: {
  orgSlug: string;
  contactId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.CONTACT_CONTACT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const data = await loadDetailData(access, translator, contactId);
  const { contact, abilities } = data;
  const basePath = `/${orgSlug}/contacts`;
  return (
    <div className="flex flex-col gap-6">
      <DetailHead data={data} basePath={basePath} t={t} />
      <CustomFieldDetailList {...data.parts.list} />
      <ContactAddresses
        organizationId={access.organization.organizationId}
        contactId={contact.contactId}
        version={contact.version}
        addresses={contact.addresses}
        canEdit={abilities.canEdit}
        labels={addressLabelsOf(t)}
      />
      <PageSection title={t("contacts.relations.title")} help={t("contacts.relations.help")}>
        <RelationList contact={contact} basePath={basePath} t={t} />
      </PageSection>
      <WebsiteLogin access={access} contact={contact} translator={translator} />
      <ContactCredits access={access} contact={contact} translator={translator} />
      <DetailActions access={access} translator={translator} data={data} />
    </div>
  );
}
