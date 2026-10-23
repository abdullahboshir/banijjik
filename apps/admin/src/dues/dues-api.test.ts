import { beforeEach, describe, expect, it, vi } from "vitest";
const read = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => read(...args),
}));
const { duesSearch, fetchDuesContacts } = await import("./dues-api");

beforeEach(() => vi.clearAllMocks());

describe("dues filters and pagination", () => {
  it("keeps contact and request filters while paging with a bounded limit", () => {
    const search = new URLSearchParams(
      duesSearch({ page: 2, contactId: "contact-1", requestType: "BOOKING" }),
    );
    expect(Object.fromEntries(search)).toEqual({
      page: "2",
      limit: "20",
      contactId: "contact-1",
      requestType: "BOOKING",
    });
  });
  it("keeps the selected contact visible when it is outside the contact choice page", async () => {
    read
      .mockResolvedValueOnce({ data: [{ contactId: "contact-1", name: "First" }] })
      .mockResolvedValueOnce({ data: { contactId: "contact-2", name: "Selected" } });
    const contacts = await fetchDuesContacts("organization-1", "", "contact-2");
    expect(contacts.map((contact) => contact.contactId)).toEqual(["contact-1", "contact-2"]);
    expect(read.mock.calls).toEqual([
      ["/orgs/organization-1/contacts?limit=100"],
      ["/orgs/organization-1/contacts/contact-2"],
    ]);
  });
});
