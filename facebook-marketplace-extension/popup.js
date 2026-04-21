const defaultApiBase = "https://api.bertogden123.com";
const fallbackApiBases = [defaultApiBase, "https://dealership-tool-api.onrender.com"];
const marketplaceCreateUrl = "https://www.facebook.com/marketplace/create/vehicle";
const marketplaceTitleToken = "{year} {make} {model}";
const marketplacePriceLine = "{price_label}: {price}";
const marketplaceMileageLine = "Mileage: {mileage}";
const marketplaceVinLine = "VIN: {vin}";
const marketplaceCtaLine = "{cta_text}";
const marketplaceUrlLine = "{url}";
const historyLimit = 20;
const historyKey = "dealerPostHistory";
const autoPublishKey = "dealerAutoPublishEnabled";
const extensionVersion = chrome.runtime?.getManifest?.()?.version || "dev";
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
  price_label: "Price",
  cta_text: "Message Bert Ogden now to confirm availability, financing options, trade value, and your test drive today.",
};

const els = {
  versionBadge: document.getElementById("versionBadge"),
  apiBase: document.getElementById("apiBase"),
  saveSettings: document.getElementById("saveSettings"),
  quickPost: document.getElementById("quickPost"),
  captureCurrentTab: document.getElementById("captureCurrentTab"),
  openMarketplace: document.getElementById("openMarketplace"),
  reloadExtension: document.getElementById("reloadExtension"),
  clearHistory: document.getElementById("clearHistory"),
  autoPublish: document.getElementById("autoPublish"),
  draftTitle: document.getElementById("draftTitle"),
  draftPrice: document.getElementById("draftPrice"),
  draftMeta: document.getElementById("draftMeta"),
  draftDescription: document.getElementById("draftDescription"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
  status: document.getElementById("status"),
};

function normalizeApiBase(value) {
  return String(value || defaultApiBase).trim().replace(/\/$/, "") || defaultApiBase;
}

function uniqueApiBases(values) {
  return Array.from(new Set(values.map(normalizeApiBase).filter(Boolean)));
}

function normalizeSentence(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
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

function formatCurrency(value) {
  const numeric = String(value || "").replace(/[^0-9]/g, "");
  return numeric ? `$${Number(numeric).toLocaleString("en-US")}` : "";
}

function capitalizeWords(value) {
  return normalizeSentence(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
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
    cta_text: normalizeSentence(source.cta_text || "") || marketplaceTemplateDefaults.cta_text,
  };
}

function bodyStylePitch(bodyStyle) {
  const source = normalizeSentence(bodyStyle).toLowerCase();
  if (source.includes("suv")) return "room for family trips, cargo, and everyday comfort";
  if (source.includes("truck")) return "pickup utility, everyday capability, and job-ready strength";
  if (source.includes("hatch")) return "easy city parking and flexible cargo space";
  if (source.includes("coupe")) return "sportier looks with daily-driver practicality";
  if (source.includes("van")) return "family space and people-moving comfort";
  if (source.includes("wagon")) return "extra cargo room without giving up road manners";
  if (source.includes("convert")) return "open-air driving with head-turning style";
  return "an easy daily drive with modern comfort and clean presentation";
}

function buildWhyBuyLine(vehicle, facts) {
  const bodyStyle = normalizeSentence(vehicle.body_style || "vehicle").toLowerCase();
  const condition = normalizeSentence(vehicle.marketplace_condition || vehicle.condition || "");
  const factLine = facts.length ? `${facts.join(", ")}.` : "clean presentation and ready-to-go condition.";
  const bodyNoun = bodyStyle || "vehicle";
  const conditionPrefix = condition ? `${condition} ` : "";
  return `Why buy this ${conditionPrefix}${bodyNoun}: ${bodyStylePitch(bodyStyle)}. ${capitalizeWords(factLine)}`;
}

function buildFactLine(vehicle) {
  const facts = [];
  const mileage = formatNumber(vehicle.mileage);
  if (mileage) {
    facts.push(Number(mileage.replace(/,/g, "")) <= 500 ? `only ${mileage} miles` : `${mileage} miles`);
  }
  if (vehicle.transmission) facts.push(normalizeSentence(vehicle.transmission).toLowerCase());
  if (vehicle.fuel_type) facts.push(normalizeSentence(vehicle.fuel_type).toLowerCase());
  const colors = [vehicle.exterior_color, vehicle.interior_color].map(normalizeSentence).filter(Boolean);
  if (colors.length === 2) facts.push(`${colors[0]} exterior with ${colors[1]} interior`);
  else if (colors[0]) facts.push(`${colors[0]} finish`);
  if (vehicle.clean_title !== false) facts.push("clean title");
  return facts;
}

function buildSalesDescription(vehicle, template, draftData) {
  const nameLine = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const headline = nameLine ? `Drive home this ${nameLine} from Bert Ogden.` : "Drive home this Bert Ogden vehicle.";
  const facts = buildFactLine(vehicle);
  const lines = [headline];
  if (facts.length) {
    lines.push(`Highlights: ${capitalizeWords(facts.join(", "))}.`);
  }
  lines.push(buildWhyBuyLine(vehicle, facts));
  if (draftData.price) {
    lines.push(`Priced at ${draftData.price}.`);
  }
  lines.push(template.cta_text || marketplaceTemplateDefaults.cta_text);
  if (vehicle.url) {
    lines.push(`See full details: ${vehicle.url}`);
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
    price: formatCurrency(vehicle.price),
    mileage: vehicle.mileage ? `${formatNumber(vehicle.mileage)} mi` : "",
    vin: vehicle.vin || "",
    condition: vehicle.condition || "",
    body_style: vehicle.body_style || "Sedan",
    stock: vehicle.stock || "",
    url: vehicle.url || "",
    price_label: normalizedTemplate.price_label || marketplaceTemplateDefaults.price_label,
    cta_text: normalizedTemplate.cta_text || marketplaceTemplateDefaults.cta_text,
  };
  return {
    title: fillTemplate(normalizedTemplate.title_template, draftData),
    price: String(vehicle.price || "").replace(/[^0-9]/g, ""),
    description: buildSalesDescription(vehicle, normalizedTemplate, draftData),
    images: Array.isArray(vehicle.images) ? vehicle.images : [],
    raw: draftData,
    vehicle,
  };
}

function renderDraft(draft) {
  els.draftTitle.textContent = draft.title || "No draft yet";
  els.draftPrice.textContent = draft.price ? `Price: ${formatCurrency(draft.price)}` : "";
  const meta = [];
  if (draft.vehicle?.year) meta.push(`Year ${draft.vehicle.year}`);
  if (draft.vehicle?.mileage) meta.push(`${formatNumber(draft.vehicle.mileage)} mi`);
  if (draft.vehicle?.vin) meta.push(`VIN ${draft.vehicle.vin}`);
  if (draft.vehicle?.condition) meta.push(draft.vehicle.condition);
  if (draft.images?.length) meta.push(`${draft.images.length} image${draft.images.length === 1 ? "" : "s"}`);
  els.draftMeta.textContent = meta.join(" | ");
  els.draftDescription.textContent = draft.description || "";
}

function buildHistoryEntry(draft, status, detail) {
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status,
    detail: normalizeSentence(detail),
    title: normalizeSentence(draft?.title || [draft?.vehicle?.year, draft?.vehicle?.make, draft?.vehicle?.model].filter(Boolean).join(" ")) || "Vehicle draft",
    price: formatCurrency(draft?.price || draft?.vehicle?.price || ""),
    stock: normalizeSentence(draft?.vehicle?.stock || ""),
    vin: normalizeSentence(draft?.vehicle?.vin || ""),
    url: draft?.vehicle?.url || "",
    created_at: new Date().toISOString(),
  };
}

async function appendHistoryEntry(entry) {
  const saved = await chrome.storage.local.get([historyKey]);
  const history = Array.isArray(saved[historyKey]) ? saved[historyKey] : [];
  const nextHistory = [entry, ...history].slice(0, historyLimit);
  await chrome.storage.local.set({ [historyKey]: nextHistory });
  renderHistory(nextHistory);
}

function formatHistoryTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderHistory(entries) {
  const history = Array.isArray(entries) ? entries : [];
  els.historyList.innerHTML = "";
  els.historyEmpty.style.display = history.length ? "none" : "block";
  history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-item__top";

    const title = document.createElement("strong");
    title.textContent = entry.title || "Vehicle draft";

    const status = document.createElement("span");
    status.className = "history-status";
    status.textContent = entry.status || "saved";

    top.appendChild(title);
    top.appendChild(status);

    const meta = document.createElement("div");
    meta.className = "history-item__meta";

    const left = document.createElement("small");
    left.textContent = [entry.price, entry.stock ? `Stock ${entry.stock}` : "", entry.vin ? `VIN ${entry.vin}` : ""]
      .filter(Boolean)
      .join(" | ") || "No price captured";

    const right = document.createElement("small");
    right.textContent = formatHistoryTime(entry.created_at);

    meta.appendChild(left);
    meta.appendChild(right);

    const detail = document.createElement("p");
    detail.textContent = entry.detail || "";

    item.appendChild(top);
    item.appendChild(meta);
    if (entry.detail) item.appendChild(detail);
    els.historyList.appendChild(item);
  });
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(["dealerApiBase", "dealerDraft", autoPublishKey, historyKey]);
  els.versionBadge.textContent = `v${extensionVersion}`;
  els.apiBase.value = saved.dealerApiBase || defaultApiBase;
  els.autoPublish.checked = saved[autoPublishKey] !== false;
  renderHistory(saved[historyKey] || []);
  if (saved.dealerDraft) {
    renderDraft(saved.dealerDraft);
    setStatus("Saved draft ready. Quick Post will open Facebook and try to finish the form automatically.");
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
  } catch {
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
    [autoPublishKey]: Boolean(els.autoPublish.checked),
  });
}

