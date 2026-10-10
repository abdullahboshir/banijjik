# core/iam: users and sessions

The login identity of a person: register, log in, rotate sessions, log out, read and edit the own profile.
A platform super admin can be seeded from the environment.

- **Entities:** `User`, `RefreshSession`, `PlatformOperator` (09 section 4.1) and `Role` (09 section 4.5), all in the platform database.
- **Public API** (`index.ts`): `registerIamModels`, `buildIamRouters`, `buildEnsurePlatformAdminUseCase`, `iamManifest`,
  and for organization creation and listing: `buildProvisionSystemRolesUseCase`, `buildRoleKeyReader`, `buildReadUserProfileUseCase`.
- **Endpoints** (`/api/v1`): `POST /auth/register|login|refresh|logout|logout-all`, `GET|PATCH /me`.
- **Passwords:** argon2id (OWASP parameters); length 8 to 128 (NFC), not like the name, email or phone.
- **Tokens:** access JWT (HS256, 15 min, audience `admin`) and an opaque refresh token (30 days sliding, 90 days
  per login family), both in httpOnly SameSite=Lax cookies. Only the refresh token hash is stored.
- **Rotation:** a refresh token works once. Reuse after 10 seconds revokes its whole family.
- **Rate limits:** login 5 per identifier and 30 per IP per 15 min, register 10 per IP per hour, refresh 60 per IP per 15 min.
- **Events:** declares `iam.user.registered`; nothing is emitted until the event bus (card 1.5).
- **Roles:** creating an organization provisions the six system roles (`OWNER`, `MANAGER`, `CASHIER`, `STAFF`, `RIDER`, `VIEWER`) with no permission keys yet.
- **Permissions:** none yet (permission templates and checks arrive with card 1.4).
- **Not here:** OTP, email/SMS verification, password reset, MFA, platform login (cards 5.13, 6.1, 6.3, 1.8).
