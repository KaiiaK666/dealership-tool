const defaultApiBase = "https://api.bertogden123.com";
const fallbackApiBases = [defaultApiBase, "https://dealership-tool-api.onrender.com"];
const marketplaceCreateUrl = "https://www.facebook.com/marketplace/create/vehicle";
const marketplaceTitleToken = "{year} {make} {model}";
const marketplacePriceLine = "{price_label}: {price}";
const marketplaceMileageLine = "Mileage: {mileage}";
const marketplaceVinLine = "VIN: {vin}";
const marketplaceCtaLine = "{cta_text}";
const marketplaceUrlLine = "{url}";
const marketplaceTemplateDefaults = {
  title_template: marketplaceTitleToken,
  description_template: [
    marketplaceTitleToken,
    marketplacePriceLine,
    marketplaceMileageLine,
    marketplaceVinLine,
    marketplaceCtaLine,
    marketplaceUrlLine,
  ].join("\n"),
  price_label: "Bert Ogden Price",
  cta_text: "Message us for availability and financing options.",
};

const els = {
  apiBase: document.getElementById("apiBase"),
  saveSettings: document.getElementById("saveSettings"),
  quickPost: document.getElementById("quickPost"),
  captureCurrentTab: document.getElementById("captureCurrentTab"),
  openMarketplace: document.getElementById("openMarketplace"),
  draftTitle: document.getElementById("draftTitle"),
  draftPrice: document.getElementById("draftPrice"),
  draftMeta: document.getElementById("draftMeta"),
  draftDescription: document.getElementById("draftDescription"),
  status: document.getElementById("status"),
};

function normalizeApiBase(value) {
  return String(value || defaultApiBase).trim().replace(/\/$/, "") || defaultApiBase;
}

function uniqueApiBases(values) {
  return Array.from(new Set(values.map(normalizeApiBase).filter(Boolean)));
}

function setStatus(text) {
  els.status.textContent = text || "";
}

function isSupportedInventoryUrl(url) {
  return /bertogden/i.test(String(url || ""));
}

async function ensureInventoryScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["inventory.js"],
  });
}

function fillTemplate(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "");
}

function formatNumber(value) {
  const numeric = String(value || "").replace(/[^0-9]/g, "");
  if (!numeric) return "";
  return Number(numeric).toLocaleString("en-US");
}

