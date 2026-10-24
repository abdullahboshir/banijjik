import { CONTACT_STATUS } from "@banijjik/contracts/contact";
import { asId, type ContactId, type CustomerAccountId } from "@banijjik/ids";
import { Router, type RequestHandler } from "express";
import type { StorefrontConfig } from "../../../config/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { CustomerAccountStatusReader } from "../../../kernel/auth/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher, registerEventHandler } from "../../../kernel/events/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { ContactWriteDependencies } from "./application/contact-dependencies.js";
import type { CustomerAuthDependencies } from "./application/customer-auth-dependencies.js";
import type {
  ContactCustomFieldReader,
  SensitiveValueAccess,
} from "./application/ports/custom-field-ports.js";
import type {
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
  CustomerErasureResult,
} from "./application/ports/customer-participants.js";
import type {
  CustomerAccessTokenIssuer,
  OtpMessageComposer,
  SmsSender,
} from "./application/ports/customer-account-ports.js";
import type {
  ContactRoleCatalog,
  DedupeModeReader,
  HomeLocationLookup,
} from "./application/ports/settings-and-locations.js";
import { buildSendCustomerOtpSmsHandler } from "./application/send-customer-otp-sms.handler.js";
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
import { DisabledSmsSender, TestInboxSmsSender } from "./infrastructure/sms-senders.js";
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
export type {
  ContactCustomFieldReader,
  ContactRoleCatalog,
  CustomerAccessTokenIssuer,
  CustomerDataExportParticipant,
  CustomerErasureParticipant,
  CustomerErasureResult,
  DedupeModeReader,
  HomeLocationLookup,
  OtpMessageComposer,
  SensitiveValueAccess,
};

export interface ContactTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts. */
  readonly idempotency: RequestHandler;
  /** Adapters over other modules (custom-field, settings, organization), supplied by routes. */
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
    audit: dependencies.audit,
    clock: dependencies.clock,
    customFields: dependencies.customFields,
    sensitiveAccess: dependencies.sensitiveAccess,
    dedupeModes: dependencies.dedupeModes,
    roleCatalog: dependencies.roleCatalog,
    customerAccounts: accounts,
    customerSessions: sessions,
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
    audit: dependencies.audit,
    clock: dependencies.clock,
  };
  const accountController = new CustomerAccountStaffController({
    getAccount: new GetCustomerAccountUseCase(staff),
    blockAccount: new BlockCustomerAccountUseCase(staff),
    unblockAccount: new UnblockCustomerAccountUseCase(staff),
  });
  const router = Router({ mergeParams: true });
  router.use(
    buildCustomerAccountStaffRouter({
      accounts: accountController,
      permission: dependencies.permission,
    }),
  );
  router.use(
    buildContactTenantRouter({
      contacts: controller,
      permission: dependencies.permission,
      idempotency: dependencies.idempotency,
    }),
  );
  return router;
}

export interface ContactStorefrontDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly tokens: CustomerAccessTokenIssuer;
  readonly storefront: Pick<StorefrontConfig, "otpSecret">;
  /** Cookies are Secure everywhere except local development. */
  readonly isSecureCookies: boolean;
  readonly accessTokenSeconds: number;
  /** 404 `storefront_not_available` unless the business switched customer sign-in on. Built by routes. */
  readonly requireCustomerLogin: RequestHandler;
  readonly authenticateCustomer: RequestHandler;
  readonly contactFields: ContactCustomFieldReader;
  readonly erasureParticipants: readonly CustomerErasureParticipant[];
  readonly exportParticipants: readonly CustomerDataExportParticipant[];
}

/** The customer sign-in routes (card M.1). routes/storefront.ts mounts them behind the business pipeline. */
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
    audit: dependencies.audit,
    clock,
    limiter: dependencies.limiter,
    tokens: dependencies.tokens,
    otpSecret: dependencies.storefront.otpSecret,
    contactFields: dependencies.contactFields,
    erasureParticipants: dependencies.erasureParticipants,
    exportParticipants: dependencies.exportParticipants,
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
    async isActive(customerAccountId) {
      const account = await accounts.findById(asId<CustomerAccountId>(customerAccountId));
      return account?.isActive() ?? false;
    },
  };
}

export { buildCustomerPhoneReader } from "./customer-phone-reader.js";

/**
 * The inline `{ create: { name, phone } }` creator for another module's request body (card 3.6's
 * booking sheet): reuses an ACTIVE contact with the phone, creates a CUSTOMER otherwise.
 */
export function buildInlineContactCreator(dependencies: {
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}): {
  findOrCreateByPhone(input: InlineContactCreate): Promise<ContactId>;
  isActive(contactId: ContactId): Promise<boolean>;
} {
  const write = {
    contacts: new MongoContactRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
  };
  return {
    findOrCreateByPhone: (input) => findOrCreateInlineContact({ ...write, ...dependencies }, input),
    isActive: async (contactId) =>
      (await write.contacts.findById(contactId))?.status === CONTACT_STATUS.ACTIVE,
  };
}

/** Tenant-scoped existence check, for modules that reference a customer account by id. */
export function buildCustomerAccountLookup(): {
  exists(customerAccountId: CustomerAccountId): Promise<boolean>;
  findById(
    customerAccountId: CustomerAccountId,
  ): Promise<{ contactId: string; phoneE164: string } | undefined>;
} {
  const accounts = new MongoCustomerAccountRepository();
  return {
    async exists(customerAccountId) {
      const account = await accounts.findById(asId<CustomerAccountId>(customerAccountId));
      return account !== undefined;
    },
    async findById(customerAccountId) {
      const account = await accounts.findById(asId<CustomerAccountId>(customerAccountId));
      if (!account) return undefined;
      return { contactId: account.contactId, phoneE164: account.phoneE164 };
    },
  };
}

export function buildContactLookup(): {
  findActiveByPhone(phoneE164: string): Promise<{ contactId: string } | undefined>;
  findActiveByEmail(email: string): Promise<{ contactId: string } | undefined>;
} {
  const contacts = new MongoContactRepository();
  return {
    async findActiveByPhone(phone) {
      const contact = await contacts.findActiveByPhone(phone);
      return contact ? { contactId: contact.contactId } : undefined;
    },
    async findActiveByEmail(email) {
      const contact = await contacts.findActiveByEmail(email);
      return contact ? { contactId: contact.contactId } : undefined;
    },
  };
}

export interface ContactEventHandlerDependencies {
  readonly storefront: Pick<StorefrontConfig, "otpSecret" | "smsDriver">;
  readonly composer: OtpMessageComposer;
}

function buildSmsSender(driver: StorefrontConfig["smsDriver"]): SmsSender {
  return driver === "test-inbox" ? new TestInboxSmsSender() : new DisabledSmsSender();
}

/** Registers the event handlers of the contact module. The worker calls it before it starts (ADR-090). */
export function registerContactEventHandlers(dependencies: ContactEventHandlerDependencies): void {
  registerEventHandler(
    buildSendCustomerOtpSmsHandler({
      challenges: new MongoOtpChallengeRepository(),
      sender: buildSmsSender(dependencies.storefront.smsDriver),
      composer: dependencies.composer,
      otpSecret: dependencies.storefront.otpSecret,
    }),
  );
}
