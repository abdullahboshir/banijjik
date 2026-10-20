/** Pure helpers for the reject form (reason required; final reasons marked). */

export function canSubmitReject(reasonKeys: readonly string[]): boolean {
  return reasonKeys.length > 0;
}

export function toggleReasonKey(selected: readonly string[], reasonKey: string): readonly string[] {
  if (selected.includes(reasonKey)) return selected.filter((key) => key !== reasonKey);
  return [...selected, reasonKey];
}