function normalizeSentence(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function looksUsableCaption(value) {
  const text = normalizeSentence(value);
  return /[a-z]/i.test(text) && text.length >= 40;
}

function normalizeMarketplaceTemplate(template) {
  const source = {
    ...marketplaceTemplateDefaults,
    ...(template || {}),
  };
  const titleTemplate = String(source.title_template || marketplaceTitleToken).includes(marketplaceTitleToken)
    ? String(source.title_template || marketplaceTitleToken).trim()
    : marketplaceTitleToken;
  const rawLines = String(source.description_template || "")
    .split("\n")
    .map((line) => normalizeSentence(line))
    .filter(Boolean);
  const descriptionLines = [];
  if (rawLines.includes(marketplaceTitleToken)) descriptionLines.push(marketplaceTitleToken);
  descriptionLines.push(marketplacePriceLine);
  if (rawLines.some((line) => line.includes("{mileage}"))) descriptionLines.push(marketplaceMileageLine);
  if (rawLines.some((line) => line.includes("{vin}"))) descriptionLines.push(marketplaceVinLine);
  if (normalizeSentence(source.cta_text)) descriptionLines.push(marketplaceCtaLine);
  if (rawLines.some((line) => line.includes("{url}"))) descriptionLines.push(marketplaceUrlLine);
  return {
    title_template: titleTemplate,
    description_template: descriptionLines.join("\n"),
    price_label: normalizeSentence(source.price_label || marketplaceTemplateDefaults.price_label) || marketplaceTemplateDefaults.price_label,
    cta_text: normalizeSentence(source.cta_text || ""),
  };
}

function buildSmartCaption(vehicle, template, draftData) {
  const nameLine = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const lines = [];
  if (nameLine) lines.push(`${nameLine} available now at Bert Ogden.`);
  if (draftData.price) {
    lines.push(`${template.price_label || "Price"}: ${draftData.price}`);
  }
  if (vehicle.mileage) {
    lines.push(`Mileage: ${formatNumber(vehicle.mileage)} mi`);
  }
  if (vehicle.body_style) {
    lines.push(`Body style: ${normalizeSentence(vehicle.body_style)}`);
  }
  if (vehicle.condition) {
    lines.push(`Condition: ${normalizeSentence(vehicle.condition)}`);
  }
  const bodyStyle = normalizeSentence(vehicle.body_style || "Sedan").toLowerCase();
  const conditionLine =
    vehicle.condition === "New"
      ? `New ${bodyStyle} ready for a test drive.`
      : `Clean ${bodyStyle} ready for its next owner.`;
  lines.push(conditionLine);
  if (template.cta_text) {
    lines.push(normalizeSentence(template.cta_text));
  }
  if (vehicle.vin) {
    lines.push(`VIN: ${vehicle.vin}`);
  }
  if (vehicle.url) {
    lines.push(`View full details: ${vehicle.url}`);
  }
  return lines.filter(Boolean).join("\n");
}

async function fetchTemplate(apiBase) {
  let lastError = null;
  for (const base of uniqueApiBases([apiBase, ...fallbackApiBases])) {
    try {
      const response = await fetch(`${base}/api/marketplace/template`);
      if (!response.ok) {
        throw new Error(`Template request failed at ${base}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Could not reach the Marketplace template service. Reload the extension and try again.");
}

function buildDraft(vehicle, template) {
  const normalizedTemplate = normalizeMarketplaceTemplate(template);
  const draftData = {
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || vehicle.title || "",
    price: vehicle.price ? `$${vehicle.price}` : "",
    mileage: vehicle.mileage ? `${vehicle.mileage} mi` : "",
    vin: vehicle.vin || "",
    condition: vehicle.condition || "",
    body_style: vehicle.body_style || "Sedan",
    stock: vehicle.stock || "",
    url: vehicle.url || "",
    price_label: normalizedTemplate.price_label || marketplaceTemplateDefaults.price_label,
    cta_text: normalizedTemplate.cta_text || "",
  };
  const templatedDescription = fillTemplate(normalizedTemplate.description_template, draftData);
  return {
    title: fillTemplate(normalizedTemplate.title_template, draftData),
    price: String(vehicle.price || "").replace(/[^0-9]/g, ""),
    description: looksUsableCaption(templatedDescription) ? templatedDescription : buildSmartCaption(vehicle, normalizedTemplate, draftData),
    images: Array.isArray(vehicle.images) ? vehicle.images : [],
    raw: draftData,
    vehicle,
  };
}

function safeFilePart(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

async function downloadDraftImages(draft) {
  const images = Array.isArray(draft?.images) ? draft.images.slice(0, 10) : [];
  if (!images.length) return 0;
  let completed = 0;
  const prefix = [draft.vehicle?.year, draft.vehicle?.make, draft.vehicle?.model]
    .map(safeFilePart)
    .filter(Boolean)
    .join("-");
  for (let index = 0; index < images.length; index += 1) {
    const url = images[index];
    try {
      const extensionMatch = String(url).match(/\.([a-zA-Z0-9]{3,4})(?:[?#]|$)/);
      const extension = extensionMatch?.[1] || "jpg";
      await chrome.downloads.download({
        url,
        filename: `MarketplaceHelper/${prefix || "vehicle"}-${index + 1}.${extension}`,
        conflictAction: "uniquify",
        saveAs: false,
      });
      completed += 1;
    } catch {
      // Keep going so one failed image does not cancel the rest.
    }
  }
  return completed;
}

function renderDraft(draft) {
  els.draftTitle.textContent = draft.title || "No draft yet";
  els.draftPrice.textContent = draft.price ? `Price: $${draft.price}` : "";
  const meta = [];
  if (draft.vehicle?.year) meta.push(`Year ${draft.vehicle.year}`);
  if (draft.vehicle?.mileage) meta.push(`${draft.vehicle.mileage} mi`);
  if (draft.vehicle?.vin) meta.push(`VIN ${draft.vehicle.vin}`);
  if (draft.vehicle?.condition) meta.push(draft.vehicle.condition);
  if (draft.images?.length) meta.push(`${draft.images.length} image${draft.images.length === 1 ? "" : "s"}`);
  els.draftMeta.textContent = meta.join(" | ");
  els.draftDescription.textContent = draft.description || "";
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(["dealerApiBase", "dealerDraft"]);
  els.apiBase.value = saved.dealerApiBase || defaultApiBase;
  if (saved.dealerDraft) {
    renderDraft(saved.dealerDraft);
    setStatus("Saved draft ready. Quick Post will open Facebook and try to fill the form automatically.");
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function buildDraftForTab(apiBase) {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || !activeTab.url) {
    throw new Error("Open a vehicle page in Chrome first.");
  }
  if (!isSupportedInventoryUrl(activeTab.url)) {
    throw new Error("Open a Bert Ogden inventory vehicle page first.");
  }
  try {
    await ensureInventoryScript(activeTab.id);
  } catch (error) {
    throw new Error("Could not prepare the vehicle page. Refresh the tab and try again.");
  }
  const [template, scrapeResult] = await Promise.all([
    fetchTemplate(apiBase),
    chrome.tabs
      .sendMessage(activeTab.id, { type: "SCRAPE_CURRENT_VEHICLE" })
      .catch(() => ({ ok: false, error: "Could not read this page yet. Refresh the vehicle tab and try again." })),
  ]);
  if (!scrapeResult?.ok || !scrapeResult.vehicle) {
    throw new Error(scrapeResult?.error || "Could not read the vehicle page.");
  }
  if (!scrapeResult.vehicle.title && !scrapeResult.vehicle.year && !scrapeResult.vehicle.price) {
    throw new Error("The page opened, but vehicle details were not found. Make sure you are on the actual vehicle details page.");
  }
  return buildDraft(scrapeResult.vehicle, template);
}

async function saveDraftState(apiBase, draft, autoApply) {
  await chrome.storage.local.set({
    dealerApiBase: normalizeApiBase(apiBase),
    dealerDraft: draft,
    dealerAutoApply: {
      pending: Boolean(autoApply),
      updatedAt: Date.now(),
    },
  });
}

async function openMarketplace(autoApply = true) {
  const saved = await chrome.storage.local.get(["dealerDraft"]);
  await chrome.storage.local.set({
    dealerAutoApply: {
      pending: Boolean(autoApply && saved.dealerDraft),
      updatedAt: Date.now(),
    },
  });
  await chrome.tabs.create({ url: marketplaceCreateUrl });
}

els.saveSettings.addEventListener("click", async () => {
  await chrome.storage.local.set({
    dealerApiBase: normalizeApiBase(els.apiBase.value),
  });
  setStatus("Settings saved.");
});

els.captureCurrentTab.addEventListener("click", async () => {
  const apiBase = normalizeApiBase(els.apiBase.value);
  setStatus("Reading vehicle page...");
  try {
    const draft = await buildDraftForTab(apiBase);
    await saveDraftState(apiBase, draft, false);
    renderDraft(draft);
    setStatus("Draft saved. You can open Marketplace any time and the helper can fill the form.");
  } catch (error) {
    setStatus(error.message || "Draft build failed.");
  }
});

els.quickPost.addEventListener("click", async () => {
  const apiBase = normalizeApiBase(els.apiBase.value);
  setStatus("Building draft and opening Marketplace...");
  try {
    const draft = await buildDraftForTab(apiBase);
    await saveDraftState(apiBase, draft, true);
    renderDraft(draft);
    const downloadedCount = await downloadDraftImages(draft);
    await openMarketplace(true);
    setStatus(
      downloadedCount
        ? `Marketplace opened. The helper will try to fill the Facebook form automatically and downloaded ${downloadedCount} photo(s).`
        : "Marketplace opened. The helper will try to fill the Facebook form automatically."
    );
  } catch (error) {
    setStatus(error.message || "Quick Post failed.");
  }
});

els.openMarketplace.addEventListener("click", async () => {
  const saved = await chrome.storage.local.get(["dealerDraft"]);
  await openMarketplace(Boolean(saved.dealerDraft));
  setStatus(
    saved.dealerDraft
      ? "Marketplace opened. The helper will try to apply your saved draft automatically."
      : "Marketplace opened. Capture a vehicle first if you want fields filled automatically."
  );
});

loadSettings();
