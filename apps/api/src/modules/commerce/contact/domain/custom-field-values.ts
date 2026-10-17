/** One searchable value of a custom field, lower-cased by the writer (the attribute pattern of ADR-102). */
export interface CustomFieldSearchEntry {
  readonly fieldKey: string;
  readonly value: string;
}

/** The custom field values a contact stores, with the entries that make the searchable ones findable (ADR-015). */
export interface StoredCustomFields {
  readonly values: Readonly<Record<string, unknown>>;
  readonly search: readonly CustomFieldSearchEntry[];
}
