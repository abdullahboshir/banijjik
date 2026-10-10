export function isGym(organization: { industryTemplateKey: string }): boolean {
  return organization.industryTemplateKey === "GYM";
}
