import http from "node:http";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const harnessHtmlPath = path.join(__dirname, "marketplace-harness.html");
const contentScriptPath = path.join(extensionRoot, "content.js");

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const dealerDraft = {
  title: "2027 Kia Telluride X-Pro SX AWD",
  price: "41995",
  description: "Price: $41,995\nMessage us today for availability, trade value, and financing options.",
  images: ["https://inventory.example/vehicle-1.jpg", "https://inventory.example/vehicle-2.jpg"],
  raw: {
    model: "Telluride X-Pro SX AWD",
  },
  vehicle: {
    year: "2027",
    make: "Kia",
    model: "Telluride X-Pro SX AWD",
    mileage: "12",
    body_style: "SUV",
    condition: "New",
    marketplace_condition: "New",
    fuel_type: "Gasoline",
    transmission: "Automatic",
    clean_title: true,
    images: ["https://inventory.example/vehicle-1.jpg", "https://inventory.example/vehicle-2.jpg"],
  },
};

const samplePngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9W3Cyx4AAAAASUVORK5CYII=";

function detectBrowserExecutable() {
  return chromeCandidates.find((candidate) => existsSync(candidate));
}

async function createServer() {
  const harnessHtml = await fs.readFile(harnessHtmlPath, "utf8");
  const server = http.createServer((request, response) => {
    if ((request.url || "").startsWith("/facebook.com/marketplace/create/vehicle")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(harnessHtml);
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start harness server.");
  }
  return { server, port: address.port };
}

async function main() {
  const executablePath = detectBrowserExecutable();
  if (!executablePath) {
    throw new Error("Chrome or Edge was not found on this machine.");
  }

  const { server, port } = await createServer();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  try {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ draft, photoDataUrl }) => {
        const storageState = {
          dealerDraft: draft,
          dealerAutoApply: { pending: false, updatedAt: Date.now() },
        };

        function cloneValue(value) {
          return JSON.parse(JSON.stringify(value));
        }

        function mapKeys(keys) {
          if (Array.isArray(keys)) {
            return keys.reduce((result, key) => {
              result[key] = storageState[key];
              return result;
            }, {});
          }
          if (typeof keys === "string") {
            return { [keys]: storageState[keys] };
          }
          if (keys && typeof keys === "object") {
            return Object.keys(keys).reduce((result, key) => {
              result[key] = storageState[key] ?? keys[key];
              return result;
            }, {});
          }
          return cloneValue(storageState);
        }

        window.chrome = {
          storage: {
            local: {
              async get(keys) {
                return cloneValue(mapKeys(keys));
              },
              async set(values) {
                Object.assign(storageState, cloneValue(values));
              },
            },
          },
          runtime: {
            sendMessage(message, callback) {
              if (message?.type === "FETCH_MARKETPLACE_IMAGE_FILES") {
                callback?.({
                  ok: true,
                  files: (message.urls || []).slice(0, 2).map((url, index) => ({
                    url,
                    name: `vehicle-${index + 1}.png`,
                    type: "image/png",
                    dataUrl: photoDataUrl,
                  })),
                });
                return;
              }
              callback?.({ ok: false, error: "Unknown harness message." });
            },
            lastError: null,
          },
        };
      },
      { draft: dealerDraft, photoDataUrl: samplePngDataUrl }
    );

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/facebook.com/marketplace/create/vehicle`, {
      waitUntil: "domcontentloaded",
    });
    await page.addScriptTag({ path: contentScriptPath });
    await page.waitForSelector("#dealer-marketplace-helper");
    await page.click("#dealer-marketplace-helper button");

    try {
      await page.waitForFunction(() => {
        const state = window.harness?.getState?.();
        return state && state.progress === "step2" && state.finalTitle && state.finalDescription;
      }, null, { timeout: 70000 });
    } catch (error) {
      const debugState = await page.evaluate(() => ({
        harness: window.harness?.getState?.() || null,
        helperStatus: Array.from(document.querySelectorAll("#dealer-marketplace-helper-status div"))
          .map((node) => node.textContent || "")
          .filter(Boolean),
      }));
      console.error("Harness debug state:");
      console.error(JSON.stringify(debugState, null, 2));
      throw error;
    }

    const state = await page.evaluate(() => window.harness.getState());
    const failures = [];

    if (state.vehicleTypePill !== "Car/Truck") failures.push(`vehicle type pill stayed at ${state.vehicleTypePill || "blank"}`);
    if (state.year !== "2027") failures.push(`year mismatch: ${state.year || "blank"}`);
    if (state.make !== "Kia") failures.push(`make mismatch: ${state.make || "blank"}`);
    if (!String(state.model || "").includes("Telluride")) failures.push(`model mismatch: ${state.model || "blank"}`);
    if (state.photoCount < 2) failures.push(`photo count mismatch: ${state.photoCount}`);
    if (!state.cleanTitle) failures.push("clean title did not check");
    if (state.condition !== "New") failures.push(`condition mismatch: ${state.condition || "blank"}`);
    if (state.bodyStyle !== "SUV") failures.push(`body style mismatch: ${state.bodyStyle || "blank"}`);
    if (!["Gasoline", "Petrol"].includes(state.fuelType)) failures.push(`fuel type mismatch: ${state.fuelType || "blank"}`);
    if (state.transmission !== "Automatic") failures.push(`transmission mismatch: ${state.transmission || "blank"}`);
    if (!state.finalTitle.includes("2027 Kia Telluride")) failures.push(`final title mismatch: ${state.finalTitle || "blank"}`);
    if (!state.finalDescription.includes("availability")) failures.push("final description was not filled");

    if (failures.length) {
      throw new Error(`Harness simulation failed:\n- ${failures.join("\n- ")}`);
    }

    console.log("Harness simulation passed.");
    console.log(JSON.stringify(state, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
