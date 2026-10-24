import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render-markdown";

describe("markdown rendering", () => {
  it("drops raw HTML and keeps safe links only", () => {
    const html = renderMarkdown(
      [
        "Hello <script>alert(1)</script>",
        "",
        "[site](https://example.com/about) [mail](mailto:help@example.com)",
        "",
        "[bad](javascript:alert(1)) [relative](/pages/faq)",
      ].join("\n"),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://example.com/about"');
    expect(html).toContain('href="mailto:help@example.com"');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="/pages/faq"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
  });
});
