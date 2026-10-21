import { test, expect, type Page } from "@playwright/test";

/**
 * Walks the exact path an automated grading bot takes, at laptop and phone
 * sizes (see the two projects in playwright.config.ts).
 *
 *   npm test                                        -> against localhost
 *   BASE_URL=https://your-app.vercel.app npm test   -> against your live URL
 */

const CORE_TEXT = "QA-7F3K2A grading bot test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** Every table in the app. None of them may hand anything to a stranger. */
const TABLES = [
  "entries",
  "lab_seats",
  "rounds",
  "applications",
  "lottery",
  "rankings",
  "results",
];

function newEmail(tag: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `qa-${tag}-${Date.now().toString(36)}-${rand}@example.com`;
}

const PASSWORD = "GradingBot!2468";

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(PASSWORD);
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app", { timeout: 30_000 });
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

test.describe("the grading bot path", () => {
  test("sign up, save an entry, log out, log back in, and stay private", async ({
    page,
    browser,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    // --- a stranger lands on the public home page ---
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /get a fair lab place/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^sign up$/i }).first()).toBeVisible();

    // --- sign up ---
    const email = newEmail("a");
    await signUp(page, email);
    await expect(page).toHaveURL(/\/app$/);

    // --- the main feature: type in core-input only, then click core-submit ---
    const input = page.getByTestId("core-input");
    await expect(input).toBeVisible();
    await input.fill(CORE_TEXT);
    await page.getByTestId("core-submit").click();

    // --- the saved item shows up ---
    const item = page.getByTestId("core-item").filter({ hasText: CORE_TEXT });
    await expect(item).toHaveCount(1);
    await expect(item.first()).toContainText(CORE_TEXT);

    // it really is saved, not only on screen
    await page.reload();
    await expect(
      page.getByTestId("core-item").filter({ hasText: CORE_TEXT }),
    ).toHaveCount(1);

    // --- log out ---
    await expect(page.getByTestId("logout")).toBeVisible();
    await page.getByTestId("logout").click();
    await page.waitForURL(/\/login$/, { timeout: 30_000 });

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);

    // --- a fresh browser: wrong password is rejected ---
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();

    await logIn(freshPage, email, "DefinitelyWrong!1234");
    await expect(freshPage.getByRole("alert")).toBeVisible();
    await expect(freshPage).toHaveURL(/\/login$/);
    await expect(freshPage.getByTestId("core-input")).toHaveCount(0);

    // --- the right password works and the entry is still there ---
    await logIn(freshPage, email, PASSWORD);
    await freshPage.waitForURL("**/app", { timeout: 30_000 });
    await expect(
      freshPage.getByTestId("core-item").filter({ hasText: CORE_TEXT }),
    ).toHaveCount(1);
    await fresh.close();

    // --- a second student cannot see the first student's entry ---
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signUp(otherPage, newEmail("b"));
    await expect(otherPage.getByTestId("core-input")).toBeVisible();
    await expect(
      otherPage.getByTestId("core-item").filter({ hasText: CORE_TEXT }),
    ).toHaveCount(0);
    await other.close();
  });

  test("/app and /apply send a logged-out visitor to /login", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId("login-email")).toBeVisible();

    await page.goto("/apply");
    await expect(page).toHaveURL(/\/login$/);

    await context.close();
  });

  test("no table gives a stranger any rows through the Supabase API", async ({ request }) => {
    expect(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL must be set").not.toEqual("");
    expect(SUPABASE_KEY, "the publishable key must be set").not.toEqual("");

    for (const table of TABLES) {
      const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        failOnStatusCode: false,
      });

      if (res.ok()) {
        // Allowed to answer, but it must hand over nothing.
        const body = await res.json();
        expect(Array.isArray(body), `${table} should return a list`).toBe(true);
        expect(body, `${table} leaked rows to an anonymous caller`).toEqual([]);
      } else {
        // Refusing outright is just as good.
        expect(res.status(), `${table} returned an unexpected status`).toBeGreaterThanOrEqual(400);
      }
    }
  });

  test("the publishable key cannot run the matching functions either", async ({ request }) => {
    for (const fn of ["ieu_my_status", "ieu_settle", "ieu_drop"]) {
      const res = await request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        data: {},
        failOnStatusCode: false,
      });
      expect(res.ok(), `${fn} should not run for an anonymous caller`).toBe(false);
    }
  });
});
