export function isFood(organization: { industry: string }): boolean {
  return ["restaurant", "bakery"].includes(organization.industry);
}
