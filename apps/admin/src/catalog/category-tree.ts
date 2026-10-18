import { MAX_CATEGORY_DEPTH } from "@banijjik/contracts/catalog";

/** The parts of a category the tree needs; the API row has more. */
export interface TreeCategory {
  categoryId: string;
  name: string;
  parentCategoryId: string | null;
  sortOrder: number;
}

export interface TreeRow<Category extends TreeCategory> {
  category: Category;
  /** 1 for a top-level category. */
  depth: number;
}

const SORT_STEP = 10;

function bySortOrder(left: TreeCategory, right: TreeCategory): number {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
}

function childrenOf<Category extends TreeCategory>(
  categories: readonly Category[],
  parentCategoryId: string | null,
): Category[] {
  return categories.filter((item) => item.parentCategoryId === parentCategoryId).sort(bySortOrder);
}

/** The categories as an indented list: each parent is followed by its children, in sort order. */
export function treeRows<Category extends TreeCategory>(
  categories: readonly Category[],
): TreeRow<Category>[] {
  const known = new Set(categories.map((item) => item.categoryId));
  // A category whose parent is archived or hidden is shown at the top rather than lost.
  const roots = categories
    .filter((item) => item.parentCategoryId === null || !known.has(item.parentCategoryId))
    .sort(bySortOrder);
  const rows: TreeRow<Category>[] = [];
  function visit(category: Category, depth: number): void {
    rows.push({ category, depth });
    for (const child of childrenOf(categories, category.categoryId)) visit(child, depth + 1);
  }
  for (const root of roots) visit(root, 1);
  return rows;
}

function descendantIds(categories: readonly TreeCategory[], categoryId: string): Set<string> {
  const found = new Set<string>();
  const pending = [categoryId];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const child of childrenOf(categories, current ?? null)) {
      found.add(child.categoryId);
      pending.push(child.categoryId);
    }
  }
  return found;
}

function heightOf(categories: readonly TreeCategory[], categoryId: string): number {
  const children = childrenOf(categories, categoryId);
  return 1 + Math.max(0, ...children.map((child) => heightOf(categories, child.categoryId)));
}

function depthOf(categories: readonly TreeCategory[], categoryId: string): number {
  const parent = categories.find((item) => item.categoryId === categoryId)?.parentCategoryId;
  return parent === null || parent === undefined ? 1 : 1 + depthOf(categories, parent);
}

/**
 * The parents a category may be moved under: not itself, not one of its own children (a cycle), and
 * not so deep that the category and everything under it would pass three levels (the API checks too).
 */
export function allowedParents<Category extends TreeCategory>(
  categories: readonly Category[],
  categoryId: string,
): Category[] {
  const blocked = descendantIds(categories, categoryId);
  blocked.add(categoryId);
  const ownHeight = heightOf(categories, categoryId);
  return categories.filter(
    (candidate) =>
      !blocked.has(candidate.categoryId) &&
      depthOf(categories, candidate.categoryId) + ownHeight <= MAX_CATEGORY_DEPTH,
  );
}

/** Can a new category go under this parent? Only while the parent is above the last level. */
export function canHaveChildren(categories: readonly TreeCategory[], categoryId: string): boolean {
  return depthOf(categories, categoryId) < MAX_CATEGORY_DEPTH;
}

export interface SortChange {
  categoryId: string;
  sortOrder: number;
}

/**
 * Moves one category up (-1) or down (+1) among its siblings. The siblings are renumbered in steps of
 * ten, so equal numbers (new categories all start at 0) still end up in a clear order; only the
 * categories whose number changed are returned.
 */
export function moveAmongSiblings(
  categories: readonly TreeCategory[],
  categoryId: string,
  offset: -1 | 1,
): SortChange[] {
  const category = categories.find((item) => item.categoryId === categoryId);
  if (!category) return [];
  const siblings = childrenOf(categories, category.parentCategoryId);
  const index = siblings.findIndex((item) => item.categoryId === categoryId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= siblings.length) return [];
  const reordered = [...siblings];
  reordered.splice(index, 1);
  reordered.splice(target, 0, category);
  return reordered
    .map((item, position) => ({ categoryId: item.categoryId, sortOrder: position * SORT_STEP }))
    .filter(
      (change) =>
        siblings.find((item) => item.categoryId === change.categoryId)?.sortOrder !==
        change.sortOrder,
    );
}
