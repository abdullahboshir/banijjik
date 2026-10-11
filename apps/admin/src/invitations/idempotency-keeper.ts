export interface KeyedSubmit {
  key: string;
  /** The submitted body as text: the same text means the same submit. */
  fingerprint: string;
}

/**
 * The Idempotency-Key of a submit. A retry of the same submit (same body, the first attempt did not succeed)
 * must carry the same key, so the API never creates the invitation twice; a different body, or a new submit
 * after a success, gets a new key. The caller forgets the previous submit once it succeeded.
 */
export function keyForSubmit(
  previous: KeyedSubmit | undefined,
  fingerprint: string,
  makeKey: () => string,
): KeyedSubmit {
  if (previous && previous.fingerprint === fingerprint) return previous;
  return { key: makeKey(), fingerprint };
}
