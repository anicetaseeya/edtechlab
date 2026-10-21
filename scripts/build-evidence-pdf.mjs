/**
 * Turns the JSON + screenshots written by tests/bot.spec.ts into
 * evidence/IEU-Labs-bot-test-evidence.pdf
 *
 *   node scripts/build-evidence-pdf.mjs
 *
 * Shows no passwords and no keys: it only reads the recorded step names,
 * results and notes, none of which contain either.
 */
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const EVIDENCE = "evidence";
const OUT = path.join(EVIDENCE, "IEU-Labs-bot-test-evidence.pdf");

const PROFILES = {
  laptop: "Laptop — 1280 × 800",
  phone: "Phone — 390 × 844",
};

// ---------------------------------------------------------------- load data
const files = readdirSync(EVIDENCE).filter((f) => /^results-.*\.json$/.test(f));
if (files.length === 0) {
  console.error("No results files in evidence/. Run the test first.");
  process.exit(1);
}

const runs = files
  .map((f) => JSON.parse(readFileSync(path.join(EVIDENCE, f), "utf8")))
  .sort((a, b) => a.project.localeCompare(b.project) || a.order - b.order);

const baseUrl = runs[0].baseUrl;
const startedAt = runs.map((r) => new Date(r.startedAt)).sort((a, b) => a - b)[0];

const madrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(startedAt);

const allSteps = runs.flatMap((r) =>
  r.steps.map((s) => ({ ...s, project: r.project, group: r.title, order: r.order })),
);
const total = allSteps.length;
const failed = allSteps.filter((s) => s.result === "FAIL").length;
const passed = total - failed;

// Launch first, so the real browser version can go into the document.
const browser = await chromium.launch();
const browserVersion = browser.version();

// --------------------------------------------------------------- build HTML
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tableFor(project) {
  const rows = runs
    .filter((r) => r.project === project)
    .flatMap((r) =>
      r.steps.map(
        (s) => `<tr>
          <td class="num">${r.order}.${s.n}</td>
          <td>${esc(s.step)}</td>
          <td class="res ${s.result === "PASS" ? "pass" : "fail"}">${s.result}</td>
          <td class="note">${esc(s.note)}</td>
        </tr>`,
      ),
    )
    .join("");
  return `<table>
    <thead><tr><th class="num">#</th><th>Step</th><th class="res">Result</th><th>What was observed</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function shotsFor(project) {
  return runs
    .filter((r) => r.project === project)
    .flatMap((r) =>
      r.steps
        .filter((s) => s.shot && statSyncSafe(path.join(EVIDENCE, project, s.shot)))
        .map(
          (s) => `<figure>
            <img src="${project}/${s.shot}" alt="${esc(s.step)}">
            <figcaption><strong>${r.order}.${s.n} ${esc(s.step)}</strong> — ${esc(s.note)}</figcaption>
          </figure>`,
        ),
    )
    .join("");
}

function statSyncSafe(p) {
  try {
    return statSync(p).size > 0;
  } catch {
    return false;
  }
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>IEU Labs — bot test evidence</title>
<style>
  :root { --blue:#000066; --ink:#0f0f0f; --muted:#4a4a55; --line:#d6d6e0; }
  * { box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:var(--ink); font-size:11pt; line-height:1.5; margin:0; }
  h1 { color:var(--blue); font-size:22pt; margin:0 0 4pt; }
  h2 { color:var(--blue); font-size:14pt; margin:18pt 0 6pt; page-break-after:avoid; }
  h3 { color:var(--blue); font-size:12pt; margin:14pt 0 4pt; page-break-after:avoid; }
  .sub { color:var(--muted); margin:0 0 14pt; }
  .meta { border:1px solid var(--line); border-left:5px solid var(--blue); padding:10pt 12pt; margin-bottom:14pt; }
  .meta dl { display:grid; grid-template-columns:auto 1fr; gap:3pt 12pt; margin:0; }
  .meta dt { font-weight:bold; color:var(--muted); }
  .meta dd { margin:0; word-break:break-all; }
  .tally { font-size:13pt; font-weight:bold; color:${failed ? "#9b1c1c" : "#14532d"}; margin:10pt 0 0; }
  table { width:100%; border-collapse:collapse; font-size:9.5pt; margin-bottom:10pt; }
  th, td { border:1px solid var(--line); padding:4pt 6pt; text-align:left; vertical-align:top; }
  th { background:#f5f5fa; color:var(--blue); }
  td.num, th.num { width:34pt; text-align:right; color:var(--muted); }
  td.res, th.res { width:46pt; text-align:center; font-weight:bold; }
  td.res.pass { color:#14532d; }
  td.res.fail { color:#9b1c1c; }
  td.note { color:var(--muted); }
  figure { margin:0 0 14pt; page-break-inside:avoid; }
  figure img { width:100%; border:1px solid var(--line); display:block; }
  figcaption { font-size:9pt; color:var(--muted); padding-top:3pt; }
  .phone-shots figure img { width:58%; }
  .pagebreak { page-break-before:always; }
  footer { margin-top:18pt; padding-top:8pt; border-top:1px solid var(--line); font-size:9pt; color:var(--muted); }
</style></head><body>

<h1>IEU Labs — grading bot test evidence</h1>
<p class="sub">Automated end-to-end test of the live site, run exactly as an automated grader would.</p>

<div class="meta"><dl>
  <dt>Live URL</dt><dd>${esc(baseUrl)}</dd>
  <dt>Run at</dt><dd>${esc(madrid)} (Europe/Madrid)</dd>
  <dt>Browser</dt><dd>Chromium ${esc(browserVersion)} (Playwright)</dd>
  <dt>Screen sizes</dt><dd>Laptop 1280 × 800 and phone 390 × 844; narrow-screen checks also at 320 px</dd>
  <dt>Test accounts</dt><dd>Created fresh for this run, each with a <code>qa-test-</code> email prefix</dd>
</dl>
<p class="tally">${passed} of ${total} checks passed${failed ? `, ${failed} failed` : ", 0 failed"}</p>
</div>

<h2>Results — ${esc(PROFILES.laptop)}</h2>
${tableFor("laptop")}

<h2>Results — ${esc(PROFILES.phone)}</h2>
${tableFor("phone")}

<footer>
  Passwords and API keys are never shown in this document. Password fields appear masked in every
  screenshot. IEU Labs is a student project, not an official IE University service.
</footer>

<div class="pagebreak"></div>
<h2>Screenshots — ${esc(PROFILES.laptop)}</h2>
${shotsFor("laptop")}

<div class="pagebreak"></div>
<h2>Screenshots — ${esc(PROFILES.phone)}</h2>
<div class="phone-shots">${shotsFor("phone")}</div>

</body></html>`;

const htmlPath = path.join(EVIDENCE, "report.html");
writeFileSync(htmlPath, html, "utf8");

// ----------------------------------------------------------------- make PDF
const page = await browser.newPage();
await page.goto("file:///" + path.resolve(htmlPath).replace(/\\/g, "/"));
await page.emulateMedia({ media: "print" });
await page.pdf({
  path: OUT,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#4a4a55;padding:0 12mm;text-align:right;">' +
    'IEU Labs bot test evidence — page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
});
await browser.close();

const mb = (statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`${OUT}  —  ${mb} MB  —  ${passed}/${total} passed, ${failed} failed`);
