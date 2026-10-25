# commerce/contact

One Contact per real party per organization, named by the business's terms (customer, member,
student, patient). Create, read, list, update, archive and anonymize, with phone-first duplicate
protection and the contact-link field (ADR-110, ADR-073).

- **Class:** `CORE` (10-MODULE-CATALOG section 1).
- **Entities:** `Contact` (tenant DB, versioned, soft-archived, custom fields of entity `contact`); `CustomerAccount`, `CustomerSession` and `OtpChallenge` for the customer's phone-code login to the public site (ADR-119).
- **Public API (`index.ts`):** `contactManifest`, `registerContactModels()`, `buildContactRouter()`, `buildContactStorefrontRouterFor()`, `buildCustomerAccountStatusReader()`, `buildCustomerSmsNotifier()`, `registerContactEventHandlers()`.
- **Endpoints:** `/orgs/{organizationId}/contacts` (14-API.md section 5.2), `/contacts/{contactId}/customer-account[/block|/unblock]` for staff, and `/storefront/orgs/{organizationId}/auth/*`, `/me`, `/my/account/erase*`, `/my/data-export` for customers.
- **Events:** emits `contact.contact.{created,updated,archived,anonymized}`, `contact.customerOtp.requested` (challenge id only) and `contact.customerAccount.{blocked,unblocked,erased}`; consumes none. The handler `contact.sendCustomerOtp` sends the code by SMS through the `SmsSender` port.
- **Permissions:** `contact.contact.{read,create,update,archive,anonymize,readSensitive}`, `contact.customerAccount.{read,block}`.
- **Settings:** `contact.dedupeOn` (`PHONE` or `PHONE_OR_EMAIL`); `contact.customerLogin` (off by default).
- **Erasure and export (M.7):** `EraseOwnCustomerAccountUseCase` needs a fresh `ERASE_ACCOUNT` code (sign-in codes never work for it and the reverse). Other modules take part through the required `CustomerErasureParticipant` and `CustomerDataExportParticipant` ports, wired in `routes/storefront.ts`; they run whatever the module switch says. Everything happens in one transaction.
- **Customer sign-in rules:** the same answer for every phone on send; five guesses per code; a code is never logged, sent in an event or kept readable; a block deletes the sessions; archiving or anonymizing a contact deletes its login.
- **Rules:** one ACTIVE contact per phone (409 with the existing id); an archived contact is
  read-only and frees its phone; audit entries never hold a name, phone, email or address.
- **Ports:** custom fields, sensitive access, dedupe setting and home-location lookup are adapted
  from other modules in `routes/contact-tenant-router.ts`; this module imports none of them.
- **Layers:** `domain` (entity, name folding, errors), `application` (use cases, ports),
  `infrastructure` (schema, repository), `presentation` (controller, router, transformer).
- **Left for later cards:** merge, import, summary projections (3.5 to 3.8), store credit (3.8).
