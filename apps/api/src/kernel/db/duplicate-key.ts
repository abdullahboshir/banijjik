const DUPLICATE_KEY_ERROR_CODE = 11000;

function namesIndexField(error: object, indexField: string): boolean {
  if (!("keyPattern" in error)) return false;
  const { keyPattern } = error;
  return typeof keyPattern === "object" && keyPattern !== null && indexField in keyPattern;
}

/**
 * True for the MongoDB driver's duplicate-key error (code 11000). With `indexField` it is true only when
 * that field is part of the violated unique index, so two unique indexes of one collection can be told apart.
 */
export function isDuplicateKeyError(error: unknown, indexField?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("code" in error) || error.code !== DUPLICATE_KEY_ERROR_CODE) return false;
  return indexField === undefined || namesIndexField(error, indexField);
}
