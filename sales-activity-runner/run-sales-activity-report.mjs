import "dotenv/config";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { authenticator } from "otplib";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataRoot = path.resolve(repoRoot, "data");
const storageKey = sanitizeStorageKey(process.env.SALES_ACTIVITY_STORAGE_KEY || "");
const storageSegment = storageKey && storageKey !== "sales" ? storageKey : "";
const uploadsRoot = storageSegment
  ? path.resolve(dataRoot, "uploads", "sales-analytics", storageSegment)
  : path.resolve(dataRoot, "uploads", "sales-analytics");
const salesAnalyticsRoot = storageSegment
  ? path.resolve(dataRoot, "sales-analytics", storageSegment)
  : path.resolve(dataRoot, "sales-analytics");
const logsRoot = path.join(salesAnalyticsRoot, "logs");
const latestRunPath = path.join(salesAnalyticsRoot, "latest.json");
const historyPath = path.join(salesAnalyticsRoot, "history.json");
const statusPath = path.join(salesAnalyticsRoot, "status.json");
const logPath = path.join(logsRoot, "runner.log");
const browserLockPath = path.join(dataRoot, "sales-activity", "chrome-profile.lock");

for (const dir of [dataRoot, uploadsRoot, salesAnalyticsRoot, logsRoot]) {
  mkdirSync(dir, { recursive: true });
}

const scheduleDays = parseList(process.env.SALES_ACTIVITY_SCHEDULE_DAYS, [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]);
const scheduleTimes = parseList(process.env.SALES_ACTIVITY_SCHEDULE_TIMES, [
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
]);
const scheduleLabel =
  process.env.SALES_ACTIVITY_SCHEDULE_LABEL?.trim() ||
  formatScheduleLabel(scheduleDays, scheduleTimes);

const config = {
  crmUrl: process.env.DEALERSOCKET_URL?.trim() || "https://bb.dealersocket.com",
  username: process.env.DEALERSOCKET_USERNAME?.trim() || "",
  password: process.env.DEALERSOCKET_PASSWORD?.trim() || "",
  totpSecret: process.env.DEALERSOCKET_TOTP_SECRET?.trim() || process.env.MFA_SECRET?.trim() || "",
  allowManualLogin: String(process.env.DEALERSOCKET_ALLOW_MANUAL_LOGIN || "false").trim().toLowerCase() === "true",
  dealershipName: process.env.DEALERSOCKET_DEALERSHIP?.trim() || "Bert Ogden Mission Mazda",
  reportName: process.env.DEALERSOCKET_REPORT_NAME?.trim() || "BDC Activity Report Sales",
  roleName: process.env.DEALERSOCKET_ROLE?.trim() || "* All Sales Power Team",
  filePrefix: sanitizeFilePrefix(process.env.SALES_ACTIVITY_FILE_PREFIX || "bdc-activity-sales"),
  storageKey: storageSegment || "sales",
  whatsappUrl: process.env.WHATSAPP_URL?.trim() || "https://web.whatsapp.com",
  whatsappChatName: process.env.WHATSAPP_TARGET_LABEL?.trim() || "Kau 429-8898 (You)",
  whatsappSearchTerms: parseList(process.env.WHATSAPP_SELF_SEARCH_TERMS, ["kau", "956 429 8898", "9564298898"]),
  whatsappVerifyTokens: parseList(process.env.WHATSAPP_SELF_VERIFY_TOKENS, ["(You)", "429-8898", "Message yourself"]),
  whatsappRequired: String(process.env.WHATSAPP_REQUIRED || "false").trim().toLowerCase() === "true",
  chromeChannel: process.env.CHROME_CHANNEL?.trim() || "chrome",
  chromeProfilePath: resolvePath(process.env.CHROME_PROFILE_PATH || path.join(dataRoot, "sales-activity", "chrome-profile")),
};

mkdirSync(config.chromeProfilePath, { recursive: true });

function resolvePath(value) {
  if (!value) return "";
  if (path.isAbsolute(value)) return value;
  return path.resolve(__dirname, value);
}

function sanitizeStorageKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFilePrefix(value) {
  const sanitized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "bdc-activity-sales";
}

