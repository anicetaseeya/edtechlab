import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Walks the exact path an automated grading bot takes, at laptop (1280x800)
 * and phone (390x844) sizes, and writes a screenshot plus a pass/fail record
 * for every step into evidence/.
 *
 *   npm test                                        -> against localhost
 *   BASE_URL=https://edtechlab.vercel.app npm test   -> against the live URL
 *
 * Test accounts always use a "qa-test-" email prefix so they can be told
 * apart from real students. Passwords and keys are never written to evidence.
 */

const CORE_TEXT = "QA-7F3K2A grading bot test";
const PASSWORD = "GradingBot!2468";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** Every table in the app. None may hand anything to a stranger. */
const TABLES = ["entries", "lab_seats", "rounds", "applications", "lottery", "rankings", "results"];

/** Every data-testid the grading contract asks for, and where it must appear. */
const CONTRACT_TESTIDS: Record<string, string[]> = {
  "/signup": ["signup-email", "signup-password", "signup-submit"],
  "/login": ["login-email", "login-password", "login-submit"],
  "/app": ["core-input", "core-submit", "logout"],
};

function newEmail(tag: string) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `qa-test-${tag}-${Date.now().toString(36)}-${rand}@example.com`;
}

// ---------------------------------------------------------------------------
// Evidence recording — one JSON file per test per project, merged into the PDF
// ---------------------------------------------------------------------------

type StepRecord = { n: number; step: string; result: "PASS" | "FAIL"; note: string; shot?: string };

class Evidence {
  readonly dir: string;
  readonly steps: StepRecord[] = [];
  readonly startedAt = new Date().toISOString();
  private n = 0;

  constructor(
    readonly project: string,
    readonly order: number,
    readonly title: string,
  ) {
    this.dir = path.join("evidence", project);
    mkdirSync(this.dir, { recursive: true });
  }

  private slug(name: string) {
    return `t${this.order}-${String(this.n).padStart(2, "0")}-${name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 52)}`;
  }

  /** Runs one step, screenshots it, and records pass or fail. */
  async step(page: Page, name: string, body: () => Promise<string | void>) {
    this.n += 1;
    const shot = `${this.slug(name)}.png`;
    let result: "PASS" | "FAIL" = "PASS";
    let note = "";
    try {
      note = (await body()) || "";
    } catch (err) {
      result = "FAIL";
      note = String(err).split("\n")[0].slice(0, 200);
      throw err;
    } finally {
      try {
        await page.screenshot({ path: path.join(this.dir, shot) });
      } catch {
        /* a closed page cannot be photographed */
      }
      this.steps.push({ n: this.n, step: name, result, note, shot });
      this.save();
    }
  }

  /** A check with no page of its own (the Supabase API checks). */
  record(name: string, result: "PASS" | "FAIL", note = "") {
    this.n += 1;
    this.steps.push({ n: this.n, step: name, result, note });
    this.save();
  }

  save() {
    writeFileSync(
      path.join("evidence", `results-${this.project}-t${this.order}.json`),
      JSON.stringify(
        {
          project: this.project,
          order: this.order,
          title: this.title,
          baseUrl: BASE_URL,
          startedAt: this.startedAt,
          steps: this.steps,
        },
        null,
        2,
      ),
    );
  }
}

