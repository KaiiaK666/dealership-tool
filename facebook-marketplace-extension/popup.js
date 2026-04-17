const defaultApiBase = "https://api.bertogden123.com";

const els = {
  apiBase: document.getElementById("apiBase"),
  saveSettings: document.getElementById("saveSettings"),
  captureCurrentTab: document.getElementById("captureCurrentTab"),
  openMarketplace: document.getElementById("openMarketplace"),
  draftTitle: document.getElementById("draftTitle"),
  draftPrice: document.getElementById("draftPrice"),
  draftMeta: document.getElementById("draftMeta"),
  draftDescription: document.getElementById("draftDescription"),
  status: document.getElementById("status"),
};

function setStatus(text) {
  els.status.textContent = text || "";
}

function fillTemplate(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "");
}

async function fetchTemplate(apiBase) {
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/marketplace/template`);
  if (!response.ok) throw new Error("Failed to load marketplace template");
  return response.json();
}

function buildDraft(vehicle, template) {
  const draftData = {
    year: vehicle.year || "",
    make: vehicle.make || "",
    model: vehicle.model || vehicle.title || "",
    price: vehicle.price ? `$${vehicle.price}` : "",
    mileage: vehicle.mileage ? `${vehicle.mileage} mi` : "",
    vin: vehicle.vin || "",
    url: vehicle.url || "",
    price_label: template.price_label || "Bert Ogden Price",
    cta_text: template.cta_text || "",
  };
  return {
    title: fillTemplate(template.title_template, draftData),
    price: String(vehicle.price || "").replace(/[^0-9]/g, ""),
    description: fillTemplate(template.description_template, draftData),
    images: Array.isArray(vehicle.images) ? vehicle.images : [],
    raw: draftData,
    vehicle,
  };
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(["dealerApiBase", "dealerDraft"]);
  els.apiBase.value = saved.dealerApiBase || defaultApiBase;
  if (saved.dealerDraft) {
    renderDraft(saved.dealerDraft);
  }
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
  els.draftMeta.textContent = meta.join(" • ");
  els.draftDescription.textContent = draft.description || "";
}

els.saveSettings.addEventListener("click", async () => {
  await chrome.storage.local.set({
    dealerApiBase: els.apiBase.value.trim() || defaultApiBase,
  });
  setStatus("Settings saved.");
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

els.captureCurrentTab.addEventListener("click", async () => {
  const apiBase = els.apiBase.value.trim() || defaultApiBase;
  setStatus("Reading vehicle page...");
  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id || !activeTab.url) {
      throw new Error("Open a vehicle page in Chrome first.");
    }
    if (!/bertogden/i.test(activeTab.url)) {
      throw new Error("Open a Bert Ogden inventory vehicle page first.");
    }
    const [template, scrapeResult] = await Promise.all([
      fetchTemplate(apiBase),
      chrome.tabs.sendMessage(activeTab.id, { type: "SCRAPE_CURRENT_VEHICLE" }),
    ]);
    if (!scrapeResult?.ok || !scrapeResult.vehicle) {
      throw new Error(scrapeResult?.error || "Could not read the vehicle page.");
    }
    const draft = buildDraft(scrapeResult.vehicle, template);
    await chrome.storage.local.set({
      dealerApiBase: apiBase,
      dealerDraft: draft,
    });
    renderDraft(draft);
    setStatus("Draft ready. Open Facebook Marketplace and click Apply Draft.");
  } catch (error) {
    setStatus(error.message || "Draft build failed.");
  }
});

els.openMarketplace.addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://www.facebook.com/marketplace/create/vehicle" });
});

loadSettings();
