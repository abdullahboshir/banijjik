import { createTranslator, SCREEN_CATALOGS } from "@banijjik/i18n";
import { describe, expect, it } from "vitest";
import { groupSettingRows, settingGroupTexts } from "./setting-groups";
import type { SettingRowView } from "./setting-rows";

const { t } = createTranslator({ locale: "bn", brandName: "Example", catalogs: SCREEN_CATALOGS });

function row(settingKey: string): SettingRowView {
  return {
    settingKey,
    label: settingKey,
    valueText: "",
    source: "SYSTEM",
    sourceLabel: "",
    spec: { kind: "BOOLEAN" },
    initialText: "",
    options: [],
    version: undefined,
    locationId: undefined,
    canEdit: false,
    canReset: false,
  };
}

describe("groupSettingRows", () => {
  it("groups the rows by the module part of their key, keeping the response's order", () => {
    const groups = groupSettingRows([
      row("organization.digitScript"),
      row("booking.slotMinutes"),
      row("organization.numberGrouping"),
    ]);
    expect(groups.map((group) => group.groupKey)).toEqual(["organization", "booking"]);
    expect(groups[0]?.rows.map((item) => item.settingKey)).toEqual([
      "organization.digitScript",
      "organization.numberGrouping",
    ]);
  });

  it("gives no group for no rows", () => {
    expect(groupSettingRows([])).toEqual([]);
  });
});

describe("settingGroupTexts", () => {
  it("shows the module's own title and help when the catalog has them", () => {
    const texts = settingGroupTexts("organization", t);
    expect(texts.title).not.toBe("settings.general.group.organization");
    expect(texts.help.length).toBeGreaterThan(0);
  });

  it("falls back to the generic title and help for a module the catalog does not know", () => {
    const texts = settingGroupTexts("booking", t);
    expect(texts).toEqual(settingGroupTexts("other", t));
    expect(texts.title).not.toContain("settings.general.group");
  });
});
