import { CONTACT_STATUS } from "@banijjik/contracts/contact";
import { asId, type ContactId, type CustomerAccountId } from "@banijjik/ids";
import { Router, type RequestHandler } from "express";
import type { StorefrontConfig } from "../../../config/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { CustomerAccountStatusReader } from "../../../kernel/auth/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { ContactWriteDependencies } from "./application/contact-dependencies.js";
import type { CustomerAuthDependencies } from "./application/customer-auth-dependencies.js";
import type { ContactCustomFieldReader } from "./application/ports/custom-field-ports.js";
import type { SensitiveValueAccess } from "./application/ports/custom-field-ports.js";
import type { CustomerDataExportParticipant } from "./application/ports/customer-participants.js";
import type { CustomerErasureParticipant } from "./application/ports/customer-participants.js";
import type { CustomerAccessTokenIssuer } from "./application/ports/customer-account-ports.js";
import type { ContactRoleCatalog } from "./application/ports/settings-and-locations.js";
import type { DedupeModeReader } from "./application/ports/settings-and-locations.js";
import type { HomeLocationLookup } from "./application/ports/settings-and-locations.js";
import {
  BlockCustomerAccountUseCase,
  GetCustomerAccountUseCase,
  UnblockCustomerAccountUseCase,
} from "./application/use-cases/customer-account-staff.use-cases.js";
import {
  GetStorefrontMeUseCase,
  LogoutCustomerUseCase,
  RefreshCustomerSessionUseCase,
} from "./application/use-cases/customer-session.use-cases.js";
import {
  AnonymizeContactUseCase,
  ArchiveContactUseCase,
} from "./application/use-cases/end-contact.use-cases.js";
import {
  findOrCreateInlineContact,
  type InlineContactCreate,
} from "./application/inline-contact-creator.js";
import { CreateContactUseCase } from "./application/use-cases/create-contact.use-case.js";
import { GetContactUseCase } from "./application/use-cases/get-contact.use-case.js";
import { ListContactsUseCase } from "./application/use-cases/list-contacts.use-case.js";
import { SendCustomerEraseOtpUseCase } from "./application/use-cases/send-customer-erase-otp.use-case.js";
import { EraseOwnCustomerAccountUseCase } from "./application/use-cases/erase-own-customer-account.use-case.js";
import { ExportCustomerDataUseCase } from "./application/use-cases/export-customer-data.use-case.js";
import { SendCustomerOtpUseCase } from "./application/use-cases/send-customer-otp.use-case.js";
import { UpdateContactUseCase } from "./application/use-cases/update-contact.use-case.js";
import { VerifyCustomerOtpUseCase } from "./application/use-cases/verify-customer-otp.use-case.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";
import { MongoCustomerAccountRepository } from "./infrastructure/mongo-customer-account.repository.js";
import { MongoCustomerSessionRepository } from "./infrastructure/mongo-customer-session.repository.js";
import { MongoOtpChallengeRepository } from "./infrastructure/mongo-otp-challenge.repository.js";
import { ContactController } from "./presentation/contact.controller.js";
import { buildContactStorefrontRouter } from "./presentation/contact-storefront.router.js";
import { buildContactTenantRouter } from "./presentation/contact-tenant.router.js";
import { CustomerAccountStaffController } from "./presentation/customer-account-staff.controller.js";
import { buildCustomerAccountStaffRouter } from "./presentation/customer-account-staff.router.js";
import { CustomerAuthController } from "./presentation/customer-auth.controller.js";
import { CustomerCookies } from "./presentation/customer-cookies.js";

