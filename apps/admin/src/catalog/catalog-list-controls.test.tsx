// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { KindChips, Pager, SearchForm, StatusChips } from "./catalog-list-controls";
import { parseCatalogQuery } from "./catalog-query";
import { allKindWords } from "./catalog-words";

const translator = banglaTranslator();
const { t } = translator;
const BASE = "/shop/catalog";

describe("the kind chips", () => {
  it("are hidden when the business offers one kind", () => {
    const words = allKindWords({ terms: {}, kinds: ["PRODUCT"], translator });

    const { container } = render(
      <KindChips
        basePath={BASE}
        query={parseCatalogQuery({})}
        t={t}
        kinds={["PRODUCT"]}
        words={words}
      />,
    );

    expect(container.textContent).toBe("");
  });

  it("use the business words and mark the chosen kind", () => {
    const terms = { "offering.SERVICE": { bn: "সেবা", en: "Treatment" } };
    const words = allKindWords({ terms, kinds: ["SERVICE", "PRODUCT"], translator });

    render(
      <KindChips
        basePath={BASE}
        query={parseCatalogQuery({ kind: "SERVICE" })}
        t={t}
        kinds={["SERVICE", "PRODUCT"]}
        words={words}
      />,
    );

    const chosen = screen.getByRole("link", { name: "সেবা" });
    expect(chosen.getAttribute("aria-current")).toBe("true");
    expect(chosen.getAttribute("href")).toBe(`${BASE}?kind=SERVICE`);
    expect(screen.getByRole("link", { name: t("catalog.filter.all") }).getAttribute("href")).toBe(
      BASE,
    );
  });
});

describe("the status chips, the search and the pager", () => {
  it("keep the other filters in the address when the status changes", () => {
    render(
      <StatusChips basePath={BASE} query={parseCatalogQuery({ q: "rice", page: "3" })} t={t} />,
    );

    expect(
      screen.getByRole("link", { name: t("catalog.status.ARCHIVED") }).getAttribute("href"),
    ).toBe(`${BASE}?status=ARCHIVED&q=rice`);
  });

  it("offers the branch choice only with two or more branches", () => {
    const query = parseCatalogQuery({});
    const one = [{ locationId: "a", name: "Main" }];
    const two = [...one, { locationId: "b", name: "Second" }];
    const draw = (locations: typeof two) =>
      render(<SearchForm query={query} t={t} categories={[]} locations={locations as never} />);

    const first = draw(one);
    expect(screen.queryByLabelText(t("catalog.filter.location"))).toBeNull();
    first.unmount();
    draw(two);
    expect(screen.getByLabelText(t("catalog.filter.location"))).toBeTruthy();
  });

  it("shows previous and next links around the current page", () => {
    render(<Pager basePath={BASE} query={parseCatalogQuery({ page: "2" })} hasNext t={t} />);

    expect(
      screen.getByRole("link", { name: t("catalog.page.previous") }).getAttribute("href"),
    ).toBe(BASE);
    expect(screen.getByRole("link", { name: t("catalog.page.next") }).getAttribute("href")).toBe(
      `${BASE}?page=3`,
    );
  });
});
