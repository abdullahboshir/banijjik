export function discountFor(organization: { industry: string }): number {
  switch (organization.industry) {
    case "SALON":
      return 5;
    default:
      return 0;
  }
}
