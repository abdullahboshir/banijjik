import {
  CUSTOMER_DATA_EXPORT_MAX_ROWS,
  type CreditExportSection,
  type CustomerAccountExportData,
  type CustomerContactExportData,
  type CustomerDataExportResponse,
  type CustomerDataExportSection,
  type DirectoryActivityExportSection,
  type ListingExportSection,
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

function toContactExport(contact: Contact | undefined): CustomerContactExportData | null {
  if (contact === undefined) return null;
  return {
    contactId: contact.contactId,
    name: contact.name ?? null,
    email: contact.email ?? null,
    phoneE164: contact.phoneE164 ?? null,
    additionalPhonesE164: contact.additionalPhonesE164,
    addresses: contact.addresses,
    customFields: contact.customFields,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export class ExportCustomerDataUseCase {
  constructor(private readonly dependencies: CustomerAuthDependencies) {}

  async execute(input: ExportCustomerDataInput): Promise<CustomerDataExportResponse> {
    const { accounts, contacts, clock, exportParticipants } = this.dependencies;
    const account = await accounts.findById(input.customerAccountId);
    if (account === undefined) throw otpInvalid();

    const contact = await contacts.findById(account.contactId);
    const sections: Record<string, CustomerDataExportSection> = {};
    for (const participant of exportParticipants) {
      sections[participant.sectionKey] = await participant.exportForAccount({
        organizationId: input.organizationId,
        customerAccountId: input.customerAccountId,
        maxRows: CUSTOMER_DATA_EXPORT_MAX_ROWS,
      });
    }

    const listing = (sections["LISTING"] as ListingExportSection) ?? {
      sectionKey: "LISTING",
      listing: null,
      truncated: false,
    };
    const directoryActivity = (sections[
      "DIRECTORY_ACTIVITY"
    ] as DirectoryActivityExportSection) ?? {
      sectionKey: "DIRECTORY_ACTIVITY",
      blocks: [],
      blocksTruncated: false,
      reports: [],
      reportsTruncated: false,
      truncated: false,
    };
    const credit = (sections["CREDIT"] as CreditExportSection) ?? {
      sectionKey: "CREDIT",
      balance: 0,
      entries: [],
      entriesTruncated: false,
      unlocks: [],
      unlocksTruncated: false,
      purchases: [],
      purchasesTruncated: false,
      truncated: false,
    };

    return {
      exportedAt: clock.now().toISOString(),
      account: toAccountExport(account),
      contact: toContactExport(contact),
      listing,
      directoryActivity,
      credit,
      sections: { LISTING: listing, DIRECTORY_ACTIVITY: directoryActivity, CREDIT: credit },
    };
  }
}
