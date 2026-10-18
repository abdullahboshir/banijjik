import { invalidFields, referenceInvalid, type FieldProblem } from "../domain/errors.js";
import type { CategoryRepository, ModifierGroupRepository } from "./ports/record-ports.js";
import type { OfferingImageChecker } from "./ports/catalog-context-ports.js";

export interface OfferingReferences {
  readonly categoryIds?: readonly string[] | undefined;
  readonly modifierGroupIds?: readonly string[] | undefined;
  readonly imageFileIds?: readonly string[] | undefined;
}

interface Checkers {
  readonly categories: Pick<CategoryRepository, "findActiveByIds">;
  readonly modifierGroups: Pick<ModifierGroupRepository, "findActiveByIds">;
  readonly images: OfferingImageChecker;
}

function missingIndexes(ids: readonly string[], found: ReadonlySet<string>): number[] {
  return ids.flatMap((id, index) => (found.has(id) ? [] : [index]));
}

function toProblems(path: string, indexes: readonly number[]): FieldProblem[] {
  return indexes.map((index) => ({
    path: `${path}.${index}`,
    messageKey: "errors.offering_reference_invalid",
  }));
}

async function categoryProblems(
  categories: Checkers["categories"],
  ids: readonly string[],
): Promise<FieldProblem[]> {
  if (ids.length === 0) return [];
  const found = new Set((await categories.findActiveByIds(ids)).map((item) => item.categoryId));
  return toProblems("categoryIds", missingIndexes(ids, found));
}

async function groupProblems(
  groups: Checkers["modifierGroups"],
  ids: readonly string[],
): Promise<FieldProblem[]> {
  if (ids.length === 0) return [];
  const found = new Set((await groups.findActiveByIds(ids)).map((item) => item.modifierGroupId));
  return toProblems("modifierGroupIds", missingIndexes(ids, found));
}

async function imageProblems(
  images: OfferingImageChecker,
  ids: readonly string[],
): Promise<FieldProblem[]> {
  const usable = await Promise.all(ids.map((fileId) => images.isUsableImage(fileId)));
  const found = new Set(ids.filter((_fileId, index) => usable[index]));
  return toProblems("imageFileIds", missingIndexes(ids, found));
}

/**
 * The categories and add-on groups an offering names must be ACTIVE and this organization's; its
 * images must be ACTIVE files of this organization uploaded as OFFERING_IMAGE (card 3.0). Each bad
 * id is a 400 at `categoryIds.<n>`, `modifierGroupIds.<n>` or `imageFileIds.<n>`. Reads are batched.
 */
export async function assertReferencesUsable(
  checkers: Checkers,
  references: OfferingReferences,
): Promise<void> {
  const problems = [
    ...(await categoryProblems(checkers.categories, references.categoryIds ?? [])),
    ...(await groupProblems(checkers.modifierGroups, references.modifierGroupIds ?? [])),
    ...(await imageProblems(checkers.images, references.imageFileIds ?? [])),
  ];
  if (problems.length > 0) throw invalidFields(problems);
}

/** A single image of a category: the same check, one id, reported at `imageFileId`. */
export async function assertImageUsable(
  images: OfferingImageChecker,
  fileId: string,
): Promise<void> {
  if (!(await images.isUsableImage(fileId))) throw referenceInvalid("imageFileId");
}
