# custom-field

Organization and industry custom fields (ADR-102).

Industry fields stay on the industry template. An organization can hide, rename or reorder one that is not required. Organization-made fields live in `custom_field_definitions` (at most 50 active per entity type) and are archived, never deleted.

`EffectiveCustomFieldReader.forEntity` returns the industry fields first, then the active organization fields. Phase 3 modules import that reader through this module's `index.ts` and validate stored values with `buildCustomFieldValuesSchema` from `@banijjik/validation`.
