import { MongoClient } from "mongodb";
import type { Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  bodyText,
  clickButtonContaining,
  clickInDialog,
  gotoWhenHydrated,
  message,
  waitForText,
  waitForTextIn,
} from "../test-support/browser-helpers";
import {
  clickByName,
  closePage,
  DESKTOP_VIEWPORT,
  openPage,
  PHONE_VIEWPORT,
  signInWithCookies,
  waitForDialogSettled,
} from "../test-support/browser-page";
import {
  seedOrganization,
  seedPerson,
  startBrowserStack,
  type BrowserStack,
  type SeededPerson,
} from "../test-support/browser-stack";
import { INITIAL_JS_BUDGET_KIB, measureInitialJs, toKiB } from "../test-support/initial-js-size";

const RETAIL_TERM = "গ্রাহক";
const COACHING_TERM = "ছাত্র-ছাত্রী";
const GUARDIAN_TERM = "অভিভাবক";
const CUSTOMER_NAME = "সুলতানা বেগম";
const CUSTOMER_NAME_EDITED = "সুলতানা আক্তার";
const STUDENT_ONE = "রাফি হাসান";
const STUDENT_TWO = "নাফিসা হাসান";
const GUARDIAN_NAME = "আব্দুল করিম";
const GUARDIAN_BY_HAND = "রিনা বেগম";

let stack: BrowserStack;
let owner: SeededPerson;
let customerPath = "";
let studentPath = "";

beforeAll(async () => {
  stack = await startBrowserStack();
  owner = await seedPerson("রহিম উদ্দিন");
  await seedOrganization(owner, "acme", "আকমি ট্রেডার্স");
  await seedOrganization(owner, "coach", "আলো কোচিং");
  await moveToTemplate("coach", "COACHING");
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

/**
 * Moves a business onto another template and bumps its config version so the API rebuilds the cached config,
 * the way a platform operator's change-template does. The coaching template is still a draft, so signup
 * cannot choose it.
 */
async function moveToTemplate(slug: string, industryTemplateKey: string): Promise<void> {
  const client = await MongoClient.connect(stack.mongoUri);
  try {
    const result = await client
      .db("browser_platform")
      .collection("organizations")
      .updateOne({ slug }, { $set: { industryTemplateKey }, $inc: { configVersion: 1 } });
    if (result.matchedCount !== 1) throw new Error(`No business with slug ${slug}`);
  } finally {
    await client.close();
  }
}

async function ownerPage(
  viewport: { width: number; height: number } = PHONE_VIEWPORT,
): Promise<Page> {
  const page = await openPage(stack.browser, viewport);
  await signInWithCookies(page, owner);
  return page;
}

async function waitForSheetClosed(page: Page): Promise<void> {
  await page.waitForSelector("[role=dialog]", { hidden: true });
}

/** Opens the add sheet from the list: the button reads "New {term}" in the business's own word. */
async function openAddSheet(page: Page, slug: string, term: string): Promise<void> {
  await gotoWhenHydrated(page, `/${slug}/contacts`, "main button");
  await clickByName(page, message("contacts.add").replace("{term}", term));
  await waitForDialogSettled(page);
}

async function saveSheet(page: Page): Promise<void> {
  await clickInDialog(page, message("common.save"));
  await waitForSheetClosed(page);
}

async function pathOfOpenedContact(page: Page, name: string): Promise<string> {
  await clickButtonContaining(page, name);
  await page.waitForFunction(() => /\/contacts\/[0-9a-f-]{36}$/.test(location.pathname));
  return page.evaluate(() => window.location.pathname);
}

async function rowCount(page: Page): Promise<number> {
  return page.$$eval("tbody tr", (rows) => rows.length);
}

describe("a retail business: add, find, edit, archive", () => {
  it("shows the business's word for a contact in the title and adds a customer", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/contacts", "main button");
    await waitForTextIn(page, "h1", RETAIL_TERM);
    await openAddSheet(page, "acme", RETAIL_TERM + " / গ্রাহকরা");
    await page.type("#contact-name", CUSTOMER_NAME);
    await page.type("#contact-phone", "01712345678");
    await saveSheet(page);
    await gotoWhenHydrated(page, "/acme/contacts", "main button");
    await waitForText(page, CUSTOMER_NAME);
    await closePage(page);
  });

  it("finds the customer by the phone in national form and not by another number", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/contacts?q=01712345", "main button");
    await waitForText(page, CUSTOMER_NAME);
    await gotoWhenHydrated(page, "/acme/contacts?q=01999", "main button");
    await waitForText(page, message("contacts.empty").split("{term}")[0] ?? "");
    const text = await bodyText(page);
    await closePage(page);

    expect(text).not.toContain(CUSTOMER_NAME);
  });

  it("offers the existing contact when the phone is already known", async () => {
    const page = await ownerPage();
    await openAddSheet(page, "acme", RETAIL_TERM + " / গ্রাহকরা");
    await page.type("#contact-name", "অন্য নাম");
    await page.type("#contact-phone", "+8801712345678");
    await clickInDialog(page, message("common.save"));
    await waitForText(page, message("contacts.form.duplicate.open"));
    await closePage(page);
  });

  it("edits the customer and shows the new name on the detail page", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/acme/contacts", "main button");
    customerPath = await pathOfOpenedContact(page, CUSTOMER_NAME);
    await waitForText(page, message("contacts.action.edit"));
    await clickByName(page, message("contacts.action.edit"));
    await waitForDialogSettled(page);
    await page.click("#contact-name", { count: 3 });
    await page.type("#contact-name", CUSTOMER_NAME_EDITED);
    await saveSheet(page);
    await gotoWhenHydrated(page, customerPath, "main button");
    await waitForTextIn(page, "h1", CUSTOMER_NAME_EDITED);
    await closePage(page);
  });

  it("archives the customer: gone from the list, found under archived", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, customerPath, "main button");
    await clickByName(page, message("contacts.action.archive"));
    await waitForDialogSettled(page);
    await clickInDialog(page, message("contacts.action.archive"));
    await waitForText(page, message("contacts.status.ARCHIVED"));
    await gotoWhenHydrated(page, "/acme/contacts", "main button");
    const active = await bodyText(page);
    await gotoWhenHydrated(page, "/acme/contacts?status=ARCHIVED", "main button");
    await waitForText(page, CUSTOMER_NAME_EDITED);
    await closePage(page);

    expect(active).not.toContain(CUSTOMER_NAME_EDITED);
  });
});

