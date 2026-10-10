# @banijjik/validation

Request schemas (Zod) shared by API and frontend (ADR-012). Every request body, query and param is validated here.

- `uuidV7Schema`: any domain ID (UUID v7).
- `normalizePhoneToE164`, `phoneE164Schema`, `emailSchema`, `loginIdentifierSchema`: identifier rules for phone (E.164) and email.
- `userRegisterRequestSchema`, `loginRequestSchema`, `meUpdateRequestSchema`: bodies of the iam auth endpoints.