function parseList(value, fallback) {
  const parts = String(value || "")
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function formatScheduleLabel(days, times) {
  if (Array.isArray(days) && days.length === 6 && days[0] === "Monday" && days[days.length - 1] === "Saturday") {
    return `Monday to Saturday at ${times.join(", ")}`;
  }
  return `${days.join(", ")} at ${times.join(", ")}`;
}

function timestampId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function log(message) {
  const line = `[${nowIso()}] ${message}`;
  console.log(line);
  appendFileSync(logPath, `${line}\n`, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireBrowserProfileLock(timeoutMs = 20 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const handle = openSync(browserLockPath, "wx");
      const payload = JSON.stringify(
        {
          pid: process.pid,
          report_name: config.reportName,
          started_at: nowIso(),
        },
        null,
        2
      );
      writeFileSync(handle, `${payload}\n`, "utf8");
      closeSync(handle);
      log(`Acquired browser profile lock at ${browserLockPath}.`);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }

      try {
        const stat = statSync(browserLockPath);
        if (Date.now() - stat.mtimeMs > timeoutMs) {
          unlinkSync(browserLockPath);
          continue;
        }
      } catch {
        // Another process may have released the lock between attempts.
      }

      await sleep(1000);
    }
  }

  throw new Error(`Timed out waiting for browser profile lock: ${browserLockPath}`);
}

function releaseBrowserProfileLock() {
  try {
    unlinkSync(browserLockPath);
    log(`Released browser profile lock at ${browserLockPath}.`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      log(`Failed to release browser profile lock: ${String(error?.message || error)}`);
    }
  }
}

