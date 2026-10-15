/** Events of the settings module (`<module>.<entity>.<pastTenseVerb>`). */
export const SETTINGS_EVENT_TYPE = Object.freeze({
  SETTING_CHANGED: "settings.setting.changed",
  TERM_CHANGED: "settings.term.changed",
  MODULE_TOGGLED: "settings.module.toggled",
} as const);

export type SettingsEventType = (typeof SETTINGS_EVENT_TYPE)[keyof typeof SETTINGS_EVENT_TYPE];
