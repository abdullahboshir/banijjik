import type { CustomFieldListQuery, EffectiveCustomField } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type {
  CustomFieldAvailability,
  EffectiveCustomFieldReader,
} from "../ports/custom-field-ports.js";

export interface ListCustomFieldsInput extends CustomFieldListQuery {
  readonly organizationId: OrganizationId;
}

export interface CustomFieldPage {
  readonly items: readonly EffectiveCustomField[];
  readonly hasNext: boolean;
}

/**
 * The effective list. Industry fields are not rows, and an organization has at most 50 active
 * fields, so the page is taken from the merged list in memory.
 */
export class ListCustomFieldsUseCase {
  constructor(
    private readonly availability: CustomFieldAvailability,
    private readonly reader: EffectiveCustomFieldReader,
  ) {}

  async execute(input: ListCustomFieldsInput): Promise<CustomFieldPage> {
    if (!(await this.availability.isOffered(input.entityType))) throw recordNotFound();
    // The management list shows hidden template fields so a business can show them again (ADR-108).
    const fields = await this.reader.forManagement(
      input.organizationId,
      input.entityType,
      input.offeringKind,
    );
    const start = (input.page - 1) * input.limit;
    return {
      items: fields.slice(start, start + input.limit),
      hasNext: start + input.limit < fields.length,
    };
  }
}
