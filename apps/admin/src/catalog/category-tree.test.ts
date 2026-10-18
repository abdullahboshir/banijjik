import { describe, expect, it } from "vitest";
import {
  allowedParents,
  canHaveChildren,
  moveAmongSiblings,
  treeRows,
  type TreeCategory,
} from "./category-tree";

function category(
  categoryId: string,
  parentCategoryId: string | null = null,
  sortOrder = 0,
): TreeCategory {
  return { categoryId, name: categoryId, parentCategoryId, sortOrder };
}

const SAMPLE = [
  category("men", null, 10),
  category("women", null, 20),
  category("shirts", "men", 10),
  category("polo", "shirts", 0),
];

describe("treeRows", () => {
  it("lists each parent followed by its children, with the depth", () => {
    expect(treeRows(SAMPLE).map((row) => [row.category.categoryId, row.depth])).toEqual([
      ["men", 1],
      ["shirts", 2],
      ["polo", 3],
      ["women", 1],
    ]);
  });

  it("shows a category whose parent is not in the list at the top", () => {
    expect(treeRows([category("orphan", "gone")]).map((row) => row.depth)).toEqual([1]);
  });
});

describe("allowedParents", () => {
  it("never offers the category itself or anything under it", () => {
    const names = allowedParents(SAMPLE, "men").map((item) => item.categoryId);

    expect(names).not.toContain("men");
    expect(names).not.toContain("shirts");
    expect(names).not.toContain("polo");
  });

  it("keeps the moved category and what is under it within three levels", () => {
    // men > shirts > polo is already three deep, so it can go under nothing.
    expect(allowedParents(SAMPLE, "men")).toEqual([]);
    expect(
      allowedParents(SAMPLE, "polo")
        .map((item) => item.categoryId)
        .sort(),
    ).toEqual(["men", "shirts", "women"]);
  });

  it("says a third-level category cannot have children", () => {
    expect(canHaveChildren(SAMPLE, "shirts")).toBe(true);
    expect(canHaveChildren(SAMPLE, "polo")).toBe(false);
  });
});

describe("moveAmongSiblings", () => {
  it("swaps with the next sibling and renumbers only what changed", () => {
    // women takes 0 and men keeps its 10, so only women is written.
    expect(moveAmongSiblings(SAMPLE, "men", 1)).toEqual([{ categoryId: "women", sortOrder: 0 }]);
  });

  it("gives equal numbers a clear order when one moves", () => {
    const flat = [category("a"), category("b"), category("c")];

    expect(moveAmongSiblings(flat, "c", -1)).toEqual([
      { categoryId: "c", sortOrder: 10 },
      { categoryId: "b", sortOrder: 20 },
    ]);
  });

  it("does nothing at the end of the list", () => {
    expect(moveAmongSiblings(SAMPLE, "men", -1)).toEqual([]);
    expect(moveAmongSiblings(SAMPLE, "women", 1)).toEqual([]);
  });
});
