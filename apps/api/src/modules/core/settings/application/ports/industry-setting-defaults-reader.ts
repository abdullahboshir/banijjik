export interface IndustrySettingDefaults {
  readonly templateVersion: number;
  readonly settingsDefaults: Readonly<Record<string, unknown>>;
}

/** The template defaults of the organization's industry template. Implemented by platform/industry. */
export interface IndustrySettingDefaultsReader {
  read(organizationId: string): Promise<IndustrySettingDefaults | undefined>;
}
