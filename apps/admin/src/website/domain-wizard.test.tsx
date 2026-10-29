// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { SiteDomainResponse } from "@banijjik/contracts/website";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const addSiteDomain = vi.fn();
const verifySiteDomain = vi.fn();
const removeSiteDomain = vi.fn();
const selectCanonicalSiteDomain = vi.fn();
const fetchSiteDraft = vi.fn();
vi.mock("./domain-api", () => ({
  addSiteDomain: (...args: unknown[]) => addSiteDomain(...args),
  verifySiteDomain: (...args: unknown[]) => verifySiteDomain(...args),
  removeSiteDomain: (...args: unknown[]) => removeSiteDomain(...args),
  selectCanonicalSiteDomain: (...args: unknown[]) => selectCanonicalSiteDomain(...args),
  fetchSiteDraft: (...args: unknown[]) => fetchSiteDraft(...args),
}));

const { DomainWizard } = await import("./domain-wizard");

const HOSTNAME = "shop.example.com";

function aDomain(overrides: Partial<SiteDomainResponse> = {}): SiteDomainResponse {
  return {
    siteDomainId: "01926b48-1234-7abc-8def-0123456789b1",
    hostname: HOSTNAME,
    status: "PENDING",
    version: 1,
    ownershipRecords: [],
    certificateRecords: [],
    diagnosticKey: null,
    isCanonical: false,
    ...overrides,
  };
}

function renderWizard(items: readonly SiteDomainResponse[] = []): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <DomainWizard organizationId="org-1" initialItems={items} canWrite />
    </I18nProvider>,
  );
}

beforeEach(() => {
  addSiteDomain.mockReset();
  verifySiteDomain.mockReset();
  removeSiteDomain.mockReset();
  selectCanonicalSiteDomain.mockReset();
  fetchSiteDraft.mockReset();
});

describe("DomainWizard", () => {
  it("adds a hostname with an Idempotency-Key and shows it", async () => {
    addSiteDomain.mockResolvedValue(aDomain());
    renderWizard();

    await userEvent.type(
      screen.getByLabelText(banglaText("website.domains.hostname"), { exact: false }),
      HOSTNAME,
    );
    await userEvent.click(screen.getByRole("button", { name: banglaText("website.domains.add") }));

    await waitFor(() => expect(addSiteDomain).toHaveBeenCalled());
    const input = addSiteDomain.mock.calls[0]?.[0] as {
      hostname: string;
      idempotencyKey: string;
    };
    expect(input.hostname).toBe(HOSTNAME);
    expect(input.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(await screen.findByText(HOSTNAME)).not.toBeNull();
    expect(screen.getByText(banglaText("website.domains.status.PENDING"))).not.toBeNull();
  });

  it("shows the taken-host message from the API", async () => {
    addSiteDomain.mockRejectedValue(
      new ApiError({
        status: 409,
        code: ERROR_CODE.WEBSITE_DOMAIN_TAKEN,
        messageKey: "errors.website_domain_taken",
      }),
    );
    renderWizard();

    await userEvent.type(
      screen.getByLabelText(banglaText("website.domains.hostname"), { exact: false }),
      HOSTNAME,
    );
    await userEvent.click(screen.getByRole("button", { name: banglaText("website.domains.add") }));

    expect(await screen.findByText(banglaText("errors.website_domain_taken"))).not.toBeNull();
  });
});
