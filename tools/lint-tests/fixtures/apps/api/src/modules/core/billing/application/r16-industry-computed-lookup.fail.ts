const LABELS: Record<string, string> = {};

export function labelOf(organization: { industry: string }): string | undefined {
  return LABELS[organization.industry];
}