export { contactManifest } from "./module.manifest.js";
export { buildContactBillToReader } from "./infrastructure/contact-bill-to-reader.js";
export { registerContactModels } from "./infrastructure/register-contact-models.js";
export { buildSalesContactReader } from "./sales-contact-reader.js";
export { buildCustomerAccountBlocker } from "./customer-account-blocker.js";
export { buildCustomerSmsNotifier, registerContactEventHandlers } from "./customer-sms-notifier.js";
export type { ContactCustomFieldReader } from "./application/ports/custom-field-ports.js";
export type { SensitiveValueAccess } from "./application/ports/custom-field-ports.js";
export type { CustomerDataExportParticipant } from "./application/ports/customer-participants.js";
export type { CustomerErasureParticipant } from "./application/ports/customer-participants.js";
export type { CustomerErasureResult } from "./application/ports/customer-participants.js";
export type { CustomerAccessTokenIssuer } from "./application/ports/customer-account-ports.js";
export type { CustomerSmsNotifier } from "./application/ports/customer-account-ports.js";
export type { OtpMessageComposer } from "./application/ports/customer-account-ports.js";
export type { ContactRoleCatalog } from "./application/ports/settings-and-locations.js";
export type { DedupeModeReader } from "./application/ports/settings-and-locations.js";
export type { HomeLocationLookup } from "./application/ports/settings-and-locations.js";

export interface ContactTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly customFields: ContactCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly dedupeModes: DedupeModeReader;
  readonly locations: HomeLocationLookup;
  readonly roleCatalog: ContactRoleCatalog;
}

/** Composition root: repository, use cases and router are wired here and nowhere else. */
export function buildContactRouter(dependencies: ContactTenantDependencies): Router {
  const contacts = new MongoContactRepository();
  const accounts = new MongoCustomerAccountRepository();
  const sessions = new MongoCustomerSessionRepository();
  const unitOfWork = new MongoUnitOfWork();
  const write: ContactWriteDependencies = {
    contacts,
    unitOfWork,
    events: kernelEventPublisher,
    customerAccounts: accounts,
    customerSessions: sessions,
    ...dependencies,
  };
  const withLocations = { ...write, locations: dependencies.locations };
  const controller = new ContactController({
    listContacts: new ListContactsUseCase(contacts),
    getContact: new GetContactUseCase({
      contacts,
      customFields: dependencies.customFields,
      sensitiveAccess: dependencies.sensitiveAccess,
    }),
    createContact: new CreateContactUseCase(withLocations),
    updateContact: new UpdateContactUseCase(withLocations),
    archiveContact: new ArchiveContactUseCase(write),
    anonymizeContact: new AnonymizeContactUseCase(write),
  });
  const staff = {
    accounts,
    sessions,
    unitOfWork,
    events: kernelEventPublisher,
    ...dependencies,
  };
  const accountController = new CustomerAccountStaffController({
    getAccount: new GetCustomerAccountUseCase(staff),
    blockAccount: new BlockCustomerAccountUseCase(staff),
    unblockAccount: new UnblockCustomerAccountUseCase(staff),
  });
  return Router({ mergeParams: true })
    .use(
      buildCustomerAccountStaffRouter({
        accounts: accountController,
        permission: dependencies.permission,
      }),
    )
    .use(
      buildContactTenantRouter({
        contacts: controller,
        permission: dependencies.permission,
        idempotency: dependencies.idempotency,
      }),
    );
}

export interface ContactStorefrontDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly tokens: CustomerAccessTokenIssuer;
  readonly storefront: Pick<StorefrontConfig, "otpSecret">;
  readonly isSecureCookies: boolean;
  readonly accessTokenSeconds: number;
  readonly requireCustomerLogin: RequestHandler;
  readonly authenticateCustomer: RequestHandler;
  readonly contactFields: ContactCustomFieldReader;
  readonly erasureParticipants: readonly CustomerErasureParticipant[];
  readonly exportParticipants: readonly CustomerDataExportParticipant[];
}

