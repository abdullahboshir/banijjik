import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { SynonymEntry, SynonymsResponse } from "@banijjik/contracts/catalog";
import type { OrganizationId, UserId } from "@banijjik/ids";
import { invalidFields, type FieldProblem } from "../../domain/errors.js";
import { foldText } from "../../domain/name-search.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";

const REPEATED_TERM_KEY = "validation.invalid_value";

/** The organization's synonym list (`08 section 4`): a keyed list, read as a whole. */
export class GetSynonymsUseCase {
  constructor(private readonly synonyms: CatalogDependencies["synonyms"]) {}

  async execute(): Promise<SynonymsResponse> {
    return this.synonyms.read();
  }
}

function repeatedTermProblems(entries: readonly SynonymEntry[]): FieldProblem[] {
  const seen = new Set<string>();
  const problems: FieldProblem[] = [];
  entries.forEach((entry, index) => {
    const folded = foldText(entry.term);
    if (seen.has(folded))
      problems.push({ path: `entries.${index}.term`, messageKey: REPEATED_TERM_KEY });
    seen.add(folded);
  });
  return problems;
}

/**
 * Replaces the whole list against the version that was read (0 when there is none yet; 409 when
 * stale). A term may appear once, however it is typed.
 */
export class UpdateSynonymsUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly entries: readonly SynonymEntry[];
    readonly version: number;
  }): Promise<SynonymsResponse> {
    const { synonyms, unitOfWork, audit } = this.dependencies;
    const problems = repeatedTermProblems(input.entries);
    if (problems.length > 0) throw invalidFields(problems);
    return unitOfWork.run(async () => {
      const before = await synonyms.read();
      const saved = await synonyms.write(input.entries, input.version, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.SYNONYMS_UPDATED,
        entityType: AUDIT_ENTITY_TYPE.searchSynonym,
        entityId: input.organizationId,
        changes: {
          termCount: { from: before.entries.length, to: saved.entries.length },
        },
      });
      return saved;
    });
  }
}
