export function readKey(organization: Record<string, string>): string | undefined {
  return organization["industryTemplateKey"];
}
