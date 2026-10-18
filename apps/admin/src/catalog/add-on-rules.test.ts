import { describe, expect, it } from "vitest";
import { describeRules, normalizeRules } from "./add-on-rules";

describe("normalizeRules", () => {
  it("makes a single choice allow exactly one, and one when required", () => {
    const rules = { selection: "SINGLE", isRequired: true, minSelect: 0, maxSelect: 5 } as const;

    expect(normalizeRules(rules, 4)).toEqual({ ...rules, minSelect: 1, maxSelect: 1 });
    expect(normalizeRules({ ...rules, isRequired: false }, 4)).toMatchObject({
      minSelect: 0,
      maxSelect: 1,
    });
  });

  it("asks a required group for at least one and keeps the least at or below the most", () => {
    const rules = { selection: "MULTIPLE", isRequired: true, minSelect: 0, maxSelect: 3 } as const;

    expect(normalizeRules(rules, 5)).toMatchObject({ minSelect: 1, maxSelect: 3 });
    expect(normalizeRules({ ...rules, minSelect: 4 }, 5)).toMatchObject({
      minSelect: 3,
      maxSelect: 3,
    });
  });

  it("never lets the most pass the number of options, and an optional group asks for none", () => {
    const rules = { selection: "MULTIPLE", isRequired: false, minSelect: 2, maxSelect: 9 } as const;

    expect(normalizeRules(rules, 4)).toMatchObject({ minSelect: 0, maxSelect: 4 });
  });
});

describe("describeRules", () => {
  it("picks the plain sentence customers would understand", () => {
    expect(
      describeRules({ selection: "SINGLE", isRequired: true, minSelect: 1, maxSelect: 1 }).key,
    ).toBe("single");
    expect(
      describeRules({ selection: "MULTIPLE", isRequired: false, minSelect: 0, maxSelect: 3 }),
    ).toEqual({ key: "multipleOptional", values: { min: 0, max: 3 } });
    expect(
      describeRules({ selection: "MULTIPLE", isRequired: true, minSelect: 1, maxSelect: 2 }).key,
    ).toBe("multipleRequired");
  });
});