/** Horizontal overflow of the page itself, in pixels. */
async function sidewaysScroll(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

async function signUp(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(PASSWORD);
  await page.getByTestId("signup-submit").click();
  await page.waitForURL("**/app", { timeout: 60_000 });
}

// ---------------------------------------------------------------------------

test.describe("the grading bot path", () => {
  test("sign up, save an entry, log out, log back in, and stay private", async ({
    page,
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const project = testInfo.project.name;
    const ev = new Evidence(project, 1, "The grading bot path");
    const email = newEmail("a");

    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

    // 1 — the public landing page
    await ev.step(page, "Landing page loads for a stranger", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /get a fair lab place/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /^sign up$/i }).first()).toBeVisible();
      // The first screen a stranger sees, saved for the submission.
      await page.screenshot({
        path: path.join("evidence", project === "phone" ? "landing-phone.png" : "landing-laptop.png"),
      });
      const h1 = await page.getByRole("heading", { level: 1 }).first().innerText();
      return `headline reads "${h1}"`;
    });

    // 2 — the sign-up form
    await ev.step(page, "Sign-up form shows the contract fields", async () => {
      await page.goto("/signup");
      for (const id of CONTRACT_TESTIDS["/signup"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      return "signup-email, signup-password and signup-submit are all present";
    });

    // 3 — sign up
    await ev.step(page, "Sign up goes straight to /app, no email check", async () => {
      await page.getByTestId("signup-email").fill(email);
      await page.getByTestId("signup-password").fill(PASSWORD);
      await page.getByTestId("signup-submit").click();
      await page.waitForURL("**/app", { timeout: 60_000 });
      await expect(page.getByTestId("core-input")).toBeVisible();
      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("check your email");
      expect(body).not.toContain("confirm your email");
      return `landed on ${new URL(page.url()).pathname} with no "check your email" message`;
    });

    // 4 — the main feature's test ids
    await ev.step(page, "/app shows core-input, core-submit and logout", async () => {
      for (const id of CONTRACT_TESTIDS["/app"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      const type = await page.getByTestId("core-input").getAttribute("type");
      return `core-input is a text field (type="${type}")`;
    });

    // 5 — save, typing in core-input only
    await ev.step(page, "Typing only in core-input saves an item", async () => {
      await page.getByTestId("core-input").fill(CORE_TEXT);
      await page.getByTestId("core-submit").click();
      await expect(page.getByTestId("core-item").filter({ hasText: CORE_TEXT })).toHaveCount(1);
      return `a core-item now shows "${CORE_TEXT}"`;
    });

    // 6 — it is really in the database
    await ev.step(page, "The item survives a page reload", async () => {
      await page.reload();
      await expect(page.getByTestId("core-item").filter({ hasText: CORE_TEXT })).toHaveCount(1);
      return "still listed after a reload, so it is stored server-side, not in the browser";
    });

    // 7 — log out
    await ev.step(page, "Logout works", async () => {
      await expect(page.getByTestId("logout")).toBeVisible();
      await page.getByTestId("logout").click();
      await page.waitForURL(/\/login$/, { timeout: 60_000 });
      return `logged out and sent to ${new URL(page.url()).pathname}`;
    });

    // 8 — a wrong password, in a clean browser
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await ev.step(freshPage, "A wrong password is rejected with a visible error", async () => {
      await submitLogin(freshPage, email, "DefinitelyWrong!1234");
      // Target the app's own error box. Next.js adds an invisible
      // role="alert" route announcer, so getByRole("alert") alone would
      // match that empty element and pass without proving anything.
      const errorBox = freshPage.locator("p.msg-error[role=alert]");
      await expect(errorBox).toBeVisible();
      await expect(errorBox).not.toBeEmpty();
      await expect(freshPage).toHaveURL(/\/login$/);
      await expect(freshPage.getByTestId("core-input")).toHaveCount(0);
      const msg = (await errorBox.innerText()).trim();
      expect(msg.length).toBeGreaterThan(10);
      return `error shown on screen: "${msg}" — still on /login`;
    });

    // 9 — the right password
    await ev.step(freshPage, "The right password logs in and the item is still there", async () => {
      await submitLogin(freshPage, email, PASSWORD);
      await freshPage.waitForURL("**/app", { timeout: 60_000 });
      await expect(freshPage.getByTestId("core-item").filter({ hasText: CORE_TEXT })).toHaveCount(1);
      return "logged in from a clean browser and the saved item is listed again";
    });
    await fresh.close();

    // 10 — a second student sees nothing
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await ev.step(otherPage, "A second user cannot see the first user's item", async () => {
      await signUp(otherPage, newEmail("b"));
      await expect(otherPage.getByTestId("core-input")).toBeVisible();
      await expect(otherPage.getByTestId("core-item").filter({ hasText: CORE_TEXT })).toHaveCount(0);
      const total = await otherPage.getByTestId("core-item").count();
      return `the second account sees ${total} items, none of them the first user's`;
    });
    await other.close();

    ev.record(
      "No browser console errors during the run",
      consoleErrors.length === 0 ? "PASS" : "FAIL",
      consoleErrors.length === 0
        ? "the browser console stayed clean throughout"
        : consoleErrors.join(" | ").slice(0, 200),
    );
    expect(consoleErrors, consoleErrors.join(" | ")).toEqual([]);
  });

  test("logged out, /app and /apply redirect to /login", async ({ browser }, testInfo) => {
    const ev = new Evidence(testInfo.project.name, 2, "Logged-out visitors are kept out");
    const context = await browser.newContext();
    const page = await context.newPage();

    await ev.step(page, "Logged out, /app redirects to /login", async () => {
      await page.goto("/app");
      await expect(page).toHaveURL(/\/login$/);
      for (const id of CONTRACT_TESTIDS["/login"]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      return "/app sent us to /login, which shows the login form";
    });

    await ev.step(page, "Logged out, /apply redirects to /login", async () => {
      await page.goto("/apply");
      await expect(page).toHaveURL(/\/login$/);
      return "/apply sent us to /login as well";
    });

    await context.close();
  });

  test("no sideways scrolling at 390px and 320px", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const ev = new Evidence(testInfo.project.name, 3, "Narrow screens");
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    // Public pages first, while still logged out.
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/", "/signup", "/login"]) {
        await ev.step(page, `No sideways scrolling on ${route} at ${width}px`, async () => {
          await page.goto(route);
          const overflow = await sidewaysScroll(page);
          expect(overflow, `${route} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
          return `${route} at ${width}px wide: no horizontal overflow`;
        });
      }
    }

    // Then /app, which needs an account.
    await page.setViewportSize({ width: 390, height: 844 });
    await signUp(page, newEmail("narrow"));
    for (const width of [390, 320]) {
      await ev.step(page, `No sideways scrolling on /app at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/app");
        await expect(page.getByTestId("core-input")).toBeVisible();
        const overflow = await sidewaysScroll(page);
        expect(overflow, `/app overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
        return `/app at ${width}px wide: no horizontal overflow, core-input still usable`;
      });
    }

    await context.close();
  });

  test("no table gives a stranger any rows through the Supabase API", async ({
    request,
  }, testInfo) => {
    const ev = new Evidence(testInfo.project.name, 4, "Nothing is readable without logging in");
    expect(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL must be set").not.toEqual("");
    expect(SUPABASE_KEY, "the publishable key must be set").not.toEqual("");

    for (const table of TABLES) {
      const res = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        failOnStatusCode: false,
      });

      let note: string;
      if (res.ok()) {
        const body = await res.json();
        expect(Array.isArray(body), `${table} should return a list`).toBe(true);
        expect(body, `${table} leaked rows to an anonymous caller`).toEqual([]);
        note = `HTTP ${res.status()}, zero rows returned`;
      } else {
        expect(res.status(), `${table} returned an unexpected status`).toBeGreaterThanOrEqual(400);
        note = `HTTP ${res.status()} — permission denied`;
      }
      ev.record(`Table "${table}" gives a stranger nothing`, "PASS", note);
    }
  });

  test("the publishable key cannot run the matching functions either", async ({
    request,
  }, testInfo) => {
    const ev = new Evidence(testInfo.project.name, 5, "Database functions refuse strangers");
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
      ev.record(`Function "${fn}" refuses a stranger`, "PASS", `HTTP ${res.status()}`);
    }
  });
});
