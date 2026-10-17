// @vitest-environment jsdom
import { ERROR_CODE, PERMISSION_KEY, type TermView } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { accessFixture, type AccessOptions } from "../settings/test-fixtures";
import { termSheetLabelsOf } from "./term-labels";
import { toTermRows } from "./term-rows";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateTerms = vi.fn();
vi.mock("../lib/api/tenant-config-api", () => ({
  updateTerms: (...args: unknown[]) => updateTerms(...args),
}));
const requireOrgAccess = vi.fn();
vi.mock("../shell/org-access", () => ({
  requireOrgAccess: (...args: unknown[]) => requireOrgAccess(...args),
}));
vi.mock("../lib/i18n/get-translator", () => ({
  getTranslator: () => Promise.resolve(banglaTranslator()),
}));
const fetchBusinessResource = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => fetchBusinessResource(...args),
}));

const { TermEditSheet } = await import("./term-edit-sheet");
const { TermsPage } = await import("./terms-page");

const { t } = banglaTranslator();
const labels = termSheetLabelsOf(t);
const TERMS: TermView[] = [
  {
    termKey: "location",
    bn: { text: "শাখা", source: "INDUSTRY" },
    en: { text: "Branch", source: "ORGANIZATION", version: 2 },
  },
];

function aRow(canEdit = true) {
  const [row] = toTermRows(TERMS, canEdit, t);
  if (row === undefined) throw new Error("no row");
  return row;
}

function renderSheet(onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <TermEditSheet organizationId="org-1" term={aRow()} labels={labels} onClose={onClose} />
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  updateTerms.mockReset();
  refresh.mockReset();
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
});

describe("TermEditSheet", () => {
  it("sends only the language that changed, with the version of the override it replaces", async () => {
    updateTerms.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.clear(screen.getByLabelText(new RegExp(labels.en)));
    await userEvent.type(screen.getByLabelText(new RegExp(labels.en)), "Outlet");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateTerms).toHaveBeenCalledWith("org-1", [
      { termKey: "location", locale: "en", text: "Outlet", version: 2 },
    ]);
  });

  it("sends a new language without a version when the template text is replaced", async () => {
    updateTerms.mockResolvedValue({});
    renderSheet();

    await userEvent.clear(screen.getByLabelText(new RegExp(labels.bn)));
    await userEvent.type(screen.getByLabelText(new RegExp(labels.bn)), "আউটলেট");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() => expect(updateTerms).toHaveBeenCalled());
    expect(updateTerms.mock.calls[0]?.[1]).toEqual([
      { termKey: "location", locale: "bn", text: "আউটলেট" },
    ]);
  });

  it("sends null with the version for each language the business owns when reset", async () => {
    updateTerms.mockResolvedValue({});
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: labels.reset }));

    await waitFor(() => expect(updateTerms).toHaveBeenCalled());
    expect(updateTerms.mock.calls[0]?.[1]).toEqual([
      { termKey: "location", locale: "en", text: null, version: 2 },
    ]);
  });

  it("asks for a text before calling the API", async () => {
    renderSheet();

    await userEvent.clear(screen.getByLabelText(new RegExp(labels.bn)));
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(banglaText("validation.required"))).toBeTruthy();
    expect(updateTerms).not.toHaveBeenCalled();
  });

  it("shows the message of a 403 and of a 422, and the reload hint of a 409", async () => {
    updateTerms.mockRejectedValueOnce(
      new ApiError({ status: 403, code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" }),
    );
    renderSheet();
    await userEvent.clear(screen.getByLabelText(new RegExp(labels.en)));
    await userEvent.type(screen.getByLabelText(new RegExp(labels.en)), "Outlet");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect(await screen.findByText(banglaText("errors.forbidden"))).toBeTruthy();

    updateTerms.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.term_not_available",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect(await screen.findByText(banglaText("errors.term_not_available"))).toBeTruthy();

    updateTerms.mockRejectedValueOnce(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect(await screen.findByText(labels.conflict)).toBeTruthy();
  });
});

async function renderPage(options: AccessOptions): Promise<void> {
  requireOrgAccess.mockResolvedValue(accessFixture(options));
  fetchBusinessResource.mockResolvedValue({ data: { terms: TERMS } });
  render(await TermsPage({ orgSlug: "acme" }));
}

describe("TermsPage", () => {
  it("shows each language with where its text comes from", async () => {
    await renderPage({ keys: [PERMISSION_KEY.SETTINGS_SETTING_READ] });

    expect(screen.getAllByText("শাখা").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Branch").length).toBeGreaterThan(0);
    expect(screen.getAllByText(banglaText("terms.source.ORGANIZATION")).length).toBeGreaterThan(0);
  });

  it("offers Change only with the term key at every location", async () => {
    await renderPage({
      keys: [PERMISSION_KEY.SETTINGS_SETTING_READ, PERMISSION_KEY.SETTINGS_TERM_UPDATE],
    });
    expect(
      screen.getAllByRole("button", { name: banglaText("terms.change") }).length,
    ).toBeGreaterThan(0);
  });

  it("offers no Change to a person limited to one location, or in read-only mode", async () => {
    await renderPage({
      keys: [PERMISSION_KEY.SETTINGS_SETTING_READ],
      limitedKeys: [PERMISSION_KEY.SETTINGS_TERM_UPDATE],
    });
    expect(screen.queryByRole("button", { name: banglaText("terms.change") })).toBeNull();
  });
});
