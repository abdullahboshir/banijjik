import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ContactLinkInput,
  type ContactLinkCandidate,
  type ContactLinkLabels,
} from "./contact-link-input.js";

const LABELS: ContactLinkLabels = {
  search: "Find a contact",
  noResults: "No contact found",
  createNew: "Add a new contact",
  name: "Name",
  phone: "Phone",
  change: "Change",
  remove: "Remove",
  linked: "Linked: {name}",
  willCreate: "A new contact will be added",
};

const KARIM: ContactLinkCandidate = {
  contactId: "01a14a7a-ae36-7356-955c-8bd9342dfef0",
  name: "Abdul Karim",
  phone: "01712349001",
};

function Harness(props: {
  search?: (query: string) => Promise<readonly ContactLinkCandidate[]>;
  onEmit: (value: unknown) => void;
  isRequired?: boolean;
  initial?: unknown;
}) {
  const [value, setValue] = useState<unknown>(props.initial);
  return (
    <ContactLinkInput
      id="guardian"
      value={value}
      onChange={(next) => {
        setValue(next ?? undefined);
        props.onEmit(next);
      }}
      search={props.search ?? (() => Promise.resolve([]))}
      labels={LABELS}
      isRequired={props.isRequired}
    />
  );
}

describe("ContactLinkInput", () => {
  it("finds an existing contact by what is typed and emits its id", async () => {
    const search = vi.fn().mockResolvedValue([KARIM]);
    const onEmit = vi.fn();
    render(<Harness search={search} onEmit={onEmit} />);

    await userEvent.type(screen.getByLabelText(LABELS.search), "kar");
    await userEvent.click(await screen.findByRole("button", { name: /Abdul Karim/u }));

    expect(search).toHaveBeenCalledWith("kar");
    expect(onEmit).toHaveBeenLastCalledWith(KARIM.contactId);
    expect(screen.getByText("Linked: Abdul Karim")).toBeTruthy();
  });

  it("says when nothing is found", async () => {
    render(<Harness onEmit={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(LABELS.search), "zz");

    expect(await screen.findByText(LABELS.noResults)).toBeTruthy();
  });

  it("emits the name and phone of a new contact only when both are typed", async () => {
    const onEmit = vi.fn();
    render(<Harness onEmit={onEmit} />);

    await userEvent.click(screen.getByRole("button", { name: LABELS.createNew }));
    await userEvent.type(screen.getByLabelText(LABELS.name), "Rina Begum");
    expect(onEmit).toHaveBeenLastCalledWith(null);
    await userEvent.type(screen.getByLabelText(LABELS.phone), "01712340000");

    await waitFor(() =>
      expect(onEmit).toHaveBeenLastCalledWith({
        create: { name: "Rina Begum", phone: "01712340000" },
      }),
    );
  });

  it("lets a linked contact be changed or removed, and not removed when the field is required", async () => {
    const onEmit = vi.fn();
    const { unmount } = render(<Harness onEmit={onEmit} initial={KARIM.contactId} />);

    await userEvent.click(screen.getByRole("button", { name: LABELS.remove }));

    expect(onEmit).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText(LABELS.search)).toBeTruthy();
    unmount();
    render(<Harness onEmit={onEmit} initial={KARIM.contactId} isRequired />);
    expect(screen.queryByRole("button", { name: LABELS.remove })).toBeNull();
    expect(screen.getByRole("button", { name: LABELS.change })).toBeTruthy();
  });
});
