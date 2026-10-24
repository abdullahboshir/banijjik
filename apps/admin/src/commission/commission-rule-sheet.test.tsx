// @vitest-environment jsdom
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createCommissionRule = vi.fn();
const updateCommissionRule = vi.fn();
vi.mock("./commission-api", () => ({
  createCommissionRule: (...args: unknown[]) => createCommissionRule(...args),
  updateCommissionRule: (...args: unknown[]) => updateCommissionRule(...args),
}));

const { CommissionRuleSheet } = await import("./commission-rule-sheet");

const MEMBER_ID = "01900000-0000-7000-8000-000000000001";
const MEMBERS = [{ memberId: MEMBER_ID, name: "Rahim" }];

function textOf(messageKey: string): string {
  const text = SCREEN_CATALOGS.en[messageKey] ?? BUNDLED_CATALOGS.en[messageKey];
  if (text === undefined) throw new Error(`Missing English message ${messageKey}`);
  return text;
}

function labelOf(messageKey: string): RegExp {
  return new RegExp(`^${textOf(messageKey).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u");
}

function renderSheet(onClose = vi.fn()): () => void {
  render(
    <I18nProvider
      locale="en"
      catalog={{ ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en }}
      brandName="Example"
    >
      <CommissionRuleSheet
        organizationId="org-1"
        currency="BDT"
        members={MEMBERS}
        roles={[]}
        categories={[]}
        offerings={[]}
        kinds={["SERVICE"]}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  createCommissionRule.mockReset();
  updateCommissionRule.mockReset();
  refresh.mockReset();
});

describe("CommissionRuleSheet", () => {
  it("asks for the member and the rate before calling the API", async () => {
    renderSheet();

    await userEvent.click(
      screen.getByRole("button", { name: textOf("commission.rule.form.submit") }),
    );

    expect(createCommissionRule).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(labelOf("commission.rule.form.member")).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen.getByLabelText(labelOf("commission.rule.form.percent")).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("sends a 10 % rule as integer basis points, then closes and reloads", async () => {
    createCommissionRule.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.selectOptions(
      screen.getByLabelText(labelOf("commission.rule.form.member")),
      MEMBER_ID,
    );
    await userEvent.type(screen.getByLabelText(labelOf("commission.rule.form.percent")), "10");
    await userEvent.click(
      screen.getByRole("button", { name: textOf("commission.rule.form.submit") }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createCommissionRule).toHaveBeenCalledWith("org-1", {
      subjectType: "MEMBER",
      memberId: MEMBER_ID,
      targetType: "ALL",
      calculation: "PERCENT",
      percentBasisPoints: 1000,
    });
    expect(refresh).toHaveBeenCalled();
  });
});
