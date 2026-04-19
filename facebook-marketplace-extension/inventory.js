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

  function titleCase(value) {
    return String(value || "")
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function parseTitleParts(title) {
    const clean = normalizeText(title).replace(/\s+[|-].*$/, "");
    const match = clean.match(/(20\d{2})\s+([A-Za-z]+)\s+(.+)/);
    if (!match) return { year: "", make: "", model: clean };
    return { year: match[1], make: match[2], model: match[3] };
  }

  function parseVehicleFromUrl(url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      const slug = pathname
        .split("/")
        .filter(Boolean)
        .find((part) => /^(new|used)-/.test(part));
      if (!slug) return { year: "", make: "", model: "", vin: "" };
      const parts = slug.split("-").filter(Boolean);
      if (!parts.length) return { year: "", make: "", model: "", vin: "" };
      if (parts[0] === "new" || parts[0] === "used") parts.shift();
      const year = /^\d{4}$/.test(parts[0] || "") ? parts.shift() : "";
      const make = parts.length ? titleCase(parts.shift()) : "";
      const last = parts[parts.length - 1] || "";
      const vin = /^[a-hj-npr-z0-9]{11,17}$/i.test(last) ? normalizeText(parts.pop()) : "";
      return {
        year: year || "",
        make,
        model: titleCase(parts.join(" ")),
        vin,
      };
    } catch {
      return { year: "", make: "", model: "", vin: "" };
    }
  }

  function flattenJsonLdNodes(input, acc = []) {
    if (!input) return acc;
    if (Array.isArray(input)) {
      input.forEach((item) => flattenJsonLdNodes(item, acc));
      return acc;
    }
    if (typeof input === "object") {
      acc.push(input);
      if (input["@graph"]) flattenJsonLdNodes(input["@graph"], acc);
    }
    return acc;
  }

  function readJsonLdVehicle() {
    const nodes = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      const raw = script.textContent || "";
      if (!raw.trim()) return;
      try {
        flattenJsonLdNodes(JSON.parse(raw), nodes);
      } catch {
        // Ignore invalid JSON-LD blocks from the page.
      }
    });
    for (const node of nodes) {
      const makeValue = typeof node.make === "string" ? node.make : node.make?.name || "";
      const modelValue = typeof node.model === "string" ? node.model : node.model?.name || "";
      const nameValue = node.name || "";
      const yearValue = node.vehicleModelDate || node.releaseDate || "";
      const priceValue =
        node.offers?.price ||
        node.offers?.[0]?.price ||
        node.price ||
        "";
      const mileageValue =
        node.mileageFromOdometer?.value ||
        node.mileageFromOdometer?.value?.value ||
        node.mileageFromOdometer ||
        "";
      const vinValue = node.vehicleIdentificationNumber || node.vin || "";
      if (nameValue || priceValue || vinValue || mileageValue || modelValue) {
        return {
          name: normalizeText(nameValue),
          year: normalizeText(yearValue),
          make: normalizeText(makeValue),
          model: normalizeText(modelValue),
          price: normalizeText(String(priceValue)).replace(/[^0-9]/g, ""),
          mileage: normalizeText(String(mileageValue)).replace(/[^0-9]/g, ""),
          vin: normalizeText(vinValue),
        };
      }
    }
    return { name: "", year: "", make: "", model: "", price: "", mileage: "", vin: "" };
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
    const urlParts = parseVehicleFromUrl(location.href);
    const jsonLd = readJsonLdVehicle();
    const rawTitle =
      jsonLd.name ||
      queryMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
      firstText(["h1"]) ||
      document.title;
    const titleParts = parseTitleParts(rawTitle);
    const price =
      firstText(["[data-price]", ".price", ".vehicle-price", ".our-price", ".sale-price"]) ||
      jsonLd.price ||
      queryMeta(['meta[itemprop="price"]']) ||
      firstMatch(pageText, [/Bert Ogden Price[^$0-9]*\$?([0-9,]+)/i, /Sale Price[^$0-9]*\$?([0-9,]+)/i]);
    const mileage =
      firstText(["[data-mileage]", ".mileage", ".odometer"]) ||
      jsonLd.mileage ||
      firstMatch(pageText, [/Mileage[^0-9]*([0-9,]+)/i, /Odometer[^0-9]*([0-9,]+)/i]);
    const vin =
      firstMatch(pageText, [/VIN[^A-Z0-9]*([A-HJ-NPR-Z0-9]{11,17})/i]) ||
      jsonLd.vin ||
      urlParts.vin ||
      queryMeta(['meta[itemprop="vehicleIdentificationNumber"]']);
    const stock = firstMatch(pageText, [/Stock[^A-Z0-9-]*([A-Z0-9-]+)/i]);
    const parts = {
      year: titleParts.year || jsonLd.year || urlParts.year,
      make: titleParts.make || jsonLd.make || urlParts.make,
      model:
        (titleParts.year || titleParts.make ? titleParts.model : "") ||
        jsonLd.model ||
        urlParts.model ||
        titleParts.model,
    };
    const condition = /\/used-/i.test(location.href) ? "Used" : "New";
    return {
      title: normalizeText(rawTitle || [parts.year, parts.make, parts.model].filter(Boolean).join(" ")),
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
