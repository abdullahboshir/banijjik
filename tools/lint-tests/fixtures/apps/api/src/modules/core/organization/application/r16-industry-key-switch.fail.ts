export function labelOf(organization: { industryTemplateKey: string }): string {
  switch (organization.industryTemplateKey) {
    case "GYM":
      return "gym";
    default:
      return "other";
  }
}
