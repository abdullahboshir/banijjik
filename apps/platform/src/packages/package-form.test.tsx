// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ApiError } from "@banijjik/web-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { packageResponse } from "../test-support/fixtures";
import { banglaText, banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import { packageFormTexts } from "./package-form-labels";

const { replace, refresh, createPackage, updatePackage } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  createPackage: vi.fn(),
  updatePackage: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("../api/platform-api", () => ({
  createPackage,
  updatePackage,
  archivePackage: vi.fn(),
}));
vi.mock("../forms/announce-success", () => ({ announceSuccess: vi.fn() }));

const { PackageForm } = await import("./package-form");

const texts = packageFormTexts(banglaTranslator().t);

beforeEach(() => {
  vi.clearAllMocks();
});

function submit(): HTMLElement {
  return document.querySelector("button[type=submit]") as HTMLElement;
}

async function fillNewBasePackage(): Promise<void> {
  const user = userEvent.setup();
  // These tests exercise submitting full field values, not per-keystroke behaviour.
  const fields: [HTMLElement, string][] = [
    [
      screen.getByLabelText(banglaText("platform.package.field.packageKey"), { exact: false }),
      "GOLD",
    ],
    [screen.getByLabelText(banglaText("platform.package.field.name"), { exact: false }), "Gold"],
    ...Object.values(texts.limitLabels).map((label): [HTMLElement, string] => [
      screen.getByLabelText(label, { exact: true }),
      "5",
    ]),
  ];
  for (const [field, value] of fields) {
    await user.click(field);
    await user.paste(value);
  }
  await user.click(screen.getByLabelText(texts.moduleLabels.pos));
}

describe("PackageForm to create", () => {
  it("shows what is missing and does not call the API for an empty form", async () => {
    renderInBangla(
      <PackageForm existing={undefined} seedName={undefined} canWrite texts={texts} />,
    );
    await userEvent.click(submit());
    expect((await screen.findAllByText(banglaText("validation.required"))).length).toBeGreaterThan(
      0,
    );
    expect(createPackage).not.toHaveBeenCalled();
  });

  it("creates a package from valid input and returns to the list", async () => {
    createPackage.mockResolvedValue({});
    renderInBangla(
      <PackageForm existing={undefined} seedName={undefined} canWrite texts={texts} />,
    );
    await fillNewBasePackage();
    await userEvent.click(submit());
    await waitFor(() =>
      expect(createPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          packageKey: "GOLD",
          name: "Gold",
          isAddOn: false,
          moduleKeys: ["pos"],
        }),
      ),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/packages"));
  });

  it("shows which dependency is missing when the API says the package is not closed", async () => {
    createPackage.mockRejectedValue(
      new ApiError({
        status: 422,
        code: "BUSINESS_RULE",
        messageKey: "errors.package_not_closed",
        details: { gaps: [{ moduleKey: "pos", missingDependency: "sales" }] },
      }),
    );
    renderInBangla(
      <PackageForm existing={undefined} seedName={undefined} canWrite texts={texts} />,
    );
    await fillNewBasePackage();
    await userEvent.click(submit());
    const alerts = await screen.findAllByRole("alert");
    const gap = alerts.find((alert) => within(alert).queryByRole("listitem"));
    expect(gap?.textContent).toContain(texts.moduleLabels.pos);
    expect(gap?.textContent).toContain(texts.moduleLabels.sales);
    expect(screen.getByText(banglaText("errors.package_not_closed"))).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("groups the module checkboxes by class", () => {
    renderInBangla(
      <PackageForm existing={undefined} seedName={undefined} canWrite texts={texts} />,
    );
    expect(screen.getByRole("heading", { name: texts.classLabels.CORE })).not.toBeNull();
    expect(screen.getByRole("heading", { name: texts.classLabels.OPTIONAL })).not.toBeNull();
  });
});

describe("PackageForm to edit", () => {
  it("lists the modules that are not built yet", () => {
    const existing = packageResponse({
      moduleKeys: ["pos", "website"],
      unbuiltModuleKeys: ["website"],
    });
    renderInBangla(<PackageForm existing={existing} seedName={undefined} canWrite texts={texts} />);
    expect(screen.getByText(new RegExp(banglaText("platform.package.notBuilt")))).not.toBeNull();
    expect(
      screen.getByText(new RegExp(texts.moduleLabels.website, "u"), { selector: "p" }),
    ).not.toBeNull();
  });

  it("shows the name of a built-in package read-only", () => {
    const existing = packageResponse({
      nameKey: "package.SHOP.name",
      name: null,
      packageKey: "SHOP",
    });
    renderInBangla(<PackageForm existing={existing} seedName="দোকান" canWrite texts={texts} />);
    const nameField = screen.getByLabelText(banglaText("platform.package.field.name"), {
      exact: false,
    });
    expect((nameField as HTMLInputElement).readOnly).toBe(true);
    expect((nameField as HTMLInputElement).value).toBe("দোকান");
  });

  it("saves with the version it was opened at", async () => {
    updatePackage.mockResolvedValue({});
    const existing = packageResponse({ version: 7 });
    renderInBangla(<PackageForm existing={existing} seedName={undefined} canWrite texts={texts} />);
    await userEvent.click(submit());
    await waitFor(() =>
      expect(updatePackage).toHaveBeenCalledWith(
        existing.packageId,
        expect.objectContaining({ version: 7 }),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("is read-only without write access: no save and no archive", () => {
    renderInBangla(
      <PackageForm
        existing={packageResponse()}
        seedName={undefined}
        canWrite={false}
        texts={texts}
      />,
    );
    expect(submit()).toBeNull();
    expect(
      screen.queryByRole("button", { name: banglaText("platform.package.archive") }),
    ).toBeNull();
    expect(screen.getByText(banglaText("platform.package.readOnly"))).not.toBeNull();
  });

  it("offers archive to a writer of an active package", () => {
    renderInBangla(
      <PackageForm existing={packageResponse()} seedName={undefined} canWrite texts={texts} />,
    );
    expect(
      screen.getByRole("button", { name: banglaText("platform.package.archive") }),
    ).not.toBeNull();
  });
});
