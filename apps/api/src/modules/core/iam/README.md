# core/iam: users, sessions and roles

The login identity of a person: register, log in, rotate sessions, log out, read and edit the own profile.
A platform super admin can be seeded from the environment.

- **Entities:** `User`, `RefreshSession`, `PlatformOperator` (09 section 4.1) and `Role` (09 section 4.5), all in the platform database.
- **Public API** (`index.ts`): `registerIamModels`, `buildIamRouters`, `buildEnsurePlatformAdminUseCase`, `iamManifest`,
  for organization creation and listing: `buildProvisionSystemRolesUseCase`, `buildRoleKeyReader`, `buildReadUserProfileUseCase`,
  and for the permission check: `buildPermissionCatalog`, `buildPermissionGate`, `buildIamTenantRouter` (all wired in `routes/v1.ts`).
- **Endpoints** (`/api/v1`): `POST /auth/register|login|refresh|logout|logout-all`, `GET|PATCH /me`; under `/orgs/{organizationId}`: `GET|POST /roles`, `PATCH /roles/{roleId}`, `POST /roles/{roleId}/archive`.
- **Passwords:** argon2id (OWASP parameters); length 8 to 128 (NFC), not like the name, email or phone.
- **Tokens:** access JWT (HS256, 15 min, audience `admin`) and an opaque refresh token (30 days sliding, 90 days
  per login family), both in httpOnly SameSite=Lax cookies. Only the refresh token hash is stored.
- **Rotation:** a refresh token works once. Reuse after 10 seconds revokes its whole family.
- **Rate limits:** login 5 per identifier and 30 per IP per 15 min, register 10 per IP per hour, refresh 60 per IP per 15 min.
- **Events:** declares `iam.user.registered`; nothing is emitted until the event bus (card 1.5).
- **Roles:** creating an organization provisions the six system roles (`OWNER`, `MANAGER`, `CASHIER`, `STAFF`, `RIDER`, `VIEWER`). They store no permission keys: the keys come from the code template `domain/system-role-grants.ts` (10 section 10), OWNER always has the whole catalogue. An organization can add custom roles (`roleKey` `custom.<roleId>`, unique ACTIVE name, status `ACTIVE | ARCHIVED`). System roles are immutable (`422 SYSTEM_ROLE_IMMUTABLE`); a role an ACTIVE member holds cannot be archived (`422 ROLE_IN_USE`). Every role change bumps `Organization.rolesVersion` in the same transaction.
- **Permissions:** the iam and organization manifests declare their keys (contracts `PERMISSION_KEY`). `PermissionCatalog` is built at startup from the manifests and throws on an unknown, misplaced, malformed or duplicate key. A route guards itself with `permission(key)` (kernel, ADR-088): 403 when the key is granted nowhere, otherwise the request continues with `allowedLocationIds` narrowed to the locations that grant it.
- **Key-less read:** reading the own organization profile needs no permission; every active member may read it (so VIEWER "R (profile)" in 10 section 10 is not a key).
- **Cache:** `PermissionCache` port with an in-process LRU adapter (10 000 entries, 10 minutes). The key holds member version, roles version and catalogue hash, all read fresh per request, so it is never stale (Redis adapter: card 1.5).
- **Not here:** OTP, email/SMS verification, password reset, MFA, platform login (cards 5.13, 6.1, 6.3, 1.8).
