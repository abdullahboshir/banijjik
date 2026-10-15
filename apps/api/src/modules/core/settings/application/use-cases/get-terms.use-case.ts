import type { TermView } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { IndustryTermsReader } from "../ports/industry-terms-reader.js";
import { mergeTermViews } from "../merge-terms.js";
import type { TermOverrideRepository } from "../ports/term-override-repository.js";

export class GetTermsUseCase {
  constructor(
    private readonly templateTerms: IndustryTermsReader,
    private readonly overrides: TermOverrideRepository,
  ) {}

  async execute(organizationId: OrganizationId): Promise<readonly TermView[]> {
    const [template, rows] = await Promise.all([
      this.templateTerms.forOrganization(organizationId),
      this.overrides.list(),
    ]);
    return mergeTermViews(template, rows);
  }
}