describe("a coaching centre: students, guardians and the link", () => {
  async function addStudent(name: string, guardianName: string): Promise<void> {
    const page = await ownerPage();
    await openAddSheet(page, "coach", COACHING_TERM);
    await page.type("#contact-name", name);
    await page.select("#contact-custom-class_level", "CLASS_5");
    await clickInDialog(page, message("form.contactLink.createNew"));
    await page.type("#contact-custom-guardian-new-name", guardianName);
    await page.type("#contact-custom-guardian-new-phone", "01712349001");
    await saveSheet(page);
    await closePage(page);
  }

  it("reads the centre's word in the title and adds a student with a new guardian", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/coach/contacts", "main button");
    await waitForTextIn(page, "h1", COACHING_TERM);
    await closePage(page);

    await addStudent(STUDENT_ONE, GUARDIAN_NAME);
  });

  it("lists the guardian as a related person", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/coach/contacts?role=RELATED", "main button");
    await waitForText(page, GUARDIAN_NAME);
    await closePage(page);
  });

  it("links the same guardian for a second student, so there is one guardian", async () => {
    await addStudent(STUDENT_TWO, "অন্যভাবে লেখা নাম");

    const page = await ownerPage(DESKTOP_VIEWPORT);
    await gotoWhenHydrated(page, "/coach/contacts?role=RELATED", "main button");
    await waitForText(page, GUARDIAN_NAME);
    const guardians = await rowCount(page);
    await closePage(page);

    expect(guardians).toBe(1);
  });

  it("shows the guardian on the student's page, as a link to the guardian", async () => {
    const page = await ownerPage();
    await gotoWhenHydrated(page, "/coach/contacts?role=CUSTOMER", "main button");
    studentPath = await pathOfOpenedContact(page, STUDENT_ONE);
    await waitForText(page, GUARDIAN_NAME);
    const linkHref = await page.$eval(
      "main a[href*='/contacts/']",
      (anchor) => anchor.getAttribute("href") ?? "",
    );
    await closePage(page);

    expect(linkHref).toMatch(/^\/coach\/contacts\/[0-9a-f-]{36}$/);
  });

  it("adds a guardian by hand as a related person, without the student's fields", async () => {
    const page = await ownerPage();
    await openAddSheet(page, "coach", COACHING_TERM);
    await clickInDialog(page, COACHING_TERM);
    await clickInDialog(page, GUARDIAN_TERM);
    await waitForDialogSettled(page);
    const studentFieldsLeft = await page.$$(
      "#contact-custom-class_level, #contact-custom-guardian",
    );
    await page.type("#contact-name", GUARDIAN_BY_HAND);
    await saveSheet(page);
    await gotoWhenHydrated(page, "/coach/contacts?role=RELATED", "main button");
    await waitForText(page, GUARDIAN_BY_HAND);
    await closePage(page);

    expect(studentFieldsLeft).toHaveLength(0);
  });
});

describe("the contact routes on a phone (13-UX sections 3 and 11)", () => {
  it.each<[string, () => string]>([
    ["list", () => "/coach/contacts"],
    ["detail", () => studentPath],
  ])("stay within the JavaScript budget and do not scroll sideways: %s", async (_name, route) => {
    const page = await ownerPage();
    const path = route();
    const size = await measureInitialJs(page, path);
    process.stdout.write(
      `initial JS ${path}: ${size.gzipBytes} B = ${toKiB(size.gzipBytes)} KiB\n`,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await closePage(page);

    expect(toKiB(size.gzipBytes), path).toBeLessThanOrEqual(INITIAL_JS_BUDGET_KIB);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
