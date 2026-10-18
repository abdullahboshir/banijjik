import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { contactTermOf, roleLabelOf, roleOptionsOf } from "./contact-labels";

const { t } = banglaTranslator();

describe("contact words", () => {
  it("names a contact by the business's term, or by the catalog word when it has none", () => {
    const withTerm = {
      terms: { contact: { bn: "ছাত্র-ছাত্রী", en: "Student" } },
      locale: "bn",
      t,
    } as const;
    const without = { terms: {}, locale: "bn", t } as const;

    expect(contactTermOf(withTerm)).toBe("ছাত্র-ছাত্রী");
    expect(contactTermOf(without)).toBe(t("contacts.term"));
  });

  it("names a role by its term, then (for a customer) by the contact term, then by the catalog", () => {
    const words = {
      terms: {
        contact: { bn: "ছাত্র-ছাত্রী", en: "Student" },
        "contact.RELATED": { bn: "অভিভাবক", en: "Guardian" },
      },
      locale: "bn",
      t,
    } as const;

    expect(roleLabelOf("RELATED", words)).toBe("অভিভাবক");
    expect(roleLabelOf("CUSTOMER", words)).toBe("ছাত্র-ছাত্রী");
    expect(roleLabelOf("SUPPLIER", words)).toBe(t("contactRole.SUPPLIER"));
  });

  it("offers only the roles the template lists, in its order", () => {
    const words = { terms: {}, locale: "en", t } as const;

    expect(roleOptionsOf(["LEAD", "CUSTOMER"], words).map((option) => option.role)).toEqual([
      "LEAD",
      "CUSTOMER",
    ]);
  });
});