function toInt(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function upsertRun(run) {
  const existing = readJson(historyPath, []);
  const history = Array.isArray(existing) ? existing : [];
  const filtered = history.filter((entry) => String(entry?.run_id || "") !== String(run.run_id || ""));
  const nextHistory = [run, ...filtered].slice(0, 90);
  writeJson(latestRunPath, run);
  writeJson(historyPath, nextHistory);
}

function writeStatus(nextPatch) {
  const current = readJson(statusPath, {});
  writeJson(statusPath, {
    report_name: config.reportName,
    schedule_label: scheduleLabel,
    schedule_days: scheduleDays,
    schedule_times: scheduleTimes,
    chat_name: config.whatsappChatName,
    last_success_at: current.last_success_at || "",
    last_run_id: current.last_run_id || "",
    started_at: current.started_at || "",
    finished_at: current.finished_at || "",
    last_error: current.last_error || "",
    message: current.message || "",
    state: current.state || "idle",
    ...nextPatch,
  });
}

function buildRunSummary(rows, screenshotUrl, runId) {
  const totals = rows.reduce(
    (summary, row) => ({
      reps: summary.reps + 1,
      appointments_created: summary.appointments_created + row.appt_created,
      calls_cti: summary.calls_cti + row.calls_cti,
      emails_sent: summary.emails_sent + row.emails_sent,
      texts_sent: summary.texts_sent + row.texts_sent,
      zero_call_reps: summary.zero_call_reps + (row.calls_cti === 0 ? 1 : 0),
    }),
    {
      reps: 0,
      appointments_created: 0,
      calls_cti: 0,
      emails_sent: 0,
      texts_sent: 0,
      zero_call_reps: 0,
    }
  );

  const averages = totals.reps
    ? {
        appointments_created: Number((totals.appointments_created / totals.reps).toFixed(2)),
        calls_cti: Number((totals.calls_cti / totals.reps).toFixed(2)),
        emails_sent: Number((totals.emails_sent / totals.reps).toFixed(2)),
        texts_sent: Number((totals.texts_sent / totals.reps).toFixed(2)),
      }
    : {
        appointments_created: 0,
        calls_cti: 0,
        emails_sent: 0,
        texts_sent: 0,
      };

  const lowPerformers = rows.filter((row) => row.low_activity).slice(0, 6);
  const topCallsRep = rows.reduce((current, row) => (row.calls_cti > current.calls_cti ? row : current), {
    rep: "",
    calls_cti: -1,
    appt_created: 0,
    emails_sent: 0,
    texts_sent: 0,
    low_activity: false,
    rank: 0,
  });
  const lowestCallsRep = rows.reduce((current, row) => {
    if (!current.rep) return row;
    return row.calls_cti < current.calls_cti ? row : current;
  }, { rep: "", calls_cti: 0, appt_created: 0, emails_sent: 0, texts_sent: 0, low_activity: false, rank: 0 });

  return {
    run_id: runId,
    report_name: config.reportName,
    crm_url: config.crmUrl,
    dealership: config.dealershipName,
    role_name: config.roleName,
    generated_at: nowIso(),
    generated_ts: Date.now() / 1000,
    screenshot_url: screenshotUrl,
    status: "completed",
    error_message: "",
    totals,
    averages,
    top_calls_rep: topCallsRep.rep ? topCallsRep : { rep: "", calls_cti: 0, appt_created: 0, emails_sent: 0, texts_sent: 0 },
    lowest_calls_rep: lowestCallsRep.rep
      ? lowestCallsRep
      : { rep: "", calls_cti: 0, appt_created: 0, emails_sent: 0, texts_sent: 0 },
    low_performers: lowPerformers,
    rows,
    delivery: {
      chat_name: config.whatsappChatName,
      whatsapp_status: "pending",
      sent_at: "",
      error_message: "",
    },
  };
}

function buildTableHtml(rows) {
  return `
    <html>
      <head>
        <style>
          html, body { margin: 0; padding: 0; background: #f7f1e7; }
          body { font-family: "Segoe UI", Arial, sans-serif; padding: 18px; }
          .wrap {
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid #d8cbb8;
            box-shadow: 0 18px 44px rgba(75, 54, 31, 0.12);
          }
          .headline {
            padding: 18px 22px;
            background: linear-gradient(135deg, #24303a, #354453);
            color: #fff;
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
          }
          .headline h1 {
            margin: 0;
            font-size: 24px;
            line-height: 1.1;
          }
          .headline p {
            margin: 6px 0 0;
            color: rgba(255, 255, 255, 0.76);
            font-size: 13px;
          }
          .stamp {
            font-size: 12px;
            padding: 8px 12px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.14);
          }
          table { width: 100%; border-collapse: collapse; background: #fff; }
          th, td {
            padding: 10px 12px;
            border-bottom: 1px solid #efe5d8;
            text-align: center;
            font-size: 14px;
          }
          th {
            background: #f6ede2;
            color: #4b4d56;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          td:first-child, th:first-child {
            text-align: left;
          }
          tbody tr.low-activity {
            background: #8e1b16;
            color: #fff;
          }
          tbody tr:nth-child(even):not(.low-activity) {
            background: #fff9f1;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="headline">
            <div>
              <h1>${config.reportName}</h1>
              <p>${config.dealershipName} · ${config.roleName}</p>
            </div>
            <div class="stamp">${new Date().toLocaleString()}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rep</th>
                <th>Appt Created</th>
                <th>Calls CTI</th>
                <th>Emails Sent</th>
                <th>Text Sent</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr class="${row.low_activity ? "low-activity" : ""}">
                      <td>${escapeHtml(row.rep)}</td>
                      <td>${row.appt_created}</td>
                      <td>${row.calls_cti}</td>
                      <td>${row.emails_sent}</td>
                      <td>${row.texts_sent}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function powershellLiteral(value) {
  return `'${String(value || "").replaceAll("'", "''")}'`;
}

function copyImageToClipboardWindows(imagePath) {
  const script = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `Add-Type -AssemblyName System.Drawing`,
    `$img = [System.Drawing.Image]::FromFile(${powershellLiteral(imagePath)})`,
    `[System.Windows.Forms.Clipboard]::SetImage($img)`,
  ].join("; ");

  execFileSync("powershell.exe", ["-NoProfile", "-Sta", "-Command", script], {
    stdio: "pipe",
  });
}

async function replaceText(locator, value, delay = 45) {
  await locator.click();
  await locator.press("Control+A").catch(() => {});
  await locator.press("Backspace").catch(() => {});
  await locator.type(String(value || ""), { delay });
}

async function setInputValueWithEvents(page, selector, value) {
  await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
  await page.evaluate(
    ({ inputSelector, inputValue }) => {
      const input = document.querySelector(inputSelector);
      if (!input) {
        throw new Error(`Input not found for ${inputSelector}`);
      }
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (!setter) {
        throw new Error("Input value setter not available");
      }
      setter.call(input, inputValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: String(inputValue).slice(-1) || " " }));
    },
    { inputSelector: selector, inputValue: String(value || "") }
  );

  const actualValue = await page.$eval(
    selector,
    (input) => input?.value ?? ""
  );
  if (actualValue !== String(value || "")) {
    throw new Error(`Input value mismatch for ${selector}. Expected ${String(value || "").length} characters, got ${String(actualValue || "").length}.`);
  }
}