async function openMarketplace(autoApply = true) {
  const saved = await chrome.storage.local.get(["dealerDraft", autoPublishKey]);
  await chrome.storage.local.set({
    dealerAutoApply: {
      pending: Boolean(autoApply && saved.dealerDraft),
      updatedAt: Date.now(),
    },
    [autoPublishKey]: Boolean(els.autoPublish.checked),
  });
  await chrome.tabs.create({ url: marketplaceCreateUrl });
}

els.saveSettings.addEventListener("click", async () => {
  await chrome.storage.local.set({
    dealerApiBase: normalizeApiBase(els.apiBase.value),
    [autoPublishKey]: Boolean(els.autoPublish.checked),
  });
  setStatus("Settings saved.");
});

els.captureCurrentTab.addEventListener("click", async () => {
  const apiBase = normalizeApiBase(els.apiBase.value);
  setStatus("Reading vehicle page...");
  try {
    const draft = await buildDraftForTab(apiBase);
    await saveDraftState(apiBase, draft, false);
    await appendHistoryEntry(buildHistoryEntry(draft, "captured", "Draft captured from the vehicle page and saved locally."));
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
    await appendHistoryEntry(
      buildHistoryEntry(
        draft,
        "queued",
        els.autoPublish.checked
          ? "Facebook posting queued with auto-publish enabled."
          : "Facebook posting queued and waiting for final review."
      )
    );
    renderDraft(draft);
    await openMarketplace(true);
    setStatus(
      els.autoPublish.checked
        ? "Marketplace opened. The helper will try to fill the form and publish automatically."
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

els.reloadExtension.addEventListener("click", () => {
  setStatus(`Reloading extension v${extensionVersion}...`);
  chrome.runtime.reload();
});

els.clearHistory.addEventListener("click", async () => {
  await chrome.storage.local.set({ [historyKey]: [] });
  renderHistory([]);
  setStatus("Posting history cleared.");
});

els.autoPublish.addEventListener("change", async () => {
  await chrome.storage.local.set({ [autoPublishKey]: Boolean(els.autoPublish.checked) });
  setStatus(
    els.autoPublish.checked
      ? "Auto publish enabled. The helper will click Publish once Facebook reaches the final review step."
      : "Auto publish disabled. The helper will stop on Facebook's final review step."
  );
});

loadSettings();
