// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const archiveContact = vi.fn();
const anonymizeContact = vi.fn();
const updateContact = vi.fn();
vi.mock("./contact-api", () => ({
  archiveContact: (...args: unknown[]) => archiveContact(...args),
  anonymizeContact: (...args: unknown[]) => anonymizeContact(...args),
  updateContact: (...args: unknown[]) => updateContact(...args),
}));

const { ContactActions } = await import("./contact-actions");
const { ContactAddresses } = await import("./contact-addresses");

const ACTION_LABELS = {
  close: "বন্ধ",
  cancel: "বাতিল",
  conflict: "অন্য কেউ বদলেছেন",
  archive: { title: "আর্কাইভ?", description: "আর্কাইভ হবে", confirm: "আর্কাইভ করুন" },
  anonymize: {
    title: "মুছবেন?",
    description: "ফেরানো যাবে না",
    reason: "কারণ",
    typeToConfirm: "নিশ্চিত করতে মুছুন লিখুন",
    confirmWord: "মুছুন",
    confirm: "ব্যক্তিগত তথ্য মুছুন",
  },
};

function inProvider(node: ReactNode): ReactElement {
  return (
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      {node}
    </I18nProvider>
  );
}

function renderActions(actions: ("archive" | "anonymize")[], editButton: ReactNode = null) {
  render(
    inProvider(
      <ContactActions
        organizationId="org-1"
        contactId="c-1"
        version={3}
        actions={actions}
        editButton={editButton}
        groupLabel="কাজ"
        archiveLabel="আর্কাইভ করুন"
        anonymizeLabel="ব্যক্তিগত তথ্য মুছুন"
        labels={ACTION_LABELS}
      />,
    ),
  );
}

beforeEach(() => {
  for (const mock of [archiveContact, anonymizeContact, updateContact, refresh]) mock.mockReset();
});

describe("ContactActions", () => {
  it("shows only the actions the person may do", () => {
    renderActions(["archive"]);

    expect(screen.getByRole("button", { name: "আর্কাইভ করুন" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ব্যক্তিগত তথ্য মুছুন" })).toBeNull();
  });

  it("draws nothing when there is no action and no edit button", () => {
    renderActions([]);

    expect(screen.queryByRole("group")).toBeNull();
  });

  it("archives with the version it read, then reloads the page", async () => {
    archiveContact.mockResolvedValue({});
    renderActions(["archive"]);

    await userEvent.click(screen.getByRole("button", { name: "আর্কাইভ করুন" }));
    await screen.findByText(ACTION_LABELS.archive.description);
    const confirm = screen.getAllByRole("button", { name: "আর্কাইভ করুন" }).pop();
    await userEvent.click(confirm as HTMLButtonElement);

    await waitFor(() => expect(archiveContact).toHaveBeenCalledWith("org-1", "c-1", 3));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says so when someone else changed the contact", async () => {
    archiveContact.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderActions(["archive"]);

    await userEvent.click(screen.getByRole("button", { name: "আর্কাইভ করুন" }));
    const buttons = await screen.findAllByRole("button", { name: "আর্কাইভ করুন" });
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement);

    expect(await screen.findByText(ACTION_LABELS.conflict)).toBeTruthy();
  });

  it("erases only after a reason and the typed word, and sends both", async () => {
    anonymizeContact.mockResolvedValue({});
    renderActions(["anonymize"]);
    await userEvent.click(screen.getByRole("button", { name: "ব্যক্তিগত তথ্য মুছুন" }));
    const confirm = (await screen.findAllByRole("button", { name: "ব্যক্তিগত তথ্য মুছুন" })).pop();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText(/কারণ/u), "অনুরোধে");
    await userEvent.type(screen.getByLabelText(/নিশ্চিত করতে/u), "ভুল");
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.clear(screen.getByLabelText(/নিশ্চিত করতে/u));
    await userEvent.type(screen.getByLabelText(/নিশ্চিত করতে/u), "মুছুন");
    await userEvent.click(confirm as HTMLButtonElement);

    await waitFor(() =>
      expect(anonymizeContact).toHaveBeenCalledWith("org-1", "c-1", {
        version: 3,
        reason: "অনুরোধে",
      }),
    );
  });
});

describe("ContactAddresses", () => {
  const LABELS = {
    title: "ঠিকানা",
    help: "সাহায্য",
    empty: "কোনো ঠিকানা নেই",
    add: "ঠিকানা যোগ করুন",
    edit: "সম্পাদনা",
    defaultMark: "ডিফল্ট",
    makeDefault: "ডিফল্ট করুন",
    addTitle: "ঠিকানা যোগ",
    editTitle: "ঠিকানা সম্পাদনা",
    close: "বন্ধ",
    save: "সংরক্ষণ",
    conflict: "অন্য কেউ বদলেছেন",
    reload: "নতুন করে দেখুন",
    label: "নাম",
    line1: "ঠিকানা",
    area: "এলাকা",
    thana: "থানা",
    district: "জেলা",
    postalCode: "পোস্ট কোড",
    isDefault: "ডিফল্ট",
  };
  const ADDRESSES = [
    { addressId: "a-1", label: "বাসা", line1: "১২ রোড", isDefault: true },
    { addressId: "a-2", label: "দোকান", line1: "৫ বাজার", isDefault: false },
  ];

  function renderAddresses(canEdit: boolean, addresses = ADDRESSES) {
    render(
      inProvider(
        <ContactAddresses
          organizationId="org-1"
          contactId="c-1"
          version={3}
          addresses={addresses}
          canEdit={canEdit}
          labels={LABELS}
        />,
      ),
    );
  }

  it("is read-only when the person may not edit", () => {
    renderAddresses(false);

    expect(screen.getByText("১২ রোড")).toBeTruthy();
    expect(screen.queryByRole("button", { name: LABELS.add })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.makeDefault })).toBeNull();
  });

  it("makes another address the default by sending the whole list", async () => {
    updateContact.mockResolvedValue({});
    renderAddresses(true);

    await userEvent.click(screen.getByRole("button", { name: LABELS.makeDefault }));

    await waitFor(() => expect(updateContact).toHaveBeenCalled());
    const body = updateContact.mock.calls[0]?.[2] as {
      addresses: { isDefault: boolean }[];
      version: number;
    };
    expect(body.addresses.map((address) => address.isDefault)).toEqual([false, true]);
    expect(body.version).toBe(3);
  });

  it("says when there is no address", () => {
    renderAddresses(true, []);

    expect(screen.getByText(LABELS.empty)).toBeTruthy();
    expect(screen.getByRole("button", { name: LABELS.add })).toBeTruthy();
  });
});
