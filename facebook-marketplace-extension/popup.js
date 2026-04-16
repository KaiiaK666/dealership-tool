const defaultApiBase = "https://api.bertogden123.com";

const els = {
  apiBase: document.getElementById("apiBase"),
  inventoryUrl: document.getElementById("inventoryUrl"),
  saveSettings: document.getElementById("saveSettings"),
  generateDraft: document.getElementById("generateDraft"),
  openMarketplace: document.getElementById("openMarketplace"),
  draftTitle: document.getElementById("draftTitle"),
  draftPrice: document.getElementById("draftPrice"),
  draftDescription: document.getElementById("draftDescription"),
  status: document.getElementById("status"),
};

function setStatus(text) {
  els.status.textContent = text || "";
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function firstMatch(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeText(match[1]);
  }
  return "";
}

function parseTitleParts(title) {
  const clean = normalizeText(title).replace(/\s+[|-].*$/, "");
  const match = clean.match(/(20\d{2})\s+([A-Za-z]+)\s+(.+)/);
  if (!match) {
    return { year: "", make: "", model: clean };
  }
  return { year: match[1], make: match[2], model: match[3] };
}

function fillTemplate(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "");
}

async function fetchTemplate(apiBase) {
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/marketplace/template`);
  if (!response.ok) throw new Error("Failed to load marketplace template");
  return response.json();
}

async function fetchInventoryHtml(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error("Failed to fetch inventory page");
  return response.text();
}

function extractVehicle(html, url, template) {
  const title =
    firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"]+)["']/i,
      /<title>([^<]+)<\/title>/i,
      /"name":"([^"]+)"/i,
    ]) || "Vehicle";
  const price =
    firstMatch(html, [
      /Bert Ogden Price[^$0-9]*\$?([0-9,]+)/i,
      /"price":"?([0-9,]+)"?/i,
      /itemprop=["']price["'][^>]+content=["']([^"]+)["']/i,
    ]) || "";
  const mileage =
    firstMatch(html, [
      /Mileage[^0-9]*([0-9,]+)/i,
      /Odometer[^0-9]*([0-9,]+)/i,
      /"mileageFromOdometer":[^}]*"value":"?([0-9,]+)"?/i,
    ]) || "0";
  const vin = firstMatch(html, [/"vehicleIdentificationNumber":"([^"]+)"/i, /VIN[^A-Z0-9]*([A-HJ-NPR-Z0-9]{11,17})/i]);
  const parts = parseTitleParts(title);
  const draftData = {
    year: parts.year,
    make: parts.make,
    model: parts.model,
    price: price ? `$${price}` : "",
    mileage: mileage ? `${mileage} mi` : "",
    vin,
    url,
    price_label: template.price_label || "Bert Ogden Price",
    cta_text: template.cta_text || "",
  };
  return {
    title: fillTemplate(template.title_template, draftData),
    price: price.replace(/[^0-9]/g, ""),
    description: fillTemplate(template.description_template, draftData),
    images: [],
    raw: draftData,
  };
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(["dealerApiBase", "dealerDraft", "dealerInventoryUrl"]);
  els.apiBase.value = saved.dealerApiBase || defaultApiBase;
  els.inventoryUrl.value = saved.dealerInventoryUrl || "";
  if (saved.dealerDraft) {
    renderDraft(saved.dealerDraft);
  }
}

function renderDraft(draft) {
  els.draftTitle.textContent = draft.title || "No draft yet";
  els.draftPrice.textContent = draft.price ? `Price: $${draft.price}` : "";
  els.draftDescription.textContent = draft.description || "";
}

els.saveSettings.addEventListener("click", async () => {
  await chrome.storage.local.set({
    dealerApiBase: els.apiBase.value.trim() || defaultApiBase,
    dealerInventoryUrl: els.inventoryUrl.value.trim(),
  });
  setStatus("Settings saved.");
});

els.generateDraft.addEventListener("click", async () => {
  const apiBase = els.apiBase.value.trim() || defaultApiBase;
  const inventoryUrl = els.inventoryUrl.value.trim();
  if (!inventoryUrl) {
    setStatus("Enter an inventory URL first.");
    return;
  }
  setStatus("Building draft...");
  try {
    const [template, html] = await Promise.all([fetchTemplate(apiBase), fetchInventoryHtml(inventoryUrl)]);
    const draft = extractVehicle(html, inventoryUrl, template);
    await chrome.storage.local.set({
      dealerApiBase: apiBase,
      dealerInventoryUrl: inventoryUrl,
      dealerDraft: draft,
    });
    renderDraft(draft);
    setStatus("Draft saved. Open Facebook Marketplace and click Apply Draft.");
  } catch (error) {
    setStatus(error.message || "Draft build failed.");
  }
});

els.openMarketplace.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://www.facebook.com/marketplace/create/item" });
});

loadSettings();
