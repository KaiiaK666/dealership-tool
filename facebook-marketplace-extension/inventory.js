(function () {
  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function queryMeta(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.getAttribute("content") || node?.textContent || "";
      if (normalizeText(value)) return normalizeText(value);
    }
    return "";
  }

  function firstText(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = normalizeText(node?.textContent || "");
      if (value) return value;
    }
    return "";
  }

  function firstMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = String(text || "").match(pattern);
      if (match?.[1]) return normalizeText(match[1]);
    }
    return "";
  }

  function parseTitleParts(title) {
    const clean = normalizeText(title).replace(/\s+[|-].*$/, "");
    const match = clean.match(/(20\d{2})\s+([A-Za-z]+)\s+(.+)/);
    if (!match) return { year: "", make: "", model: clean };
    return { year: match[1], make: match[2], model: match[3] };
  }

  function collectImages() {
    const seen = new Set();
    const urls = [];
    document.querySelectorAll("img").forEach((img) => {
      const src = img.currentSrc || img.src || "";
      if (!src || seen.has(src)) return;
      if (!/^https?:/i.test(src)) return;
      const width = Number(img.naturalWidth || 0);
      const height = Number(img.naturalHeight || 0);
      if (width < 400 || height < 300) return;
      seen.add(src);
      urls.push(src);
    });
    return urls.slice(0, 10);
  }

  function scrapeVehiclePage() {
    const pageText = document.body?.innerText || "";
    const title =
      queryMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      firstText(["h1"]) ||
      document.title;
    const price =
      firstText(["[data-price]", ".price", ".vehicle-price", ".our-price", ".sale-price"]) ||
      queryMeta(['meta[itemprop="price"]']) ||
      firstMatch(pageText, [/Bert Ogden Price[^$0-9]*\$?([0-9,]+)/i, /Sale Price[^$0-9]*\$?([0-9,]+)/i]);
    const mileage =
      firstText(["[data-mileage]", ".mileage", ".odometer"]) ||
      firstMatch(pageText, [/Mileage[^0-9]*([0-9,]+)/i, /Odometer[^0-9]*([0-9,]+)/i]);
    const vin =
      firstMatch(pageText, [/VIN[^A-Z0-9]*([A-HJ-NPR-Z0-9]{11,17})/i]) ||
      queryMeta(['meta[itemprop="vehicleIdentificationNumber"]']);
    const stock = firstMatch(pageText, [/Stock[^A-Z0-9-]*([A-Z0-9-]+)/i]);
    const parts = parseTitleParts(title);
    const condition = /\/used-/i.test(location.href) ? "Used" : "New";
    return {
      title: normalizeText(title),
      year: parts.year,
      make: parts.make,
      model: parts.model,
      price: normalizeText(price).replace(/[^0-9]/g, ""),
      mileage: normalizeText(mileage).replace(/[^0-9]/g, ""),
      vin: normalizeText(vin),
      stock: normalizeText(stock),
      condition,
      url: location.href,
      images: collectImages(),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "SCRAPE_CURRENT_VEHICLE") return;
    try {
      sendResponse({ ok: true, vehicle: scrapeVehiclePage() });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Failed to read vehicle page." });
    }
    return true;
  });
})();
