// @vitest-environment jsdom
import type { DnsInstruction } from "@banijjik/contracts/website";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";
import { DomainDnsInstructions } from "./domain-dns-instructions";

const TXT: DnsInstruction = {
  type: "TXT",
  name: "_cf-custom-hostname.shop.example.com",
  value: "ownership-token",
};
const CNAME: DnsInstruction = {
  type: "CNAME",
  name: "shop.example.com",
  value: "fallback.example.net",
};

function renderInstructions(records: readonly DnsInstruction[]): void {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <DomainDnsInstructions
        title={banglaText("website.domains.ownership")}
        records={records}
        waitLabel={banglaText("website.domains.dnsWait")}
        copyLabel={banglaText("website.domains.copy")}
        copiedLabel={banglaText("website.domains.copied")}
      />
    </I18nProvider>,
  );
}

describe("DomainDnsInstructions", () => {
  it("renders TXT and CNAME rows", () => {
    renderInstructions([TXT, CNAME]);

    expect(screen.getByText("TXT")).not.toBeNull();
    expect(screen.getByText(TXT.name)).not.toBeNull();
    expect(screen.getByText(TXT.value)).not.toBeNull();
    expect(screen.getByText("CNAME")).not.toBeNull();
    expect(screen.getByText(CNAME.value)).not.toBeNull();
  });

  it("shows the wait line when there are no records yet", () => {
    renderInstructions([]);

    expect(screen.getByText(banglaText("website.domains.dnsWait"))).not.toBeNull();
  });

  it("copies the record value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderInstructions([TXT]);

    await userEvent.click(screen.getByRole("button", { name: banglaText("website.domains.copy") }));

    expect(writeText).toHaveBeenCalledWith(TXT.value);
    expect(await screen.findByText(banglaText("website.domains.copied"))).not.toBeNull();
  });
});
