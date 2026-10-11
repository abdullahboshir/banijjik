import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import {
  closePage,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
} from "../test-support/browser-page";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

let stack: BrowserStack;
let person: SeededPerson;

beforeAll(async () => {
  stack = await startBrowserStack();
  person = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(person, "acme", "আকমি ট্রেডার্স");
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

const ROUTES = ["/acme"];

describe("initial JavaScript per route (13-UX section 11)", () => {
  it.each(ROUTES)("stays within the budget on %s", async (route) => {
    const page = await openPage(stack.browser, PHONE_VIEWPORT);
    await signInWithCookies(page, person);
    const size = await measureInitialJs(page, route);
    await closePage(page);
    process.stdout.write(
      size.files
        .map(
          (file) => `  ${file.source} ${file.gzipBytes}
`,
        )
        .join(""),
    );
    process.stdout.write(
      `initial JS ${route}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB in ${size.fileCount} files\n`,
    );
    expect(toKiB(size.gzipBytes)).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
  });
});