/** The customer sign-in routes (card M.1). */
export function buildContactStorefrontRouterFor(
  dependencies: ContactStorefrontDependencies,
): Router {
  const { clock } = dependencies;
  const accounts = new MongoCustomerAccountRepository();
  const contacts = new MongoContactRepository();
  const auth: CustomerAuthDependencies = {
    contacts,
    accounts,
    sessions: new MongoCustomerSessionRepository(),
    challenges: new MongoOtpChallengeRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    otpSecret: dependencies.storefront.otpSecret,
    ...dependencies,
  };
  const controller = new CustomerAuthController({
    sendOtp: new SendCustomerOtpUseCase(auth),
    verifyOtp: new VerifyCustomerOtpUseCase(auth),
    refresh: new RefreshCustomerSessionUseCase(auth),
    logout: new LogoutCustomerUseCase(auth),
    me: new GetStorefrontMeUseCase(auth),
    sendEraseOtp: new SendCustomerEraseOtpUseCase(auth),
    eraseAccount: new EraseOwnCustomerAccountUseCase(auth),
    dataExport: new ExportCustomerDataUseCase(auth),
    cookies: new CustomerCookies({
      isSecure: dependencies.isSecureCookies,
      accessTokenTtlSeconds: dependencies.accessTokenSeconds,
    }),
    clock,
  });
  return buildContactStorefrontRouter({
    auth: controller,
    limiter: dependencies.limiter,
    requireCustomerLogin: dependencies.requireCustomerLogin,
    authenticateCustomer: dependencies.authenticateCustomer,
  });
}

/** Whether a customer account is ACTIVE; read in the business's tenant context by authenticateCustomer. */
export function buildCustomerAccountStatusReader(): CustomerAccountStatusReader {
  const accounts = new MongoCustomerAccountRepository();
  return {
    isActive: async (customerAccountId) =>
      (await accounts.findById(asId<CustomerAccountId>(customerAccountId)))?.isActive() ?? false,
  };
}

export { buildCustomerPhoneReader } from "./customer-phone-reader.js";

export interface InlineContactCreator {
  findOrCreateByPhone(input: InlineContactCreate): Promise<ContactId>;
  isActive(contactId: ContactId): Promise<boolean>;
}
export interface CustomerAccountLookup {
  exists(id: CustomerAccountId): Promise<boolean>;
  findById(id: CustomerAccountId): Promise<{ contactId: string; phoneE164: string } | undefined>;
}
export interface ContactLookup {
  findActiveByPhone(phone: string): Promise<{ contactId: string } | undefined>;
  findActiveByEmail(email: string): Promise<{ contactId: string } | undefined>;
}

/** Inline `{ create: { name, phone } }` creator for another module's request body (card 3.6). */
export function buildInlineContactCreator(dependencies: {
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}): InlineContactCreator {
  const write = {
    contacts: new MongoContactRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
  };
  return {
    findOrCreateByPhone: (input: InlineContactCreate) =>
      findOrCreateInlineContact({ ...write, ...dependencies }, input),
    isActive: async (contactId: ContactId) =>
      (await write.contacts.findById(contactId))?.status === CONTACT_STATUS.ACTIVE,
  };
}

/** Tenant-scoped existence check, for modules that reference a customer account by id. */
export function buildCustomerAccountLookup(): CustomerAccountLookup {
  const accounts = new MongoCustomerAccountRepository();
  return {
    exists: async (id: CustomerAccountId) =>
      (await accounts.findById(asId<CustomerAccountId>(id))) !== undefined,
    findById: async (id: CustomerAccountId) => {
      const a = await accounts.findById(asId<CustomerAccountId>(id));
      return a ? { contactId: a.contactId, phoneE164: a.phoneE164 } : undefined;
    },
  };
}

export function buildContactLookup(): ContactLookup {
  const contacts = new MongoContactRepository();
  return {
    findActiveByPhone: async (phone: string) => {
      const c = await contacts.findActiveByPhone(phone);
      return c ? { contactId: c.contactId } : undefined;
    },
    findActiveByEmail: async (email: string) => {
      const c = await contacts.findActiveByEmail(email);
      return c ? { contactId: c.contactId } : undefined;
    },
  };
}

export {
  buildMongoGuestSessionProvisionalLinkPort,
  buildProvisionalGuestContactCreator,
  type ProvisionalGuestContactCreatorOptions,
} from "./guest-contact-creator.js";
export {
  CreateProvisionalGuestContactUseCase,
  type CreateProvisionalGuestContactDependencies,
} from "./application/use-cases/create-provisional-guest-contact.use-case.js";
export {
  buildProvisionalContact,
  type BuildProvisionalContactResult,
} from "./domain/provisional-contact.js";
export type {
  GuestSessionProvisionalLinkPort,
  GuestSessionRecord,
  LinkProvisionalContactInput,
  ProvisionalGuestContactCreator,
} from "./application/ports/guest-contact-ports.js";
