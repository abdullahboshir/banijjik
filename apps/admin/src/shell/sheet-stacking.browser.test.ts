import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

declare global {
  interface ImportMetaEnv {
    /** Path of the Chrome executable; vitest exposes the process environment here. */
    readonly CHROME_PATH?: string;
  }
}

const requireFromHere = createRequire(import.meta.url);
const PORT = 3101;
const PAGE_URL = `http://localhost:${PORT}/test-org`;
const PHONE_VIEWPORT = { width: 375, height: 812, isMobile: true, hasTouch: true } as const;
const SERVER_READY_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const labels = BUNDLED_CATALOGS.bn;

let server: ChildProcess;
let browser: Browser;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(PAGE_URL);
      if (response.ok) return;
    } catch {
      // The server is still starting; the deadline ends the wait.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error("next start did not become ready in time");
}

function chromePath(): string {
  const path = import.meta.env.CHROME_PATH;
  if (!path) throw new Error("Set CHROME_PATH to a Chrome executable (no browser is downloaded)");
  return path;
}

async function openSheet(page: Page, triggerLabel: string): Promise<void> {
  await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
  // React puts a __reactProps key on an element once it is hydrated; a click before that does nothing.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("nav button")).every((button) =>
      Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
  await page.evaluate((text) => {
    const buttons = Array.from(document.querySelectorAll("nav button"));
    buttons
      .find(
        (button) =>
          button.textContent?.includes(text) || button.getAttribute("aria-label") === text,
      )
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, triggerLabel);
  await page.waitForSelector("[role=dialog]");
  await page.waitForFunction(
    () => (document.querySelector("[role=dialog]")?.getAnimations().length ?? 1) === 0,
  );
}

/** Whether the element on top at the given point of the open dialog is part of the dialog. */
async function isDialogOnTop(page: Page, closeLabel: string): Promise<boolean[]> {
  return page.evaluate((closeText) => {
    const dialog = document.querySelector("[role=dialog]");
    const closeButton = dialog?.querySelector(`[aria-label="${closeText}"]`);
    if (!dialog || !closeButton) return [false, false];
    const topAt = (element: Element): Element | null => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    };
    const centreTop = topAt(dialog);
    const closeTop = topAt(closeButton);
    return [dialog.contains(centreTop), dialog.contains(closeTop)];
  }, closeLabel);
}

beforeAll(async () => {
  server = spawn(
    process.execPath,
    [requireFromHere.resolve("next/dist/bin/next"), "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
  await waitForServer();
  browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
});

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe("sheet stacking at 375 px (review J3)", () => {
  it.each([
    ["Quick create", labels["nav.quickCreate"]],
    ["More", labels["nav.more"]],
  ])("%s sheet is on top at its centre and at its close button", async (_name, triggerLabel) => {
    const page = await browser.newPage();
    await page.setViewport(PHONE_VIEWPORT);
    await openSheet(page, triggerLabel ?? "");
    const [centreIsDialog, closeIsDialog] = await isDialogOnTop(
      page,
      labels["shell.closeMenu"] ?? "",
    );
    await page.close();
    expect({ centreIsDialog, closeIsDialog }).toEqual({
      centreIsDialog: true,
      closeIsDialog: true,
    });
  });

  it("gives the two navigation landmarks different labels", async () => {
    const page = await browser.newPage();
    await page.setViewport(PHONE_VIEWPORT);
    await page.goto(PAGE_URL, { waitUntil: "networkidle0" });
    const names = await page.$$eval("nav[aria-label]", (navs) =>
      navs.map((nav) => nav.getAttribute("aria-label")),
    );
    await page.close();
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain(labels["nav.bottom"]);
  });
});
