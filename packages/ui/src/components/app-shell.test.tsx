import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.js";

function renderShell(hasSidebar?: boolean) {
  return render(
    <AppShell
      topBar={<header>top</header>}
      sidebar={<nav aria-label="Main navigation">side</nav>}
      bottomNav={<nav aria-label="Bottom navigation">bottom</nav>}
      {...(hasSidebar === undefined ? {} : { hasSidebar })}
    >
      content
    </AppShell>,
  );
}

describe("AppShell", () => {
  it("renders the sidebar by default", () => {
    renderShell();
    expect(screen.getByLabelText("Main navigation")).not.toBeNull();
  });

  it("renders no sidebar landmark when hasSidebar is false", () => {
    renderShell(false);
    expect(screen.queryByLabelText("Main navigation")).toBeNull();
    expect(screen.getByLabelText("Bottom navigation")).not.toBeNull();
  });
});
