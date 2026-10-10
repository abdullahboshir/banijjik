export interface OrganizationProps {
  readonly industryTemplateKey: string;
}

export function readStoredKey(props: OrganizationProps): OrganizationProps {
  return { industryTemplateKey: props.industryTemplateKey };
}
