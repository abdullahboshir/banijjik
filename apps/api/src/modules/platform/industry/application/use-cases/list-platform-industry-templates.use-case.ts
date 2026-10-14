import type { PlatformIndustryTemplateSummary } from "@banijjik/contracts";
import type {
  IndustryTemplateListQuery,
  IndustryTemplateRepository,
} from "../ports/industry-template-repository.js";
import { toIndustryTemplateSummary } from "./industry-template-presenter.js";

export interface IndustryTemplateSummaryPage {
  readonly items: readonly PlatformIndustryTemplateSummary[];
  readonly hasNext: boolean;
}

export class ListPlatformIndustryTemplatesUseCase {
  constructor(private readonly templates: IndustryTemplateRepository) {}

  async execute(query: IndustryTemplateListQuery): Promise<IndustryTemplateSummaryPage> {
    const page = await this.templates.list(query);
    return { items: page.items.map(toIndustryTemplateSummary), hasNext: page.hasNext };
  }
}
