# commerce/contact

One Contact per real party per organization, named by the business's terms (customer, member,
student, patient). Create, read, list, update, archive and anonymize, with phone-first duplicate
protection and the contact-link field (ADR-110, ADR-073).

- **Class:** `CORE` (10-MODULE-CATALOG section 1).
- **Entities:** `Contact` (tenant DB, versioned, soft-archived, custom fields of entity `contact`).
- **Public API (`index.ts`):** `contactManifest`, `registerContactModels()`, `buildContactRouter()`.
- **Endpoints:** `/orgs/{organizationId}/contacts` (14-API.md section 5.2).
- **Events:** emits `contact.contact.{created,updated,archived,anonymized}`; consumes none.
- **Permissions:** `contact.contact.{read,create,update,archive,anonymize,readSensitive}`.
- **Setting:** `contact.dedupeOn` (`PHONE` or `PHONE_OR_EMAIL`).
- **Rules:** one ACTIVE contact per phone (409 with the existing id); an archived contact is
  read-only and frees its phone; audit entries never hold a name, phone, email or address.
- **Ports:** custom fields, sensitive access, dedupe setting and home-location lookup are adapted
  from other modules in `routes/contact-tenant-router.ts`; this module imports none of them.
- **Layers:** `domain` (entity, name folding, errors), `application` (use cases, ports),
  `infrastructure` (schema, repository), `presentation` (controller, router, transformer).
- **Left for later cards:** merge, import, summary projections (3.5 to 3.8), store credit (3.8).
