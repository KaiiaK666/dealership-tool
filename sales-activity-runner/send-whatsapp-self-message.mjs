import "dotenv/config";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const dataRoot = path.resolve(repoRoot, "data");
const salesActivityRoot = path.join(dataRoot, "sales-activity");
const logsRoot = path.join(salesActivityRoot, "logs");
const logPath = path.join(logsRoot, "whatsapp-self-message.log");
const browserLockPath = path.join(salesActivityRoot, "chrome-profile.lock");

for (const dir of [dataRoot, salesActivityRoot, logsRoot]) {
  mkdirSync(dir, { recursive: true });
}

const config = {
  whatsappUrl: process.env.WHATSAPP_URL?.trim() || "https://web.whatsapp.com",
  whatsappChatName: process.env.WHATSAPP_TARGET_LABEL?.trim() || "Kau 429-8898 (You)",
  whatsappSearchTerms: parseList(process.env.WHATSAPP_SELF_SEARCH_TERMS, ["kau", "956 429 8898", "9564298898"]),
  whatsappVerifyTokens: parseList(process.env.WHATSAPP_SELF_VERIFY_TOKENS, ["(You)", "429-8898", "Message yourself"]),
  chromeChannel: process.env.CHROME_CHANNEL?.trim() || "chrome",
  chromeProfilePath: resolvePath(process.env.CHROME_PROFILE_PATH || path.join(dataRoot, "sales-activity", "chrome-profile")),
  messageText: String(process.env.WHATSAPP_MESSAGE_TEXT || "").trim(),
  messageTag: String(process.env.WHATSAPP_MESSAGE_TAG || "manual-message").trim() || "manual-message",
};

mkdirSync(config.chromeProfilePath, { recursive: true });

function resolvePath(value) {
  if (!value) return "";
  if (path.isAbsolute(value)) return value;
  return path.resolve(__dirname, value);
}

function parseList(value, fallback) {
  const parts = String(value || "")
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function nowIso() {
  return new Date().toISOString();
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
          tag: config.messageTag,
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
        // Ignore stale-read races and retry.
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

async function saveDebugCapture(page, label) {
  if (!page || page.isClosed()) return "";
  const filePath = path.join(logsRoot, `${label}-${timestampId()}.png`);
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

async function waitForFirstVisible(page, selectors, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      try {
        await locator.waitFor({ state: "visible", timeout: 800 });
        return locator;
      } catch {
        // Keep scanning.
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for selectors: ${selectors.join(" | ")}`);
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

    throw new Error("Unsupported WhatsApp field element");
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
        // Try the next target.
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

  const mismatchPath = await saveDebugCapture(page, "whatsapp-self-message-mismatch");
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

async function typeWhatsAppMessage(page, messageText) {
  const lines = String(messageText || "")
    .replace(/\r\n/g, "\n")
    .split("\n");

  await focusWhatsAppComposer(page);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > 0) {
      await page.keyboard.down("Shift");
      await page.keyboard.press("Enter");
      await page.keyboard.up("Shift");
    }
    if (line) {
      await page.keyboard.type(line, { delay: 18 });
    }
  }
}

async function main() {
  if (!config.messageText) {
    throw new Error("Set WHATSAPP_MESSAGE_TEXT before running the self-message sender.");
  }

  let context = null;
  let browserLockHeld = false;

  try {
    await acquireBrowserProfileLock();
    browserLockHeld = true;

    context = await chromium.launchPersistentContext(config.chromeProfilePath, {
      channel: config.chromeChannel || undefined,
      headless: false,
      viewport: { width: 1280, height: 900 },
    });

    const page = context.pages().length ? context.pages()[0] : await context.newPage();
    await page.goto(config.whatsappUrl, { waitUntil: "domcontentloaded" });
    const headerText = await openVerifiedWhatsAppSelfChat(page);
    await typeWhatsAppMessage(page, config.messageText);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1800);
    const statusText = `WhatsApp push sent to verified self chat "${headerText || config.whatsappChatName}".`;
    log(statusText);
    console.log(statusText);
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browserLockHeld) {
      releaseBrowserProfileLock();
    }
  }
}

await main();
