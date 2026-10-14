/** Events of the custom-field module (`<module>.<entity>.<pastTenseVerb>`). */
export const CUSTOM_FIELD_EVENT_TYPE = Object.freeze({
  DEFINITION_CHANGED: "custom-field.definition.changed",
} as const);

export type CustomFieldEventType =
  (typeof CUSTOM_FIELD_EVENT_TYPE)[keyof typeof CUSTOM_FIELD_EVENT_TYPE];
