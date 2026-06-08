import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:8080";

const ROUTES = [
  "/",
  "/auth",
  "/dashboard",
  "/cross-sell-dashboard",
  "/accounts",
  "/contacts",
  "/mandates",
  "/pipeline",
  "/targets",
  "/targets/mandate",
  "/targets/pipeline",
  "/targets/top-level-target",
  "/admin/users",
  "/admin/nso",
  "/admin/kam-team-mapping",
  "/admin/nps",
  "/admin/nps/configure",
  "/nps/smoke-test-token",
];

const IGNORE_PATTERNS = [
  /favicon\.ico/i,
  /Failed to load resource.*401/i,
  /Failed to load resource.*403/i,
  /Failed to load resource.*404/i,
  /Failed to load resource.*400/i,
  /net::ERR_/i,
  /Auth session missing/i,
  /Invalid Refresh Token/i,
];

function shouldIgnore(text) {
  return IGNORE_PATTERNS.some((re) => re.test(text));
}

async function tryLogin(page) {
  const email = process.env.SMOKE_EMAIL;
  const password = process.env.SMOKE_PASSWORD;
  if (!email || !password) return false;

  await page.goto(`${BASE}/auth`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const failures = [];

  page.on("pageerror", (err) => {
    failures.push({ type: "pageerror", route: currentRoute, message: err.message });
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (shouldIgnore(text)) return;
    failures.push({ type: "console", route: currentRoute, message: text });
  });

  let currentRoute = "";
  const loggedIn = await tryLogin(page);
  if (loggedIn) {
    console.log("Authenticated smoke: logged in via SMOKE_EMAIL");
  } else {
    console.log("Unauthenticated smoke: protected routes will redirect to /auth");
  }

  const routesToVisit = loggedIn ? ROUTES.filter((r) => r !== "/") : ROUTES;

  for (const route of routesToVisit) {
    currentRoute = route;
    try {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(1500);
      const status = response?.status() ?? 0;
      if (status >= 500) {
        failures.push({ type: "http", route, message: `HTTP ${status}` });
      }
      const bodyText = await page.locator("body").innerText();
      if (/ReferenceError|TypeError|is not defined|Something went wrong/i.test(bodyText)) {
        failures.push({ type: "render", route, message: bodyText.slice(0, 300) });
      }
    } catch (err) {
      failures.push({
        type: "navigation",
        route,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await browser.close();

  if (failures.length === 0) {
    console.log(`OK: ${routesToVisit.length} routes checked at ${BASE}`);
    process.exit(0);
  }

  console.error(`FAIL: ${failures.length} issue(s) found`);
  for (const f of failures) {
    console.error(`- [${f.type}] ${f.route}: ${f.message}`);
  }
  process.exit(1);
}

main();