async function saveDebugCapture(page, label) {
  if (!page || page.isClosed()) return "";
  const filePath = path.join(salesAnalyticsRoot, `${label}-${timestampId()}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return "";
  }
}

function normalizeWhatsAppText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

function hasWhatsAppSelfChatCoreMarkers(value) {
  const normalized = normalizeWhatsAppText(value);
  const digits = digitsOnly(value);
  const hasPhoneMarker = digits.includes("4298898");
  const hasVerifyTokens = config.whatsappVerifyTokens.every((token) => {
    const tokenDigits = digitsOnly(token);
    if (tokenDigits) {
      if (tokenDigits === "4298898") {
        return hasPhoneMarker;
      }
      return digits.includes(tokenDigits);
    }
    const normalizedToken = normalizeWhatsAppText(token);
    if (normalizedToken === "message yourself") {
      return true;
    }
    return normalized.includes(normalizedToken);
  });
  return hasPhoneMarker && hasVerifyTokens;
}

function isExpectedWhatsAppSelfChatRow(value) {
  return hasWhatsAppSelfChatCoreMarkers(value);
}

function isExpectedWhatsAppSelfChatHeader(value) {
  const normalized = normalizeWhatsAppText(value);
  return hasWhatsAppSelfChatCoreMarkers(value) && normalized.includes("message yourself");
}

async function setWhatsAppFieldValue(locator, value) {
  await locator.waitFor({ state: "attached", timeout: 10000 });
  await locator.evaluate((element, nextValue) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const setter =
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (!setter) {
        throw new Error("Search box value setter not available");
      }
      setter.call(element, nextValue);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
      element.focus();
      element.textContent = nextValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    throw new Error("Unsupported WhatsApp search box element");
  }, String(value || ""));
}

async function clearWhatsAppSearch(page, searchBox) {
  await setWhatsAppFieldValue(searchBox, "");
  await page.waitForTimeout(250);
}

async function getWhatsAppSearchBox(page) {
  const scopedSearchBox = page
    .locator(
      '[data-testid="chat-list-search-container"] input[role="textbox"], ' +
        '[data-testid="chat-list-search-container"] input[aria-label="Search or start a new chat"], ' +
        '[data-testid="chat-list-search-container"] div[contenteditable="true"]'
    )
    .first();

  const hasScopedSearchBox = await scopedSearchBox
    .waitFor({ state: "attached", timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (hasScopedSearchBox) {
    return scopedSearchBox;
  }

  return await waitForFirstVisible(page, [
    'div[contenteditable="true"][aria-label="Search input textbox"]',
    'div[contenteditable="true"][title="Search input textbox"]',
    'input[aria-label="Search input textbox"]',
    'input[aria-label="Search or start new chat"]',
    'input[role="textbox"][aria-label="Search or start a new chat"]',
  ]);
}

async function getWhatsAppConversationHeaderText(page) {
  const header = page.locator('[data-testid="conversation-header"]').first();
  await header.waitFor({ state: "visible", timeout: 10000 });
  return (((await header.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim());
}

async function findWhatsAppSelfChatRow(page, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const messageYourselfRow = page.locator('[data-testid="message-yourself-row"]').first();
    const hasPrimaryRow = await messageYourselfRow
      .waitFor({ state: "visible", timeout: 900 })
      .then(() => true)
      .catch(() => false);

    if (hasPrimaryRow) {
      const rowText = ((await messageYourselfRow.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      if (isExpectedWhatsAppSelfChatRow(rowText)) {
        return messageYourselfRow;
      }
    }

    const candidateRows = page.locator('[data-testid="cell-frame-container"], [role="listitem"]');
    const candidateCount = Math.min(await candidateRows.count().catch(() => 0), 20);
    for (let index = 0; index < candidateCount; index += 1) {
      const candidate = candidateRows.nth(index);
      const rowText = ((await candidate.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      if (isExpectedWhatsAppSelfChatRow(rowText)) {
        return candidate;
      }
    }

    await page.waitForTimeout(300);
  }

  return null;
}

async function clickWhatsAppSelfChatRow(row) {
  const clickTargets = [
    row.locator('[data-testid="cell-frame-title"]').first(),
    row.locator("span[title*='429-8898']").first(),
    row,
  ];

  for (const target of clickTargets) {
    const isVisible = await target
      .waitFor({ state: "visible", timeout: 1200 })
      .then(() => true)
      .catch(() => false);
    if (!isVisible) {
      continue;
    }

    try {
      await target.click({ timeout: 4000 });
      return;
    } catch {
      try {
        await target.click({ force: true, timeout: 4000 });
        return;
      } catch {
        // Try the next candidate target.
      }
    }
  }

  throw new Error("Unable to open the verified WhatsApp self-chat row.");
}

async function openVerifiedWhatsAppSelfChat(page) {
  const currentHeader = await getWhatsAppConversationHeaderText(page).catch(() => "");
  if (isExpectedWhatsAppSelfChatHeader(currentHeader)) {
    return currentHeader;
  }

  const searchBox = await getWhatsAppSearchBox(page);

  for (const searchTerm of config.whatsappSearchTerms) {
    await clearWhatsAppSearch(page, searchBox);
    await setWhatsAppFieldValue(searchBox, searchTerm);
    await page.waitForTimeout(1800);

    const selfChatRow = await findWhatsAppSelfChatRow(page, 3500);
    if (selfChatRow) {
      await clickWhatsAppSelfChatRow(selfChatRow);
      await page.waitForTimeout(1200);
      const headerText = await getWhatsAppConversationHeaderText(page).catch(() => "");
      if (isExpectedWhatsAppSelfChatHeader(headerText)) {
        return headerText;
      }
    }
  }

  const mismatchPath = await saveDebugCapture(page, "whatsapp-chat-mismatch");
  const openHeaderText = await getWhatsAppConversationHeaderText(page).catch(() => "");
  throw new Error(
    `WhatsApp self-chat verification failed. Open header: "${openHeaderText || "unknown"}"${mismatchPath ? ` | Screenshot: ${mismatchPath}` : ""}`
  );
}

async function focusWhatsAppComposer(page) {
  const composer = await waitForFirstVisible(page, [
    'footer [contenteditable="true"][aria-label*="message"]',
    'footer [contenteditable="true"][data-tab]',
    'div[contenteditable="true"][aria-placeholder="Type a message"]',
  ]);
  await composer.click();
}

async function waitForManualHomepage(page, reason, timeoutMs = 180000) {
  log(`${reason} Waiting up to ${Math.round(timeoutMs / 1000)} seconds for manual DealerSocket sign-in in the opened Chrome window.`);
  await page.waitForURL("**/homepage", { timeout: timeoutMs });
  log("DealerSocket homepage reached after manual sign-in.");
}

async function waitForFirstVisible(page, selectors, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      try {
        await locator.waitFor({ state: "visible", timeout: 800 });
        return locator;
      } catch {
        // Ignore and keep scanning.
      }
    }
    await page.waitForTimeout(600);
  }
  throw new Error(`Timed out waiting for selectors: ${selectors.join(" | ")}`);
}

async function handleUserImpersonationStep(page) {
  const continueAsSelf = page.getByRole("button", {
    name: /continue as self/i,
  });

  const isVisible = await continueAsSelf
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (!isVisible) {
    return false;
  }

  await continueAsSelf.click({ force: true });
  log("DealerSocket impersonation step detected. Continuing as self.");
  return true;
}

async function ensureDealersocketLogin(page) {
  await page.goto(config.crmUrl, { waitUntil: "networkidle" });
  log("DealerSocket opened.");

  if (page.url().includes("/homepage")) {
    log("DealerSocket session already active.");
    return;
  }

  await page.waitForSelector('input[name="username"], input[name="password"]', {
    timeout: 15000,
  });

  const userField = page.locator('input[name="username"]').first();
  try {
    await userField.waitFor({ state: "visible", timeout: 1500 });
    await setInputValueWithEvents(page, 'input[name="username"]', config.username);
    await page.click('button[data-e2e="continueButton"]');
    log("DealerSocket username submitted.");
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  } catch {
    log("DealerSocket username step skipped.");
  }

  await setInputValueWithEvents(page, 'input[name="password"]', config.password);
  await page.waitForTimeout(900);
  await page.locator('button[data-e2e="loginButton"]').click({ force: true });
  log("DealerSocket password submitted.");

  const invalidCredentialText = page.locator("text=/invalid username or password/i").first();
  if (await invalidCredentialText.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false)) {
    if (config.allowManualLogin) {
      await waitForManualHomepage(page, "DealerSocket rejected the automated login.");
      return;
    }
    throw new Error("DealerSocket rejected the username or password. Update the saved credentials in sales-activity-runner/.env.");
  }

  const passwordChangeSelector = "p.MuiTypography-root.MuiTypography-h5.MuiTypography-paragraph";
  try {
    const passwordChangeTitle = page.locator(passwordChangeSelector).filter({ hasText: "CHANGE PASSWORD" });
    await passwordChangeTitle.waitFor({ state: "visible", timeout: 3000 });
    throw new Error("DealerSocket is asking for a password change before the report can run.");
  } catch (error) {
    if (String(error?.message || "").includes("password change")) {
      throw error;
    }
  }

  try {
    await page.waitForURL("**/homepage", { timeout: 20000 });
    log("DealerSocket login finished without MFA.");
    return;
  } catch {
    if (await handleUserImpersonationStep(page)) {
      await page.waitForURL("**/homepage", { timeout: 20000 });
      log("DealerSocket login finished after continuing as self.");
      return;
    }
    log(`DealerSocket MFA step detected at ${page.url()}.`);
  }

  const otpSelectors = [
    "input#otpCode",
    "input[name='otpCode']",
    "input[name='OtpCode']",
    "input[autocomplete='one-time-code']",
    "input[inputmode='numeric']",
  ];
  let otpField = null;
  try {
    otpField = await waitForFirstVisible(page, otpSelectors, 8000);
  } catch {
    otpField = null;
  }

  if (!otpField) {
    if (await handleUserImpersonationStep(page)) {
      await page.waitForURL("**/homepage", { timeout: 20000 });
      log("DealerSocket login finished after continuing as self.");
      return;
    }
    if (config.allowManualLogin) {
      await waitForManualHomepage(page, "DealerSocket opened a non-standard auth step.");
      return;
    }
    const debugPath = await saveDebugCapture(page, "dealersocket-mfa");
    log(`DealerSocket auth page text: ${((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 1200)}`);
    if (debugPath) {
      log(`Saved DealerSocket auth screenshot to ${debugPath}`);
    }
    throw new Error("DealerSocket did not reach the homepage and no MFA code box was found.");
  }

  if (config.totpSecret) {
    const code = authenticator.generate(config.totpSecret);
    await otpField.fill(code);
    const rememberField = page.locator("input#rememberDeviceInformation_True").first();
    if (await rememberField.waitFor({ state: "visible", timeout: 1000 }).then(() => true).catch(() => false)) {
      await rememberField.check();
    }
    await page.click("button#continue");
    await page.waitForURL("**/homepage", { timeout: 20000 });
    log("DealerSocket MFA completed with TOTP.");
    return;
  }

  log("Complete DealerSocket MFA in the opened browser window. Waiting up to 2 minutes.");
  await page.waitForURL("**/homepage", { timeout: 120000 });
  log("DealerSocket MFA completed manually.");
}

async function openReportPage(page) {
  try {
    await page.waitForSelector("#select_value_label_0", { state: "visible", timeout: 8000 });
    try {
      await page.click("#select_value_label_0", { timeout: 3000 });
    } catch {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      await page.click("#select_value_label_0", { timeout: 5000 });
    }

    await page.waitForSelector(`md-option:has-text("${config.dealershipName}")`, {
      state: "visible",
      timeout: 8000,
    });
    await page.click(`md-option:has-text("${config.dealershipName}")`);
    log(`Selected dealership: ${config.dealershipName}`);
  } catch (error) {
    throw new Error(`Unable to select dealership "${config.dealershipName}": ${error.message}`);
  }

  await page.waitForSelector('button[aria-label="Reporting"]', { timeout: 15000 });
  await page.locator('button[aria-label="Reporting"]').click();
  await page.waitForSelector('button[aria-label="Reports"]', { state: "visible", timeout: 10000 });
  await page.locator('button[aria-label="Reports"]').click();

  const dataFrame = page
    .frameLocator("iframe#app-crm")
    .frameLocator('iframe[name="data"]');

  await dataFrame.locator('div.panel-title:has-text("INTERNET REPORTS")').click();

  const [reportPage] = await Promise.all([
    page.waitForEvent("popup"),
    dataFrame.locator('span:has-text("BDC Activity Report")').first().click(),
  ]);

  await reportPage.waitForLoadState("domcontentloaded");
  log("BDC Activity Report popup opened.");
  return reportPage;
}

async function waitForReportToRender(reportPage) {
  const spinner = "#ctl00_ContentPlaceHolder1_ReportController1_rviewer_AsyncWait";
  const dataTable = 'table[id$="_18iT0"]';

  await reportPage.waitForSelector(spinner, { state: "attached", timeout: 15000 });
  await reportPage.waitForSelector(spinner, { state: "hidden", timeout: 45000 });
  await reportPage.waitForSelector(dataTable, { state: "visible", timeout: 15000 });
  await reportPage.waitForSelector(`${dataTable} tbody tr:nth-child(3)`, {
    state: "visible",
    timeout: 15000,
  });
}

function isSummaryRepName(rep) {
  const normalized = String(rep || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return true;
  return (
    normalized === "total" ||
    normalized === "grand total" ||
    normalized.startsWith("total ") ||
    normalized.endsWith(" total")
  );
}

async function scrapeReport(reportPage) {
  await reportPage.locator("#ContentPlaceHolder1_ReportController1_DateRange").selectOption("Today");
  await reportPage.locator("#ContentPlaceHolder1_ReportController1_iRoleID").selectOption(config.roleName);
  await reportPage.click("#btnApplyChanges");
  await waitForReportToRender(reportPage);

  const totalPagesText = (await reportPage.locator('span[id$="TotalPages"]').textContent()) || "1";
  const totalPages = Math.max(1, Number(totalPagesText.trim()) || 1);
  const data = [];
  const seenRows = new Set();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    log(`Scraping DealerSocket report page ${pageNumber} of ${totalPages}.`);
    const table = reportPage.locator('table[id$="_18iT0"]');
    await table.waitFor({ state: "visible", timeout: 15000 });
    const rows = table.locator("tbody > tr:has(td > div)");
    const count = await rows.count();

    for (let index = 2; index < count; index += 1) {
      const row = rows.nth(index);
      const rep = ((await row.locator("td:nth-child(2) div").textContent()) || "").trim();
      if (!rep || isSummaryRepName(rep)) continue;

      const rowData = {
        rep,
        appt_created: toInt(((await row.locator("td:nth-child(7) div").textContent()) || "").trim()),
        calls_cti: toInt(((await row.locator("td:nth-child(10) div").textContent()) || "").trim()),
        emails_sent: toInt(((await row.locator("td:nth-child(13) div").textContent()) || "").trim()),
        texts_sent: toInt(((await row.locator("td:nth-child(14) div").textContent()) || "").trim()),
      };
      const rowKey = [
        rowData.rep.toLowerCase(),
        rowData.appt_created,
        rowData.calls_cti,
        rowData.emails_sent,
        rowData.texts_sent,
      ].join("|");
      if (seenRows.has(rowKey)) continue;
      seenRows.add(rowKey);
      data.push(rowData);
    }

    if (pageNumber < totalPages) {
      await reportPage.locator('input[title="Next Page"]:not([disabled])').first().click();
      await waitForReportToRender(reportPage);
    }
  }

  data.sort((left, right) => left.calls_cti - right.calls_cti || left.rep.localeCompare(right.rep));
  return data.map((row, index) => ({
    ...row,
    low_activity: index < 3 || row.calls_cti === 0,
    rank: index + 1,
  }));
}

async function renderScreenshot(context, rows, runId) {
  const html = buildTableHtml(rows);
  const capturePage = await context.newPage();
  const screenshotFileName = `${config.filePrefix}-${runId}.png`;
  const screenshotPath = path.join(uploadsRoot, screenshotFileName);
  const latestScreenshotPath = path.join(uploadsRoot, `latest-${config.filePrefix}.png`);

  await capturePage.setViewportSize({ width: 960, height: 720 });
  await capturePage.setContent(html);
  await capturePage.waitForTimeout(800);

  const height = await capturePage.evaluate(() => document.body.scrollHeight);
  await capturePage.setViewportSize({ width: 960, height: Math.max(420, height + 16) });
  await capturePage.locator("body").screenshot({
    path: screenshotPath,
    type: "png",
  });
  await capturePage.close();

  copyFileSync(screenshotPath, latestScreenshotPath);
  const screenshotUrl = storageSegment
    ? `/uploads/sales-analytics/${storageSegment}/${screenshotFileName}`
    : `/uploads/sales-analytics/${screenshotFileName}`;
  return {
    screenshotPath,
    screenshotUrl,
  };
}

async function sendToWhatsApp(page, screenshotPath) {
  await page.goto(config.whatsappUrl, { waitUntil: "domcontentloaded" });
  const headerText = await openVerifiedWhatsAppSelfChat(page);
  await focusWhatsAppComposer(page);

  copyImageToClipboardWindows(screenshotPath);
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(1600);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  log(`WhatsApp screenshot sent to verified self chat "${headerText || config.whatsappChatName}".`);
  return headerText || config.whatsappChatName;
}

async function main() {
  if (!config.username || !config.password) {
    throw new Error("Set DEALERSOCKET_USERNAME and DEALERSOCKET_PASSWORD in sales-activity-runner/.env before running.");
  }

  const runId = timestampId();
  let context = null;
  let primaryPage = null;
  let reportPage = null;
  let runRecord = null;
  let browserLockHeld = false;

  writeStatus({
    state: "running",
    started_at: nowIso(),
    finished_at: "",
    last_error: "",
    message: "Sales activity scrape is running.",
  });

  log(`Starting ${config.reportName}.`);

  try {
    await acquireBrowserProfileLock();
    browserLockHeld = true;

    context = await chromium.launchPersistentContext(config.chromeProfilePath, {
      channel: config.chromeChannel || undefined,
      headless: false,
      viewport: { width: 1280, height: 900 },
    });

    primaryPage = context.pages().length ? context.pages()[0] : await context.newPage();
    await ensureDealersocketLogin(primaryPage);
    reportPage = await openReportPage(primaryPage);
    const rows = await scrapeReport(reportPage);
    const { screenshotPath, screenshotUrl } = await renderScreenshot(context, rows, runId);

    runRecord = buildRunSummary(rows, screenshotUrl, runId);
    upsertRun(runRecord);
    await reportPage.close();
    reportPage = null;

    try {
      const deliveredChatName = await sendToWhatsApp(primaryPage, screenshotPath);
      runRecord = {
        ...runRecord,
        delivery: {
          chat_name: deliveredChatName,
          whatsapp_status: "sent",
          sent_at: nowIso(),
          error_message: "",
        },
      };
      upsertRun(runRecord);
    } catch (deliveryError) {
      const deliveryMessage = String(deliveryError?.message || deliveryError || "WhatsApp send failed");
      log(`WhatsApp delivery failed: ${deliveryMessage}`);
      runRecord = {
        ...runRecord,
        delivery: {
          chat_name: config.whatsappChatName,
          whatsapp_status: "failed",
          sent_at: "",
          error_message: deliveryMessage,
        },
      };
      upsertRun(runRecord);
      if (config.whatsappRequired) {
        throw deliveryError;
      }
    }

    writeStatus({
      state: "completed",
      finished_at: nowIso(),
      last_success_at: nowIso(),
      last_run_id: runId,
      last_error: "",
      message: "Sales activity scrape completed successfully.",
    });
    log(`${config.reportName} completed successfully.`);
  } catch (error) {
    const message = String(error?.message || error || "Unknown error");
    log(`Run failed: ${message}`);
    if (primaryPage && !primaryPage.isClosed()) {
      log(`Failure URL: ${primaryPage.url()}`);
      const debugPath = await saveDebugCapture(primaryPage, "runner-failure");
      if (debugPath) {
        log(`Saved failure screenshot to ${debugPath}`);
      }
    }
    if (runRecord) {
      runRecord = {
        ...runRecord,
        status: "failed",
        error_message: message,
        delivery: {
          ...(runRecord.delivery || {
            chat_name: config.whatsappChatName,
            whatsapp_status: "failed",
            sent_at: "",
            error_message: "",
          }),
          whatsapp_status: "failed",
          error_message: message,
        },
      };
      upsertRun(runRecord);
    }
    writeStatus({
      state: "failed",
      finished_at: nowIso(),
      last_error: message,
      message,
    });
    process.exitCode = 1;
  } finally {
    if (reportPage) {
      await reportPage.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browserLockHeld) {
      releaseBrowserProfileLock();
    }
  }
}

await main();
