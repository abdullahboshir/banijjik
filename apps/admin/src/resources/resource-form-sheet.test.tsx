// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildResourceCreate, emptyResourceForm } from "./resource-form";

describe("ResourceFormSheet payload", () => {
  it("creates a resource with weekly hours", () => {
    const form = emptyResourceForm({
      locationId: "01900000-0000-7000-8000-000000000001",
      resourceTypeKey: "STYLIST",
    });
    form.name = "Mina";
    form.scheduleRows = form.scheduleRows.map((row) =>
      row.weekday === 1 ? { ...row, opensAt: "09:00", closesAt: "17:00" } : row,
    );
    const built = buildResourceCreate(form);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.body.weeklySchedule).toEqual([
        { weekday: 1, opensAt: "09:00", closesAt: "17:00" },
      ]);
    }
  });
});
