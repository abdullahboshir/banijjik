import type { EffectiveCustomField } from "@banijjik/contracts";
import {
  CUSTOMER_DATA_EXPORT_MAX_ROWS,
  CUSTOMER_DATA_EXPORT_SECTION_KEY,
  type CustomerAccountExportData,
  type CustomerContactExportData,
  type CustomerDataExportResponse,
  type CustomerDataExportSection,
  type CustomerDataExportSectionKey,
} from "@banijjik/contracts/contact";
import type { CustomerAccountId, OrganizationId } from "@banijjik/ids";
import type { Contact } from "../../domain/contact.entity.js";
import type { CustomerAccount } from "../../domain/customer-account.entity.js";
import { otpInvalid } from "../../domain/errors.js";
import type { CustomerAuthDependencies } from "../customer-auth-dependencies.js";

export interface ExportCustomerDataInput {
  readonly organizationId: OrganizationId;
  readonly customerAccountId: CustomerAccountId;
}

function toAccountExport(account: CustomerAccount): CustomerAccountExportData {
  return {
    customerAccountId: account.customerAccountId,
    phoneE164: account.phoneE164,
    createdAt: account.createdAt.toISOString(),
    lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
  };
}

/** Only values whose definition shows on the storefront; a key with no definition is dropped. */
function storefrontVisibleValues(
  stored: Readonly<Record<string, unknown>>,
  fields: readonly EffectiveCustomField[],
): Record<string, unknown> {
  const visible = new Set(
    fields.filter((field) => field.visibility.storefront).map((field) => field.fieldKey),
  );
  return Object.fromEntries(Object.entries(stored).filter(([fieldKey]) => visible.has(fieldKey)));
}

function toContactExport(
  contact: Contact | undefined,
  fields: readonly EffectiveCustomField[],
): CustomerContactExportData | null {
  if (contact === undefined) return null;
  return {
    contactId: contact.contactId,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phoneE164: contact.phoneE164 ?? null,
    additionalPhonesE164: contact.additionalPhonesE164,
    addresses: contact.addresses,
    customFields: storefrontVisibleValues(contact.customFields, fields),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export type ExportCustomerDataDependencies = Pick<
  CustomerAuthDependencies,
  "accounts" | "contacts" | "clock" | "exportParticipants" | "contactFields"
>;

/** The one section of this key; a missing participant is a wiring bug, never an empty section. */
function requireSection<Key extends CustomerDataExportSectionKey>(
  sections: readonly CustomerDataExportSection[],
  sectionKey: Key,
): Extract<CustomerDataExportSection, { readonly sectionKey: Key }> {
  const found = sections.find(
    (section): section is Extract<CustomerDataExportSection, { readonly sectionKey: Key }> =>
      section.sectionKey === sectionKey,
  );
  if (found === undefined) throw new Error(`No export participant for section ${sectionKey}`);
  return found;
}

export class ExportCustomerDataUseCase {
  constructor(private readonly dependencies: ExportCustomerDataDependencies) {}

  async execute(input: ExportCustomerDataInput): Promise<CustomerDataExportResponse> {
    const { accounts, contacts, clock, exportParticipants, contactFields } = this.dependencies;
    const account = await accounts.findById(input.customerAccountId);
    if (account === undefined) throw otpInvalid();

    const contact = await contacts.findById(account.contactId);
    const fields = await contactFields.forContacts(input.organizationId);
    const sections: CustomerDataExportSection[] = [];
    for (const participant of exportParticipants) {
      sections.push(
        await participant.exportForAccount({
          organizationId: input.organizationId,
          customerAccountId: input.customerAccountId,
          maxRows: CUSTOMER_DATA_EXPORT_MAX_ROWS,
        }),
      );
    }

    return {
      exportedAt: clock.now().toISOString(),
      account: toAccountExport(account),
      contact: toContactExport(contact, fields),
      sections: {
        LISTING: requireSection(sections, CUSTOMER_DATA_EXPORT_SECTION_KEY.LISTING),
        DIRECTORY_ACTIVITY: requireSection(
          sections,
          CUSTOMER_DATA_EXPORT_SECTION_KEY.DIRECTORY_ACTIVITY,
        ),
        CREDIT: requireSection(sections, CUSTOMER_DATA_EXPORT_SECTION_KEY.CREDIT),
      },
    };
  }
}
