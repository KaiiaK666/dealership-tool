import React, { useEffect, useRef, useState } from "react";
import {
  apiBase,
  adminLogin,
  assignBdcLead,
  cancelAgentLoopRun,
  clearBdcHistory,
  createAgentLoopRun,
  createFreshUpAnalytics,
  createFreshUpLog,
  createBdcAgent,
  createSalesperson,
  createServiceDriveTraffic,
  createSpecial,
  createTrafficPdf,
  deleteServiceDriveTrafficDay,
  generateServiceDrive,
  getAgentLoopConfig,
  getAgentLoopRun,
  getAgentLoopRuns,
  getAdminSalespeople,
  getAdminDaysOff,
  getAdminSession,
  getBdcAgents,
  getNotificationConfig,
  sendNotificationTestEmail,
  sendNotificationTestSms,
  getBdcLog,
  getBdcReport,
  getBdcState,
  getFreshUpLog,
  getFreshUpLinks,
  getFreshUpAnalytics,
  getBdcDistribution,
  getBdcUndoSettings,
  getMarketplaceTemplate,
  getQuoteRates,
  getSalespeople,
  getSpecials,
  getTabVisibility,
  getServiceDrive,
  getServiceDriveTraffic,
  getTrafficPdfs,
  importMastermindServiceDriveTraffic,
  importReynoldsServiceDriveTraffic,
  replaceAdminDaysOffMonth,
  undoMastermindServiceDriveTrafficImport,
  undoReynoldsServiceDriveTrafficImport,
  updateBdcAgent,
  updateBdcDistribution,
  updateFreshUpLinks,
  undoLastBdcAssign,
  updateBdcUndoSettings,
  updateMarketplaceTemplate,
  updateQuoteRates,
  updateSalesperson,
  updateSpecial,
  updateTabVisibility,
  updateServiceDriveAssignment,
  updateServiceDriveTraffic,
  uploadServiceDriveTrafficImages,
  updateServiceDriveTrafficSales,
} from "./api.js";
import "./App.css";

const TABS = [
  { id: "serviceCalendar", label: "Service Drive Calendar" },
  { id: "serviceNotes", label: "Service Drive Notes" },
  { id: "trafficAnalysis", label: "Service Drive Traffic Analysis" },
  { id: "bdc", label: "BDC Assign" },
  { id: "reports", label: "BDC Reports" },
  { id: "traffic", label: "Service Drive Traffic" },
  { id: "freshUp", label: "Freshup Log" },
  { id: "marketplace", label: "Facebook Marketplace" },
  { id: "quote", label: "Quote Tool" },
  { id: "specials", label: "Specials" },
  { id: "admin", label: "Admin" },
];

function emptySalesForm() {
  return {
    name: "",
    dealership: "Kia",
    weekly_days_off: [],
    active: true,
    phone_number: "",
    email: "",
    notify_sms: false,
    notify_email: false,
  };
}

const ADMIN_SECTIONS = [
  { id: "staff", label: "Staff Setup" },
  { id: "daysOff", label: "Days Off" },
  { id: "trafficLog", label: "Traffic Log" },
  { id: "bdcDistribution", label: "Lead Distribution Type" },
  { id: "tabs", label: "Tab Visibility" },
  { id: "freshupLinks", label: "Freshup Links" },
  { id: "agentLoops", label: "Agent Loops" },
  { id: "marketplace", label: "Marketplace" },
  { id: "quoteRates", label: "Quote Rates" },
  { id: "specials", label: "Specials" },
];

const DEALERSHIP_ORDER = ["Kia", "Mazda", "Outlet"];
const TRAFFIC_BRANDS = ["Kia", "Mazda"];
const QUOTE_BRANDS = ["Kia New", "Mazda New", "Used"];
const MARKETPLACE_TEMPLATE_DEFAULTS = {
  title_template: "{year} {make} {model}",
  description_template:
    "{year} {make} {model}\n{price_label}: {price}\nMileage: {mileage}\nVIN: {vin}\n{cta_text}\n{url}",
  price_label: "Price",
  cta_text: "Message us today for availability, trade value, and financing options.",
};
const MARKETPLACE_TITLE_TOKEN = "{year} {make} {model}";
const MARKETPLACE_BUILDER_DEFAULTS = {
  titlePrefix: "",
  titleSuffix: "",
  priceLabel: "Price",
  ctaText: "Message us today for availability, trade value, and financing options.",
  includeVehicleLine: true,
  includeMileage: true,
  includeVin: true,
  includeUrl: true,
};
const MARKETPLACE_PREVIEW_SAMPLE = {
  year: "2024",
  make: "Kia",
  model: "Telluride SX",
  price: "$41,995",
  mileage: "12,440 mi",
  vin: "5XYP5DGC8RG123456",
  url: "https://www.bertogdenexample.com/vehicle/2024-kia-telluride-sx",
};
const TRAFFIC_ANALYSIS_PROMPTS = [
  "What day was busiest this month?",
  "Which traffic rows still need notes?",
  "Compare Kia vs Mazda traffic.",
  "Who owns the most appointments?",
];
const FRESH_UP_STORAGE_KEY = "dealer_tool_fresh_up_form";
const SERVICE_NOTES_PREFERENCES_KEY = "dealer_tool_service_notes_prefs";
const FRESH_UP_DEFAULTS = {
  customerName: "",
  phone: "",
  salespersonId: "",
  salespersonQuery: "",
  source: "Desk",
};
const FRESHUP_LINKS_DEFAULTS = {
  page_title: "Start with Bert Ogden Mission",
  page_subtitle: "Drop your info first, then choose the next step that fits you best.",
  form_title: "Send us your contact info",
  form_subtitle: "A sales specialist will follow up fast.",
  submit_label: "Send My Info",
  stores: [
    {
      dealership: "Kia",
      display_name: "Mission Kia",
      call_label: "Call us now",
      call_url: "tel:(956) 429 8898",
      maps_label: "Google Maps",
      maps_url:
        "https://www.google.com/maps/place/Bert+Ogden+Mission+Kia/@26.1969595,-98.2927102,17z/data=!3m1!4b1!4m6!3m5!1s0x8665a7eced82c205:0x3fe685adeab8c28e!8m2!3d26.1969595!4d-98.2901353!16s%2Fg%2F1tjdgmn5?entry=ttu&g_ep=EgoyMDI2MDIyMi4wIKXMDSoASAFQAw%3D%3D",
      instagram_url: "https://www.instagram.com/bertogdenkiamission/",
      facebook_url: "https://www.facebook.com/BertOgdenMissionKia",
      youtube_url: "https://www.youtube.com/channel/UCGVeQ1vKWK3bLq396D8P_4A",
      soft_pull_label: "Quick Qualify",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/fcb574d194ea477c945ec558b605c0f7-202061",
      hard_pull_label: "Quick Application",
      hard_pull_url: "https://www.700dealer.com/QuickQualify/efdbaaebf9444bf18a6e3ca931db75f3-2020120",
      inventory_label: "View Kia New Inventory",
      inventory_url: "https://www.bertogdenmissionkia.com/new-vehicles/",
    },
    {
      dealership: "Mazda",
      display_name: "Mission Mazda",
      call_label: "",
      call_url: "",
      maps_label: "",
      maps_url: "",
      instagram_url: "",
      facebook_url: "",
      youtube_url: "",
      soft_pull_label: "Quick Qualify",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/3019d192efae4e3684cc49a88095425a-202061",
      hard_pull_label: "Quick Application",
      hard_pull_url: "https://www.700dealer.com/QuickQualify/d303d5b01d0f44df9ca5aad9a8a408dd-2019930",
      inventory_label: "View Mazda New Inventory",
      inventory_url: "https://www.bertogdenmissionmazda.com/new-vehicles/",
    },
    {
      dealership: "Outlet",
      display_name: "Mission Auto Outlet",
      call_label: "",
      call_url: "",
      maps_label: "",
      maps_url: "",
      instagram_url: "",
      facebook_url: "",
      youtube_url: "",
      soft_pull_label: "Quick Qualify",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/88a0b45934bf4a4e8937c8ccb61c463f-202061",
      hard_pull_label: "Quick Application",
      hard_pull_url: "https://www.700dealer.com/QuickQualify/6d6d3105f3d3447a95e729875e0f248b-2020120",
      inventory_label: "View Pre-Owned Inventory",
      inventory_url: "https://www.bertogdenmissionautooutlet.com/inventory/used-2021-kia-forte-gt-line-fwd-4d-sedan-3kpf34ad7me310864/",
    },
  ],
};
const STORE_BRAND_META = {
  Kia: {
    logo: "/logo-kia.jpg",
    badge: "Kia",
    accent: "#1f7cf6",
    tint: "rgba(31, 124, 246, 0.18)",
  },
  Mazda: {
    logo: "/logo-mazda.jpeg",
    badge: "Mazda",
    accent: "#d8dce3",
    tint: "rgba(216, 220, 227, 0.16)",
  },
  Outlet: {
    logo: "/logo-facebook.png",
    badge: "Bert Ogden",
    accent: "#f1a537",
    tint: "rgba(241, 165, 55, 0.18)",
  },
};
const FRESHUP_SOCIAL_LINKS = [
  { key: "instagram_url", label: "Instagram", icon: "IG" },
  { key: "facebook_url", label: "Facebook", icon: "f" },
  { key: "youtube_url", label: "YouTube", icon: "▶" },
];
const FRESHUP_ANALYTICS_DEFAULTS = {
  total_events: 0,
  page_views: 0,
  submissions: 0,
  link_clicks: 0,
  clicks_by_link_type: [],
  clicks_by_store: [],
  recent: [],
};
const CREDIT_TIERS = [
  { label: "400s", min: 400, max: 499 },
  { label: "500s", min: 500, max: 599 },
  { label: "600s", min: 600, max: 699 },
  { label: "700s", min: 700, max: 799 },
  { label: "800s", min: 800, max: 899 },
];
const TRAFFIC_URL = import.meta.env.VITE_TRAFFIC_URL || "https://bokbbui-production.up.railway.app/";
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthLabel(value) {
  if (!value) return "";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, (month || 1) - 1, 1)
  );
}

function dateParts(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return {
    dayNumber: parsed.getDate(),
    monthShort: new Intl.DateTimeFormat("en-US", { month: "short" }).format(parsed),
    weekdayIndex: parsed.getDay(),
  };
}

function dateTimeLabel(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function longDateLabel(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function errText(error) {
  if (!error) return "Request failed";
  const text = typeof error === "string" ? error : error.message || "Request failed";
  const separator = " - ";
  const separatorIndex = text.indexOf(separator);
  if (separatorIndex >= 0) {
    const detail = text.slice(separatorIndex + separator.length).trim();
    try {
      const payload = JSON.parse(detail);
      if (payload && typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail.trim();
      }
    } catch {
      // Leave non-JSON payloads untouched.
    }
  }
  if (text) return text;
  return "Request failed";
}

function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBase}${path}`;
}

function buildCalendarCells(days) {
  if (!days.length) return [];
  const firstOffset = dateParts(days[0].date).weekdayIndex;
  return [...Array.from({ length: firstOffset }, () => null), ...days];
}

function buildPrintCalendarCells(days) {
  const cells = buildCalendarCells(days);
  const rowCount = Math.max(5, Math.ceil(cells.length / 7));
  const targetLength = rowCount * 7;
  return [...cells, ...Array.from({ length: Math.max(0, targetLength - cells.length) }, () => null)];
}

function toggleDate(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value].sort();
}

function monthDateValues(monthKey) {
  if (!monthKey) return [];
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const count = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, "0")}`);
}

function buildMonthDateCells(monthKey) {
  const dates = monthDateValues(monthKey);
  if (!dates.length) return [];
  const firstOffset = dateParts(dates[0]).weekdayIndex;
  return [...Array.from({ length: firstOffset }, () => null), ...dates];
}

function scheduleDriveTeam(day) {
  if (!day) return [];
  return [
    {
      brand: "Kia",
      salesperson_id: day.kia?.salesperson_id ?? null,
      salesperson_name: day.kia?.salesperson_name ?? null,
      salesperson_dealership: day.kia?.salesperson_dealership ?? null,
    },
    {
      brand: "Mazda",
      salesperson_id: day.mazda?.salesperson_id ?? null,
      salesperson_name: day.mazda?.salesperson_name ?? null,
      salesperson_dealership: day.mazda?.salesperson_dealership ?? null,
    },
  ];
}

function driveTeamText(team) {
  if (!team?.length) return "No team assigned";
  return team.map((member) => `${member.brand}: ${member.salesperson_name || "Open"}`).join(" / ");
}

function driveTeamMember(team, brand) {
  return team.find((member) => member.brand === brand) || { brand, salesperson_id: null, salesperson_name: null };
}

function shortPersonName(name) {
  if (!name) return "Open";
  return name.split(" ")[0];
}

function isSundayDate(value) {
  if (!value) return false;
  return dateParts(value).weekdayIndex === 0;
}

function odometerLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "Miles n/a";
  return text.toLowerCase().includes("mi") ? text : `${text} mi`;
}

function numericValue(value) {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function creditTierFromScore(scoreValue) {
  const score = Math.round(numericValue(scoreValue));
  if (!score) return "";
  for (const tier of CREDIT_TIERS) {
    if (score >= tier.min && score <= tier.max) return tier.label;
  }
  if (score < CREDIT_TIERS[0].min) return CREDIT_TIERS[0].label;
  return CREDIT_TIERS[CREDIT_TIERS.length - 1].label;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "$0.00";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function fillMarketplaceTemplate(template, data) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => data[key] ?? "");
}

function buildMarketplaceTemplateFromBuilder(builder) {
  const prefix = String(builder.titlePrefix || "").trim();
  const suffix = String(builder.titleSuffix || "").trim();
  const title_template = [prefix, MARKETPLACE_TITLE_TOKEN, suffix].filter(Boolean).join(" ").trim();
  const descriptionLines = [];
  if (builder.includeVehicleLine) descriptionLines.push(MARKETPLACE_TITLE_TOKEN);
  descriptionLines.push("{price_label}: {price}");
  if (builder.includeMileage) descriptionLines.push("Mileage: {mileage}");
  if (builder.includeVin) descriptionLines.push("VIN: {vin}");
  if (String(builder.ctaText || "").trim()) descriptionLines.push("{cta_text}");
  if (builder.includeUrl) descriptionLines.push("{url}");
  return {
    title_template: title_template || MARKETPLACE_TITLE_TOKEN,
    description_template: descriptionLines.join("\n"),
    price_label: String(builder.priceLabel || MARKETPLACE_TEMPLATE_DEFAULTS.price_label).trim() || MARKETPLACE_TEMPLATE_DEFAULTS.price_label,
    cta_text: String(builder.ctaText || "").trim(),
  };
}

function marketplaceBuilderFromTemplate(template) {
  const source = {
    ...MARKETPLACE_TEMPLATE_DEFAULTS,
    ...(template || {}),
  };
  const title = String(source.title_template || MARKETPLACE_TITLE_TOKEN);
  const tokenIndex = title.indexOf(MARKETPLACE_TITLE_TOKEN);
  const titlePrefix = tokenIndex >= 0 ? title.slice(0, tokenIndex).trim() : "";
  const titleSuffix = tokenIndex >= 0 ? title.slice(tokenIndex + MARKETPLACE_TITLE_TOKEN.length).trim() : "";
  const lines = String(source.description_template || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    titlePrefix,
    titleSuffix,
    priceLabel: String(source.price_label || MARKETPLACE_TEMPLATE_DEFAULTS.price_label),
    ctaText: String(source.cta_text || MARKETPLACE_TEMPLATE_DEFAULTS.cta_text),
    includeVehicleLine: lines.includes(MARKETPLACE_TITLE_TOKEN),
    includeMileage: lines.some((line) => line.includes("{mileage}")),
    includeVin: lines.some((line) => line.includes("{vin}")),
    includeUrl: lines.some((line) => line.includes("{url}")),
  };
}

function freshUpTimestampLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function readFreshUpDraft() {
  if (typeof window === "undefined") return FRESH_UP_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(FRESH_UP_STORAGE_KEY);
    if (!raw) return FRESH_UP_DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...FRESH_UP_DEFAULTS, ...(parsed || {}) };
  } catch {
    return FRESH_UP_DEFAULTS;
  }
}

function readServiceNotesPreferences() {
  const defaults = { salespersonId: "", brandFilter: "All" };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(SERVICE_NOTES_PREFERENCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const brandFilter = ["All", "Kia", "Mazda"].includes(parsed?.brandFilter) ? parsed.brandFilter : "All";
    return {
      salespersonId: String(parsed?.salespersonId || "").trim(),
      brandFilter,
    };
  } catch {
    return defaults;
  }
}

function freshUpSummaryText(form, salespersonName) {
  return [
    `Fresh Up - ${freshUpTimestampLabel()}`,
    `Customer: ${String(form.customerName || "").trim() || "Not added"}`,
    `Phone: ${String(form.phone || "").trim() || "Not added"}`,
    `Salesperson: ${salespersonName || "Not selected"}`,
    `Source: ${String(form.source || "").trim() || "Desk"}`,
  ].join("\n");
}

function readFreshUpLaunchContext() {
  if (typeof window === "undefined") return { cardMode: false, salespersonId: "", tab: "" };
  const search = new URLSearchParams(window.location.search);
  return {
    cardMode: search.get("freshup") === "card" || search.get("nfc") === "1",
    salespersonId: String(search.get("salesperson") || "").trim(),
    tab: String(search.get("tab") || "").trim(),
  };
}

function initialTabValue() {
  const context = readFreshUpLaunchContext();
  if (context.cardMode || context.tab === "freshUp") return "freshUp";
  const requestedTab = String(context.tab || "").trim();
  if (requestedTab && TABS.some((item) => item.id === requestedTab)) return requestedTab;
  return "serviceNotes";
}

function normalizeLookupText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findSalespersonMatch(people, value) {
  const normalized = normalizeLookupText(value);
  if (!normalized) return null;
  return (
    people.find((person) => normalizeLookupText(person.name) === normalized) ||
    people.find((person) => normalizeLookupText(person.name).startsWith(normalized)) ||
    null
  );
}

function formatPhoneInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function phoneHref(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : "";
}

function freshUpCardUrl(salespersonId) {
  if (typeof window === "undefined" || !salespersonId) return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("freshup", "card");
  url.searchParams.set("salesperson", String(salespersonId));
  return url.toString();
}

function freshUpStoreBrandMeta(dealership) {
  return STORE_BRAND_META[dealership] || STORE_BRAND_META.Outlet;
}

function freshUpAnalyticsLabel(value) {
  const mapping = {
    page_view: "Page View",
    submit: "Submit",
    link_click: "Link Click",
    soft_pull: "Quick Qualify",
    hard_pull: "Quick Application",
    inventory: "Inventory",
    maps: "Maps",
    call: "Call",
    instagram: "Instagram",
    facebook: "Facebook",
    youtube: "YouTube",
  };
  return mapping[value] || String(value || "Other").replace(/_/g, " ");
}

async function copyTextValue(value) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("Clipboard not available");
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "absolute";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

function sortTrafficEntries(entries) {
  return [...(entries || [])].sort((left, right) => {
    const leftTs = Number(left?.appointment_ts || 0);
    const rightTs = Number(right?.appointment_ts || 0);
    const leftRank = leftTs > 0 ? leftTs : Number.MAX_SAFE_INTEGER;
    const rightRank = rightTs > 0 ? rightTs : Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftName = String(left?.customer_name || "").toLowerCase();
    const rightName = String(right?.customer_name || "").toLowerCase();
    if (leftName !== rightName) return leftName.localeCompare(rightName);
    return Number(left?.id || 0) - Number(right?.id || 0);
  });
}

function trafficOfferIdeaLookup(offerIdea) {
  const details = {};
  String(offerIdea || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex <= 0) return;
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key || !value || details[key]) return;
      details[key] = value;
    });
  return details;
}

function trafficAnalysisTokens(value) {
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "also",
    "been",
    "call",
    "came",
    "customer",
    "deal",
    "from",
    "have",
    "into",
    "just",
    "like",
    "need",
    "next",
    "note",
    "notes",
    "sent",
    "text",
    "that",
    "their",
    "them",
    "then",
    "they",
    "this",
    "today",
    "vehicle",
    "with",
    "will",
    "went",
    "when",
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stopWords.has(word));
}

function formatAnalysisList(items, emptyLabel = "None") {
  if (!items.length) return emptyLabel;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildTrafficAnalysis(entries, countsByDate) {
  const rows = Array.isArray(entries) ? entries : [];
  const dateCountsDescending = Object.entries(countsByDate || {})
    .map(([date, count]) => ({ date, count: Number(count || 0) }))
    .sort((left, right) => right.count - left.count || left.date.localeCompare(right.date));
  const dateCountsChronological = [...dateCountsDescending].sort((left, right) => left.date.localeCompare(right.date));
  const brandCounts = { Kia: 0, Mazda: 0 };
  const notesByBrand = { Kia: 0, Mazda: 0 };
  const assigneeCounts = {};
  const statusCounts = {};
  const noteAuthorCounts = {};
  const noteTermCounts = {};
  const pendingRows = [];
  let rowsWithNotes = 0;

  for (const entry of rows) {
    const brand = entry.brand === "Mazda" ? "Mazda" : "Kia";
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    const details = trafficOfferIdeaLookup(entry.offer_idea);
    const assignee = String(details.assignee || details.advisor || details["appointment taker"] || "").trim();
    const status = String(details["deal status"] || details.status || details["overall status"] || "").trim();
    const hasNotes = Boolean(String(entry.sales_notes || "").trim());

    if (assignee) assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (hasNotes) {
      rowsWithNotes += 1;
      notesByBrand[brand] = (notesByBrand[brand] || 0) + 1;
      const author = String(entry.sales_note_salesperson_name || "").trim();
      if (author) noteAuthorCounts[author] = (noteAuthorCounts[author] || 0) + 1;
      for (const token of trafficAnalysisTokens(entry.sales_notes)) {
        noteTermCounts[token] = (noteTermCounts[token] || 0) + 1;
      }
    } else {
      pendingRows.push(entry);
    }
  }

  const sortedAssignees = Object.entries(assigneeCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const sortedStatuses = Object.entries(statusCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const sortedAuthors = Object.entries(noteAuthorCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const sortedTerms = Object.entries(noteTermCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const sortedPendingRows = [...pendingRows].sort((left, right) => {
    const leftDate = `${left.traffic_date || ""} ${left.appointment_label || ""}`.trim();
    const rightDate = `${right.traffic_date || ""} ${right.appointment_label || ""}`.trim();
    return leftDate.localeCompare(rightDate) || String(left.customer_name || "").localeCompare(String(right.customer_name || ""));
  });
  const totalRows = rows.length;
  const activeDays = dateCountsChronological.length;
  const noteCoverage = totalRows ? Math.round((rowsWithNotes / totalRows) * 100) : 0;
  const pendingCount = totalRows - rowsWithNotes;
  const busiestDay = dateCountsDescending[0] || null;
  const kiaRows = brandCounts.Kia || 0;
  const mazdaRows = brandCounts.Mazda || 0;
  const totalBrandRows = kiaRows + mazdaRows || 1;

  return {
    totalRows,
    rowsWithNotes,
    pendingCount,
    noteCoverage,
    activeDays,
    avgPerDay: activeDays ? (totalRows / activeDays).toFixed(1) : "0.0",
    busiestDay,
    topDays: dateCountsDescending.slice(0, 5),
    timeline: dateCountsChronological,
    brandCards: [
      {
        brand: "Kia",
        rows: kiaRows,
        noteCoverage: kiaRows ? Math.round(((notesByBrand.Kia || 0) / kiaRows) * 100) : 0,
        share: Math.round((kiaRows / totalBrandRows) * 100),
      },
      {
        brand: "Mazda",
        rows: mazdaRows,
        noteCoverage: mazdaRows ? Math.round(((notesByBrand.Mazda || 0) / mazdaRows) * 100) : 0,
        share: Math.round((mazdaRows / totalBrandRows) * 100),
      },
    ],
    topAssignees: sortedAssignees.slice(0, 5),
    statuses: sortedStatuses.slice(0, 5),
    topAuthors: sortedAuthors.slice(0, 5),
    topTerms: sortedTerms.slice(0, 8),
    pendingRows: sortedPendingRows.slice(0, 6),
  };
}

function answerTrafficAnalysisQuestion(question, analysis, monthKey) {
  const rawQuestion = String(question || "").trim();
  if (!rawQuestion) {
    return "Ask about busiest days, note coverage, Kia vs Mazda traffic, or which appointments still need follow-up.";
  }
  if (!analysis.totalRows) {
    return "There is no service drive traffic loaded for that month yet, so there is nothing to analyze.";
  }

  const normalized = rawQuestion.toLowerCase();
  const monthName = monthLabel(monthKey || currentMonth());
  const busiestLabel = analysis.busiestDay
    ? `${longDateLabel(analysis.busiestDay.date)} with ${analysis.busiestDay.count} rows`
    : "no activity";

  if (normalized.includes("busiest") || normalized.includes("busy") || normalized.includes("peak")) {
    const topDays = analysis.topDays.map((item) => `${longDateLabel(item.date)} (${item.count})`);
    return `${monthName} peaked on ${busiestLabel}. The strongest days were ${formatAnalysisList(topDays.slice(0, 3))}.`;
  }

  if (
    normalized.includes("kia") ||
    normalized.includes("mazda") ||
    normalized.includes("brand") ||
    normalized.includes("split") ||
    normalized.includes("compare") ||
    normalized.includes("versus") ||
    normalized.includes("vs")
  ) {
    const kia = analysis.brandCards.find((item) => item.brand === "Kia");
    const mazda = analysis.brandCards.find((item) => item.brand === "Mazda");
    return `${monthName} traffic is split ${kia.rows} Kia rows (${kia.share}% of total, ${kia.noteCoverage}% with notes) and ${mazda.rows} Mazda rows (${mazda.share}% of total, ${mazda.noteCoverage}% with notes).`;
  }

  if (
    normalized.includes("note") ||
    normalized.includes("follow") ||
    normalized.includes("pending") ||
    normalized.includes("unfinished") ||
    normalized.includes("unworked")
  ) {
    const pendingNames = analysis.pendingRows.map((entry) => {
      const when = [entry.traffic_date, entry.appointment_label].filter(Boolean).join(" ");
      return `${entry.customer_name || "Unnamed"}${when ? ` (${when})` : ""}`;
    });
    return `${analysis.rowsWithNotes} of ${analysis.totalRows} rows have notes saved, so note coverage is ${analysis.noteCoverage}%. ${analysis.pendingCount} row${analysis.pendingCount === 1 ? "" : "s"} still need follow-up notes. The next open items are ${formatAnalysisList(pendingNames.slice(0, 4), "none right now")}.`;
  }

  if (
    normalized.includes("assignee") ||
    normalized.includes("owner") ||
    normalized.includes("assigned") ||
    normalized.includes("who has") ||
    normalized.includes("appointment owner")
  ) {
    const leaders = analysis.topAssignees.map((item) => `${item.label} (${item.count})`);
    return leaders.length
      ? `The heaviest appointment owners in ${monthName} are ${formatAnalysisList(leaders.slice(0, 4))}.`
      : "The imported traffic does not have enough assignee data yet to rank appointment owners.";
  }

  if (normalized.includes("status")) {
    const statuses = analysis.statuses.map((item) => `${item.label} (${item.count})`);
    return statuses.length
      ? `The main imported statuses for ${monthName} are ${formatAnalysisList(statuses.slice(0, 4))}.`
      : "This month does not have enough imported status data to summarize yet.";
  }

  if (normalized.includes("theme") || normalized.includes("trend") || normalized.includes("talking about")) {
    const terms = analysis.topTerms.map((item) => `${item.label} (${item.count})`);
    return terms.length
      ? `The strongest note themes this month are ${formatAnalysisList(terms.slice(0, 6))}.`
      : "There are not enough saved notes yet to surface consistent themes.";
  }

  const strongestOwner = analysis.topAssignees[0]?.label || "the assigned team";
  return `${monthName} currently shows ${analysis.totalRows} traffic rows across ${analysis.activeDays} active day${analysis.activeDays === 1 ? "" : "s"}, with ${analysis.noteCoverage}% note coverage. The busiest day was ${busiestLabel}, and ${strongestOwner} is carrying the largest appointment load right now.`;
}

function TrafficAnalysisHint({ text }) {
  if (!text) return null;
  return (
    <span className="traffic-analysis-hint" tabIndex={0} aria-label={text}>
      <span className="traffic-analysis-hint__icon">i</span>
      <span className="traffic-analysis-hint__bubble">{text}</span>
    </span>
  );
}

function TrafficAnalysisSection({ eyebrow, title, hint, summary, defaultOpen = false, children, className = "" }) {
  return (
    <details className={`panel traffic-analysis-panel traffic-analysis-section ${className}`.trim()} open={defaultOpen}>
      <summary className="traffic-analysis-section__summary">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <div className="traffic-analysis-section__meta">
          {summary ? <small>{summary}</small> : null}
          <TrafficAnalysisHint text={hint} />
          <span className="traffic-analysis-section__toggle">Details</span>
        </div>
      </summary>
      <div className="traffic-analysis-section__body">{children}</div>
    </details>
  );
}

function LogTable({ entries, empty }) {
  if (!entries.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Lead Store</th>
            <th>BDC Agent</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Salesperson</th>
            <th>Sales Store</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{dateTimeLabel(entry.assigned_at)}</td>
              <td>{entry.lead_store || "Unknown"}</td>
              <td>{entry.bdc_agent_name}</td>
              <td>{entry.customer_name || "No name"}</td>
              <td>{entry.customer_phone || "No phone"}</td>
              <td>{entry.salesperson_name}</td>
              <td>{entry.salesperson_dealership}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FreshUpLogList({ entries, empty }) {
  if (!entries.length) return <div className="empty">{empty}</div>;
  return (
    <div className="freshup-log-list">
      {entries.map((entry) => (
        <article key={entry.id} className="freshup-log-item">
          <div className="freshup-log-item__top">
            <div>
              <strong>{entry.customer_name}</strong>
              <small>{entry.customer_phone || "No phone"}</small>
            </div>
            <span>{dateTimeLabel(entry.created_at)}</span>
          </div>
          <div className="freshup-log-item__meta">
            <span>{entry.salesperson_name || "Unassigned"}</span>
            <span>{entry.salesperson_dealership || "No store"}</span>
            <span>{entry.source || "Desk"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function EditorCard({ title, children }) {
  return (
    <div className="editor-card">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

function TrafficOfferGallery({ images, brand }) {
  if (!images?.length) return null;
  return (
    <div className={`traffic-offer-gallery traffic-offer-gallery--${String(brand || "kia").toLowerCase()}`}>
      {images.map((image) => (
        <a
          key={image.id}
          className="traffic-offer-gallery__item"
          href={assetUrl(image.image_url)}
          target="_blank"
          rel="noreferrer"
        >
          <img src={assetUrl(image.image_url)} alt={image.original_filename || "Offer screenshot"} />
        </a>
      ))}
    </div>
  );
}

function TrafficDayPicker({ cells, countsByDate, selectedDate, today, onSelect, serviceDayMap, idPrefix }) {
  return (
    <>
      <div className="calendar-board__weekdays">
        {CALENDAR_WEEKDAYS.map((label) => (
          <span key={`${idPrefix}-${label}`}>{label}</span>
        ))}
      </div>
      <div className="traffic-day-grid">
        {cells.map((value, index) => {
          if (!value) {
            return <div key={`${idPrefix}-blank-${index}`} className="calendar-blank" aria-hidden="true" />;
          }

          const count = countsByDate?.[value] || 0;
          const parts = dateParts(value);
          const team = scheduleDriveTeam(serviceDayMap.get(value));
          const kia = driveTeamMember(team, "Kia");
          const mazda = driveTeamMember(team, "Mazda");

          return (
            <button
              key={`${idPrefix}-${value}`}
              type="button"
              className={`traffic-day-tile ${selectedDate === value ? "is-active" : ""} ${value === today ? "is-today" : ""}`}
              onClick={() => onSelect(value)}
            >
              <div className="traffic-day-tile__top">
                <span>{parts.monthShort}</span>
                {value === today ? <small>Today</small> : null}
              </div>
              <strong>{parts.dayNumber}</strong>
              <b>{count} rows</b>
              <div className="traffic-day-tile__teams">
                <div className="traffic-day-tile__team">
                  <span>Kia</span>
                  <small>{shortPersonName(kia.salesperson_name)}</small>
                </div>
                <div className="traffic-day-tile__team">
                  <span>Mazda</span>
                  <small>{shortPersonName(mazda.salesperson_name)}</small>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function agentLoopStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  if (key === "queued") return "Queued";
  if (key === "running") return "Running";
  if (key === "completed") return "Completed";
  if (key === "blocked") return "Blocked";
  if (key === "failed") return "Failed";
  if (key === "canceled") return "Canceled";
  return status || "Unknown";
}

function agentLoopStatusTone(status) {
  const key = String(status || "").toLowerCase();
  if (key === "completed") return "success";
  if (key === "failed" || key === "blocked" || key === "canceled") return "error";
  return "";
}

export default function App() {
  const [tab, setTab] = useState(() => initialTabValue());
  const [adminSection, setAdminSection] = useState("staff");
  const [freshUpLaunchContext] = useState(() => readFreshUpLaunchContext());
  const [month, setMonth] = useState(currentMonth());
  const [daysOffMonth, setDaysOffMonth] = useState(currentMonth());
  const [trafficMonth, setTrafficMonth] = useState(currentMonth());
  const [selectedTrafficDate, setSelectedTrafficDate] = useState(todayDateValue());
  const [selectedTrafficSalesId, setSelectedTrafficSalesId] = useState(() => readServiceNotesPreferences().salespersonId);
  const [selectedTrafficBrandFilter, setSelectedTrafficBrandFilter] = useState(() => readServiceNotesPreferences().brandFilter);
  const [expandedTrafficEntryId, setExpandedTrafficEntryId] = useState(null);
  const [salespeople, setSalespeople] = useState([]);
  const [bdcAgents, setBdcAgents] = useState([]);
  const [serviceMonth, setServiceMonth] = useState(null);
  const [serviceTrafficData, setServiceTrafficData] = useState({ month: currentMonth(), selected_date: null, total: 0, counts_by_date: {}, entries: [] });
  const [trafficAnalysisData, setTrafficAnalysisData] = useState({ month: currentMonth(), selected_date: null, total: 0, counts_by_date: {}, entries: [] });
  const [trafficAnalysisQuestion, setTrafficAnalysisQuestion] = useState("");
  const [trafficAnalysisMessages, setTrafficAnalysisMessages] = useState([
    {
      role: "assistant",
      text: "Ask about busiest days, follow-up gaps, Kia vs Mazda mix, or who owns the most appointments.",
    },
  ]);
  const [trafficAnalysisLoading, setTrafficAnalysisLoading] = useState(false);
  const [trafficPdfs, setTrafficPdfs] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [selectedSpecialId, setSelectedSpecialId] = useState(null);
  const [bdcState, setBdcState] = useState(null);
  const [bdcDistribution, setBdcDistribution] = useState({ mode: "franchise" });
  const [bdcUndoSettings, setBdcUndoSettings] = useState({ require_password: true, password_hint: "" });
  const [tabVisibility, setTabVisibility] = useState({
    entries: TABS.filter((item) => item.id !== "admin").map((item) => ({ tab_id: item.id, visible: true })),
  });
  const [bdcUndoPassword, setBdcUndoPassword] = useState("");
  const [bdcLog, setBdcLog] = useState({ total: 0, entries: [] });
  const [bdcReport, setBdcReport] = useState(null);
  const [daysOffData, setDaysOffData] = useState({ month: currentMonth(), entries: [] });
  const [selectedDaysOffSalesId, setSelectedDaysOffSalesId] = useState("");
  const [filters, setFilters] = useState({ salespersonId: "", leadStore: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastAssignment, setLastAssignment] = useState(null);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("dealer_tool_admin") || "");
  const [adminSession, setAdminSession] = useState(null);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [agentLoopConfig, setAgentLoopConfig] = useState({
    provider: "OpenAI",
    configured: false,
    model: "gpt-5.4-mini",
    reasoning_effort: "low",
    max_steps: 6,
    presets: [],
  });
  const [agentLoopRuns, setAgentLoopRuns] = useState({ total: 0, entries: [] });
  const [selectedAgentRunId, setSelectedAgentRunId] = useState(null);
  const [selectedAgentRun, setSelectedAgentRun] = useState(null);
  const [agentLoopForm, setAgentLoopForm] = useState({ presetKey: "executive_daily_brief", objective: "" });
  const [agentLoopFeedback, setAgentLoopFeedback] = useState(null);
  const [salesForm, setSalesForm] = useState(() => emptySalesForm());
  const [bdcForm, setBdcForm] = useState({ name: "", active: true });
  const [notificationConfig, setNotificationConfig] = useState({
    sms_provider: "Twilio",
    sms_configured: false,
    email_provider: "Resend",
    email_configured: false,
  });
  const [smsTestPhone, setSmsTestPhone] = useState("");
  const [smsTestFeedback, setSmsTestFeedback] = useState(null);
  const [emailTestAddress, setEmailTestAddress] = useState("");
  const [emailTestFeedback, setEmailTestFeedback] = useState(null);
  const [leadForm, setLeadForm] = useState({ bdcAgentId: "", leadStore: "Kia", customerName: "", customerPhone: "" });
  const [trafficEntryForm, setTrafficEntryForm] = useState({
    brand: "Kia",
    customerName: "",
    customerPhone: "",
    vehicleYear: "",
    modelMake: "",
    offerIdea: "",
  });
  const [trafficEntryFiles, setTrafficEntryFiles] = useState([]);
  const [trafficEntryFileKey, setTrafficEntryFileKey] = useState(0);
  const [reynoldsImportFile, setReynoldsImportFile] = useState(null);
  const [reynoldsImportFileKey, setReynoldsImportFileKey] = useState(0);
  const [reynoldsImportResult, setReynoldsImportResult] = useState(null);
  const [reynoldsUndoResult, setReynoldsUndoResult] = useState(null);
  const [mastermindImportFile, setMastermindImportFile] = useState(null);
  const [mastermindImportFileKey, setMastermindImportFileKey] = useState(0);
  const [mastermindImportResult, setMastermindImportResult] = useState(null);
  const [mastermindUndoResult, setMastermindUndoResult] = useState(null);
  const [trafficDayClearResult, setTrafficDayClearResult] = useState(null);
  const [resourceLoadState, setResourceLoadState] = useState({
    trafficPdfs: false,
    specials: false,
    quoteRates: false,
    marketplaceTemplate: false,
    freshUpLinks: false,
    freshUpAnalytics: false,
    agentLoops: false,
  });
  const [quoteRates, setQuoteRates] = useState([]);
  const [quoteRateDraft, setQuoteRateDraft] = useState({});
  const [marketplaceBuilder, setMarketplaceBuilder] = useState(MARKETPLACE_BUILDER_DEFAULTS);
  const [quoteForm, setQuoteForm] = useState({
    brand: "Kia New",
    msrp: "",
    creditScore: "",
    tradeEquity: "",
    downPayment: "",
    taxRate: "8.25",
    fees: "0",
    vapIncluded: false,
    vapAmount: "0",
    months: "72",
  });
  const [freshUpForm, setFreshUpForm] = useState(() => {
    const context = readFreshUpLaunchContext();
    return {
      ...readFreshUpDraft(),
      salespersonId: context.salespersonId || readFreshUpDraft().salespersonId || "",
      source: context.cardMode ? "NFC Card" : readFreshUpDraft().source || "Desk",
    };
  });
  const [freshUpLog, setFreshUpLog] = useState({ total: 0, entries: [] });
  const [freshUpStatus, setFreshUpStatus] = useState("");
  const freshUpCopiedAt = "";
  const [freshUpLinksConfig, setFreshUpLinksConfig] = useState(FRESHUP_LINKS_DEFAULTS);
  const [freshUpAnalytics, setFreshUpAnalytics] = useState(FRESHUP_ANALYTICS_DEFAULTS);
  const freshUpPageViewRef = useRef("");
  const [marketplaceGuideStatus, setMarketplaceGuideStatus] = useState("");
  const [trafficRowUploadFiles, setTrafficRowUploadFiles] = useState({});
  const [trafficRowUploadKeys, setTrafficRowUploadKeys] = useState({});
  const [trafficPdfForm, setTrafficPdfForm] = useState({ title: "", file: null });
  const [specialForm, setSpecialForm] = useState({ editingId: null, title: "", tag: "", file: null });
  const [trafficUploadKey, setTrafficUploadKey] = useState(0);
  const [specialUploadKey, setSpecialUploadKey] = useState(0);

  const activeSales = salespeople.filter((person) => person.active);
  const isBdcGlobal = bdcDistribution.mode === "global";
  const isBdcUniversal = bdcDistribution.mode === "universal";
  const leadPoolSales = isBdcGlobal
    ? activeSales
    : isBdcUniversal
      ? activeSales.filter((person) => (leadForm.leadStore === "Outlet" ? person.dealership === "Outlet" : person.dealership !== "Outlet"))
      : activeSales.filter((person) => person.dealership === leadForm.leadStore);
  const serviceEligible = activeSales.filter((person) => person.dealership !== "Outlet");
  const activeBdc = bdcAgents.filter((agent) => agent.active);
  const today = todayDateValue();
  const bdcClosedToday = isSundayDate(today);
  const serviceCalendarCells = buildCalendarCells(serviceMonth?.days || []);
  const serviceCalendarPrintCells = buildPrintCalendarCells(serviceMonth?.days || []);
  const daysOffMonthCells = buildMonthDateCells(daysOffMonth);
  const dealershipColumns = DEALERSHIP_ORDER.map((dealership) => ({
    dealership,
    people: salespeople.filter((person) => person.dealership === dealership),
  }));
  const daysOffSalespeople = [...salespeople].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.dealership.localeCompare(right.dealership, undefined, { sensitivity: "base" }) ||
    left.id - right.id
  );
  const daysOffEntriesBySalesperson = new Map(daysOffData.entries.map((entry) => [entry.salesperson_id, entry.off_dates]));
  const selectedDaysOffSalesperson =
    daysOffSalespeople.find((person) => String(person.id) === String(selectedDaysOffSalesId)) || daysOffSalespeople[0] || null;
  const selectedDaysOffDates = selectedDaysOffSalesperson
    ? daysOffEntriesBySalesperson.get(selectedDaysOffSalesperson.id) || []
    : [];
  const selectedSpecial = specials.find((item) => item.id === selectedSpecialId) || specials[0] || null;
  const selectedTrafficSalesperson =
    activeSales.find((person) => String(person.id) === String(selectedTrafficSalesId)) || null;
  const selectedTrafficSalesStore =
    selectedTrafficSalesperson && TRAFFIC_BRANDS.includes(selectedTrafficSalesperson.dealership)
      ? selectedTrafficSalesperson.dealership
      : null;
  const trafficMonthCells = buildMonthDateCells(trafficMonth);
  const selectedTrafficCount = serviceTrafficData.counts_by_date?.[selectedTrafficDate] || 0;
  const trafficMonthTotal = Object.values(serviceTrafficData.counts_by_date || {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0
  );
  const serviceDayMap = new Map((serviceMonth?.days || []).map((day) => [day.date, day]));
  const focusTrafficDate = selectedTrafficDate;
  const focusTrafficIsToday = focusTrafficDate === today;
  const focusTrafficCount = serviceTrafficData.counts_by_date?.[focusTrafficDate] || 0;
  const focusTrafficTeam = scheduleDriveTeam(serviceDayMap.get(focusTrafficDate));
  const focusTrafficKia = driveTeamMember(focusTrafficTeam, "Kia");
  const focusTrafficMazda = driveTeamMember(focusTrafficTeam, "Mazda");
  const selectedTrafficHasAuthor = Boolean(selectedTrafficSalesId);
  const visibleTrafficEntries = sortTrafficEntries(
    selectedTrafficBrandFilter === "All"
      ? serviceTrafficData.entries
      : serviceTrafficData.entries.filter((entry) => entry.brand === selectedTrafficBrandFilter)
  );
  const visibleTrafficCount = visibleTrafficEntries.length;
  const serviceNotesSavedCount = visibleTrafficEntries.filter((entry) => String(entry.sales_notes || "").trim()).length;
  const serviceNotesPendingCount = Math.max(0, visibleTrafficCount - serviceNotesSavedCount);
  const trafficAnalysis = buildTrafficAnalysis(trafficAnalysisData.entries, trafficAnalysisData.counts_by_date);
  const trafficAnalysisMaxDayCount = Math.max(...trafficAnalysis.timeline.map((item) => item.count), 1);
  const trafficAnalysisInsights = trafficAnalysis.totalRows
    ? [
        `The board holds ${trafficAnalysis.totalRows} traffic rows for ${monthLabel(trafficAnalysisData.month || trafficMonth)}.`,
        trafficAnalysis.busiestDay
          ? `${longDateLabel(trafficAnalysis.busiestDay.date)} is the busiest day right now with ${trafficAnalysis.busiestDay.count} rows.`
          : "No busiest day yet because there is no traffic in the selected month.",
        `${trafficAnalysis.noteCoverage}% of the month already has saved salesperson notes, leaving ${trafficAnalysis.pendingCount} rows still open for follow-up.`,
      ]
    : [];
  const selectedTrafficFilterLabel =
    selectedTrafficBrandFilter === "All" ? "All Franchises" : `${selectedTrafficBrandFilter} Only`;
  const selectedTrafficScheduleDay = serviceDayMap.get(selectedTrafficDate) || null;
  const selectedTrafficTeam = serviceTrafficData.entries[0]?.drive_team?.length
    ? serviceTrafficData.entries[0].drive_team
    : scheduleDriveTeam(selectedTrafficScheduleDay);
  const selectedTrafficKia = driveTeamMember(selectedTrafficTeam, "Kia");
  const selectedTrafficMazda = driveTeamMember(selectedTrafficTeam, "Mazda");
  const monthDaysOffSummary = monthDateValues(daysOffMonth).map((value) => ({
    date: value,
    people: activeSales.filter((person) => (daysOffEntriesBySalesperson.get(person.id) || []).includes(value)),
  }));
  const quoteRateMap = quoteRates.reduce((acc, rate) => {
    if (!acc[rate.brand]) acc[rate.brand] = {};
    acc[rate.brand][rate.tier] = Number(rate.apr || 0);
    return acc;
  }, {});
  const selectedQuoteTier = creditTierFromScore(quoteForm.creditScore);
  const selectedQuoteApr = selectedQuoteTier ? quoteRateMap?.[quoteForm.brand]?.[selectedQuoteTier] ?? 0 : 0;
  const quoteMsrp = numericValue(quoteForm.msrp);
  const quoteTrade = numericValue(quoteForm.tradeEquity);
  const quoteDown = numericValue(quoteForm.downPayment);
  const quoteTaxRate = Math.max(0, numericValue(quoteForm.taxRate));
  const quoteFees = Math.max(0, numericValue(quoteForm.fees));
  const quoteVap = quoteForm.vapIncluded ? Math.max(0, numericValue(quoteForm.vapAmount)) : 0;
  const quoteMonths = Math.max(0, Math.round(numericValue(quoteForm.months)));
  const quoteTaxableBase = Math.max(0, quoteMsrp - quoteTrade);
  const quoteTax = quoteTaxableBase * (quoteTaxRate / 100);
  const quotePrincipal = Math.max(0, quoteMsrp + quoteFees + quoteVap + quoteTax - quoteTrade - quoteDown);
  const quoteMonthlyRate = selectedQuoteApr ? selectedQuoteApr / 100 / 12 : 0;
  const quotePayment =
    quoteMonths > 0
      ? quoteMonthlyRate > 0
        ? (quotePrincipal * quoteMonthlyRate) / (1 - Math.pow(1 + quoteMonthlyRate, -quoteMonths))
        : quotePrincipal / quoteMonths
      : 0;
  const quoteTotalPaid = quotePayment * quoteMonths;
  const quoteTotalInterest = Math.max(0, quoteTotalPaid - quotePrincipal);
  const freshUpAssignedSalesperson =
    salespeople.find((person) => String(person.id) === String(freshUpForm.salespersonId)) ||
    findSalespersonMatch(activeSales, freshUpForm.salespersonQuery) ||
    null;
  const freshUpSummary = freshUpSummaryText(freshUpForm, freshUpAssignedSalesperson?.name || "");
  const freshUpFilledCount = [
    freshUpForm.customerName,
    freshUpForm.phone,
    freshUpAssignedSalesperson?.id || freshUpForm.salespersonId,
  ].filter((value) => String(value || "").trim()).length;
  const freshUpCardMode = freshUpLaunchContext.cardMode;
  const freshUpCardHref = freshUpAssignedSalesperson ? freshUpCardUrl(freshUpAssignedSalesperson.id) : "";
  const freshUpStoreCards = [...(freshUpLinksConfig.stores || [])].sort((left, right) => {
    const leftPriority = left.dealership === freshUpAssignedSalesperson?.dealership ? 0 : 1;
    const rightPriority = right.dealership === freshUpAssignedSalesperson?.dealership ? 0 : 1;
    return leftPriority - rightPriority || String(left.display_name || "").localeCompare(String(right.display_name || ""));
  });
  const freshUpPrimaryStore = freshUpStoreCards[0] || null;
  const freshUpPrimaryBrand = freshUpStoreBrandMeta(freshUpPrimaryStore?.dealership);
  const freshUpConversionRate = freshUpAnalytics.page_views
    ? Math.round((freshUpAnalytics.submissions / freshUpAnalytics.page_views) * 100)
    : 0;
  const marketplaceBuilderTemplate = buildMarketplaceTemplateFromBuilder(marketplaceBuilder);
  const marketplacePreviewData = {
    ...MARKETPLACE_PREVIEW_SAMPLE,
    price_label: marketplaceBuilderTemplate.price_label || MARKETPLACE_TEMPLATE_DEFAULTS.price_label,
    cta_text: marketplaceBuilderTemplate.cta_text || MARKETPLACE_TEMPLATE_DEFAULTS.cta_text,
  };
  const marketplacePreviewTitle = fillMarketplaceTemplate(marketplaceBuilderTemplate.title_template, marketplacePreviewData);
  const marketplacePreviewDescription = fillMarketplaceTemplate(
    marketplaceBuilderTemplate.description_template,
    marketplacePreviewData
  );
  const visibleTabIds = new Set(
    (tabVisibility.entries || []).filter((entry) => entry.visible).map((entry) => entry.tab_id)
  );
  const defaultVisibleTabId =
    (visibleTabIds.has("serviceNotes") && "serviceNotes") ||
    TABS.find((item) => item.id !== "admin" && visibleTabIds.has(item.id))?.id ||
    "serviceNotes";
  const tabsToShow = TABS.filter((item) => item.id === "admin" || adminSession || visibleTabIds.has(item.id));
  const latestBdcAssignment = lastAssignment || bdcLog.entries?.[0] || null;
  const latestBdcNotifications = [
    latestBdcAssignment?.notification_sms_status,
    latestBdcAssignment?.notification_email_status,
  ].filter(Boolean);
  const agentLoopPresets = agentLoopConfig.presets || [];
  const selectedAgentLoopPreset =
    agentLoopPresets.find((item) => item.key === agentLoopForm.presetKey) || agentLoopPresets[0] || null;
  const selectedAgentLoopIsActive = ["queued", "running"].includes(String(selectedAgentRun?.status || "").toLowerCase());

  async function loadAll(nextMonth = month, nextFilters = filters) {
    const [sales, bdc, service, log, report, distribution, undoSettings, tabs] = await Promise.all([
      adminSession && adminToken
        ? getAdminSalespeople(adminToken, { includeInactive: true })
        : getSalespeople({ includeInactive: true }),
      getBdcAgents({ includeInactive: true }),
      getServiceDrive({ month: nextMonth }),
      getBdcLog({
        salespersonId: nextFilters.salespersonId || undefined,
        leadStore: nextFilters.leadStore || undefined,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
        limit: 150,
      }),
      getBdcReport({
        salespersonId: nextFilters.salespersonId || undefined,
        leadStore: nextFilters.leadStore || undefined,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
      }),
      getBdcDistribution(),
      getBdcUndoSettings(),
      getTabVisibility(),
    ]);
    setSalespeople(sales);
    setBdcAgents(bdc);
    setServiceMonth(service);
    setBdcLog(log);
    setBdcReport(report);
    setBdcDistribution(distribution);
    setBdcUndoSettings(undoSettings);
    setTabVisibility(tabs);
  }

  async function refreshBdcState(nextLeadStore = leadForm.leadStore) {
    const data = await getBdcState({ dealership: nextLeadStore });
    setBdcState(data);
  }

  async function saveBdcDistribution(mode) {
    setBusy("bdc-distribution");
    setError("");
    try {
      const updated = await updateBdcDistribution(adminToken, { mode });
      setBdcDistribution(updated);
      await refreshBdcState(leadForm.leadStore);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcUndoSettings() {
    setBusy("bdc-undo-settings");
    setError("");
    try {
      const updated = await updateBdcUndoSettings(adminToken, {
        require_password: bdcUndoSettings.require_password,
        password: bdcUndoPassword || "bdc",
      });
      setBdcUndoSettings(updated);
      setBdcUndoPassword("");
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function refreshServiceTraffic(nextMonth = trafficMonth, nextDate = selectedTrafficDate) {
    const data = await getServiceDriveTraffic({
      month: nextMonth,
      trafficDate: nextDate,
    });
    setServiceTrafficData(data);
  }

  async function refreshTrafficPdfs() {
    const data = await getTrafficPdfs();
    setTrafficPdfs(data.entries || []);
    setResourceLoadState((current) => ({ ...current, trafficPdfs: true }));
  }

  async function refreshSpecials() {
    const data = await getSpecials();
    setSpecials(data.entries || []);
    setResourceLoadState((current) => ({ ...current, specials: true }));
  }

  async function refreshQuoteRates() {
    const data = await getQuoteRates();
    const entries = data.entries || [];
    setQuoteRates(entries);
    const draft = {};
    for (const brand of QUOTE_BRANDS) {
      draft[brand] = {};
      for (const tier of CREDIT_TIERS) {
        draft[brand][tier.label] = "";
      }
    }
    for (const entry of entries) {
      if (!draft[entry.brand]) draft[entry.brand] = {};
      draft[entry.brand][entry.tier] = String(entry.apr ?? "");
    }
    setQuoteRateDraft(draft);
    setResourceLoadState((current) => ({ ...current, quoteRates: true }));
  }

  async function refreshMarketplaceTemplate() {
    const data = await getMarketplaceTemplate();
    setMarketplaceBuilder(marketplaceBuilderFromTemplate(data));
    setResourceLoadState((current) => ({ ...current, marketplaceTemplate: true }));
  }

  async function refreshFreshUpLog(nextSalespersonId) {
    const data = await getFreshUpLog({
      salespersonId: nextSalespersonId || undefined,
      limit: 60,
    });
    setFreshUpLog(data);
  }

  async function refreshFreshUpLinks() {
    const data = await getFreshUpLinks();
    setFreshUpLinksConfig(data);
    setResourceLoadState((current) => ({ ...current, freshUpLinks: true }));
  }

  async function refreshFreshUpAnalytics() {
    const data = await getFreshUpAnalytics(adminToken, { days: 30 });
    setFreshUpAnalytics(data);
    setResourceLoadState((current) => ({ ...current, freshUpAnalytics: true }));
  }

  async function refreshNotificationConfig() {
    if (!adminToken) {
      setNotificationConfig({
        sms_provider: "Twilio",
        sms_configured: false,
        email_provider: "Resend",
        email_configured: false,
      });
      return;
    }
    const data = await getNotificationConfig(adminToken);
    setNotificationConfig(data);
  }

  function applyTrafficSalespersonSelection(nextValue) {
    setSelectedTrafficSalesId(nextValue);
    if (!nextValue) return;
    const matched = serviceEligible.find((person) => String(person.id) === String(nextValue));
    if (matched && TRAFFIC_BRANDS.includes(matched.dealership)) {
      setSelectedTrafficBrandFilter(matched.dealership);
    }
  }

  async function refreshAgentLoopConfig() {
    const data = await getAgentLoopConfig(adminToken);
    setAgentLoopConfig(data);
    setResourceLoadState((current) => ({ ...current, agentLoops: true }));
    setAgentLoopForm((current) => {
      const presets = data.presets || [];
      const fallbackPreset = presets[0]?.key || current.presetKey || "executive_daily_brief";
      const resolvedPreset = presets.find((item) => item.key === current.presetKey) || presets[0] || null;
      return {
        presetKey: resolvedPreset?.key || fallbackPreset,
        objective: current.objective || resolvedPreset?.starter_objective || "",
      };
    });
  }

  async function refreshAgentLoopRuns({ preserveSelection = true } = {}) {
    const data = await getAgentLoopRuns(adminToken, { limit: 18 });
    const entries = data.entries || [];
    setAgentLoopRuns(data);
    setSelectedAgentRunId((current) => {
      if (preserveSelection && current && entries.some((item) => item.id === current)) return current;
      return entries[0]?.id ?? null;
    });
    if (!entries.length) {
      setSelectedAgentRun(null);
    }
  }

  async function refreshSelectedAgentLoop(runId = selectedAgentRunId) {
    if (!runId) {
      setSelectedAgentRun(null);
      return;
    }
    const detail = await getAgentLoopRun(adminToken, runId);
    setSelectedAgentRun(detail);
    setSelectedAgentRunId(detail.id);
  }

  function applyAgentLoopPreset(nextKey) {
    const preset =
      agentLoopPresets.find((item) => item.key === nextKey) ||
      agentLoopConfig.presets?.find((item) => item.key === nextKey) ||
      null;
    setAgentLoopForm({
      presetKey: nextKey,
      objective: preset?.starter_objective || "",
    });
  }

  async function submitAgentLoop(event) {
    event.preventDefault();
    setBusy("agent-loop-run");
    setAgentLoopFeedback(null);
    setError("");
    try {
      const created = await createAgentLoopRun(adminToken, {
        preset_key: agentLoopForm.presetKey,
        objective: agentLoopForm.objective,
      });
      setSelectedAgentRun(created);
      setSelectedAgentRunId(created.id);
      setAgentLoopFeedback({
        kind: "success",
        message: `${created.preset_label} started. The loop will keep updating below while it runs.`,
      });
      await refreshAgentLoopRuns({ preserveSelection: true });
    } catch (errorValue) {
      setAgentLoopFeedback({ kind: "error", message: errText(errorValue) });
    } finally {
      setBusy("");
    }
  }

  async function cancelCurrentAgentLoop() {
    if (!selectedAgentRunId) return;
    setBusy("agent-loop-cancel");
    setAgentLoopFeedback(null);
    setError("");
    try {
      const canceled = await cancelAgentLoopRun(adminToken, selectedAgentRunId);
      setSelectedAgentRun(canceled);
      setAgentLoopFeedback({ kind: "success", message: "The loop was canceled." });
      await refreshAgentLoopRuns({ preserveSelection: true });
    } catch (errorValue) {
      setAgentLoopFeedback({ kind: "error", message: errText(errorValue) });
    } finally {
      setBusy("");
    }
  }

  async function submitSmsTest(event) {
    event.preventDefault();
    setBusy("notification-sms-test");
    setSmsTestFeedback(null);
    try {
      const result = await sendNotificationTestSms(adminToken, { phone_number: smsTestPhone });
      setSmsTestPhone(result.phone_number);
      setSmsTestFeedback({ kind: "success", message: result.status });
    } catch (errorValue) {
      setSmsTestFeedback({ kind: "error", message: errText(errorValue) });
    } finally {
      setBusy("");
    }
  }

  async function submitEmailTest(event) {
    event.preventDefault();
    setBusy("notification-email-test");
    setEmailTestFeedback(null);
    try {
      const result = await sendNotificationTestEmail(adminToken, { email: emailTestAddress });
      setEmailTestAddress(result.email);
      setEmailTestFeedback({ kind: "success", message: result.status });
    } catch (errorValue) {
      setEmailTestFeedback({ kind: "error", message: errText(errorValue) });
    } finally {
      setBusy("");
    }
  }

  function trackFreshUpEvent({ eventType, linkType = "", targetUrl = "", storeDealership = "" }) {
    if (!freshUpCardMode) return;
    const salespersonId =
      freshUpAssignedSalesperson?.id || (freshUpLaunchContext.salespersonId ? Number(freshUpLaunchContext.salespersonId) : undefined);
    createFreshUpAnalytics({
      salesperson_id: salespersonId,
      store_dealership: storeDealership,
      event_type: eventType,
      link_type: linkType,
      target_url: targetUrl,
    }).catch(() => {});
  }

  function updateQuoteRateDraft(brand, tier, value) {
    setQuoteRateDraft((prev) => ({
      ...prev,
      [brand]: {
        ...(prev[brand] || {}),
        [tier]: value,
      },
    }));
  }

  async function saveQuoteRates() {
    setBusy("quote-rates");
    setError("");
    try {
      const rates = [];
      for (const brand of QUOTE_BRANDS) {
        for (const tier of CREDIT_TIERS) {
          const raw = quoteRateDraft?.[brand]?.[tier.label];
          const aprValue = Number.parseFloat(String(raw ?? "").trim());
          rates.push({ brand, tier: tier.label, apr: Number.isFinite(aprValue) ? aprValue : 0 });
        }
      }
      await updateQuoteRates(adminToken, { rates });
      await refreshQuoteRates();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveMarketplaceTemplate() {
    setBusy("marketplace-template");
    setError("");
    try {
      const payload = buildMarketplaceTemplateFromBuilder(marketplaceBuilder);
      const updated = await updateMarketplaceTemplate(adminToken, payload);
      setMarketplaceBuilder(marketplaceBuilderFromTemplate(updated));
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function resetMarketplaceTemplateDraft() {
    setMarketplaceBuilder(MARKETPLACE_BUILDER_DEFAULTS);
  }

  function setTabVisibilityValue(tabId, visible) {
    setTabVisibility((current) => ({
      entries: (current.entries || []).map((entry) => (entry.tab_id === tabId ? { ...entry, visible } : entry)),
    }));
  }

  async function saveTabVisibilitySettings() {
    setBusy("tab-visibility");
    setError("");
    try {
      const updated = await updateTabVisibility(adminToken, tabVisibility);
      setTabVisibility(updated);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        await loadAll(month, filters);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [month, filters.salespersonId, filters.leadStore, filters.startDate, filters.endDate]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await getBdcState({ dealership: leadForm.leadStore });
        if (active) setBdcState(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [leadForm.leadStore]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await getServiceDriveTraffic({
          month: trafficMonth,
          trafficDate: selectedTrafficDate,
        });
        if (active) setServiceTrafficData(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [trafficMonth, selectedTrafficDate]);

  useEffect(() => {
    if (tab !== "trafficAnalysis") return;
    let active = true;
    const run = async () => {
      setTrafficAnalysisLoading(true);
      try {
        const data = await getServiceDriveTraffic({ month: trafficMonth });
        if (!active) return;
        setTrafficAnalysisData(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      } finally {
        if (active) setTrafficAnalysisLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [tab, trafficMonth]);

  useEffect(() => {
    setTrafficAnalysisMessages([
      {
        role: "assistant",
        text: `Loaded ${monthLabel(trafficAnalysisData.month || trafficMonth)}. Ask about busiest days, follow-up gaps, Kia vs Mazda split, or appointment ownership.`,
      },
    ]);
    setTrafficAnalysisQuestion("");
  }, [trafficAnalysisData.month, trafficMonth]);

  useEffect(() => {
    if (resourceLoadState.quoteRates) return;
    if (!(tab === "quote" || (tab === "admin" && adminSection === "quoteRates"))) return;
    let active = true;
    const run = async () => {
      try {
        const data = await getQuoteRates();
        if (!active) return;
        const entries = data.entries || [];
        setQuoteRates(entries);
        const draft = {};
        for (const brand of QUOTE_BRANDS) {
          draft[brand] = {};
          for (const tier of CREDIT_TIERS) {
            draft[brand][tier.label] = "";
          }
        }
        for (const entry of entries) {
          if (!draft[entry.brand]) draft[entry.brand] = {};
          draft[entry.brand][entry.tier] = String(entry.apr ?? "");
        }
        setQuoteRateDraft(draft);
        setResourceLoadState((current) => ({ ...current, quoteRates: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, resourceLoadState.quoteRates, tab]);

  useEffect(() => {
    if (resourceLoadState.marketplaceTemplate) return;
    if (!(tab === "marketplace" || (tab === "admin" && adminSection === "marketplace"))) return;
    let active = true;
    const run = async () => {
      try {
        const data = await getMarketplaceTemplate();
        if (!active) return;
        setMarketplaceBuilder(marketplaceBuilderFromTemplate(data));
        setResourceLoadState((current) => ({ ...current, marketplaceTemplate: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, resourceLoadState.marketplaceTemplate, tab]);

  useEffect(() => {
    if (resourceLoadState.freshUpLinks) return;
    if (!(tab === "freshUp" || (tab === "admin" && adminSection === "freshupLinks") || freshUpCardMode)) return;
    let active = true;
    const run = async () => {
      try {
        const data = await getFreshUpLinks();
        if (!active) return;
        setFreshUpLinksConfig(data);
        setResourceLoadState((current) => ({ ...current, freshUpLinks: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, freshUpCardMode, resourceLoadState.freshUpLinks, tab]);

  useEffect(() => {
    if (resourceLoadState.freshUpAnalytics) return;
    if (!(tab === "admin" && adminSection === "freshupLinks" && adminSession)) return;
    let active = true;
    const run = async () => {
      try {
        const data = await getFreshUpAnalytics(adminToken, { days: 30 });
        if (!active) return;
        setFreshUpAnalytics(data);
        setResourceLoadState((current) => ({ ...current, freshUpAnalytics: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, adminSession, adminToken, resourceLoadState.freshUpAnalytics, tab]);

  useEffect(() => {
    if (resourceLoadState.agentLoops) return;
    if (!(tab === "admin" && adminSection === "agentLoops" && adminSession)) return;
    let active = true;
    const run = async () => {
      try {
        const [configData, runsData] = await Promise.all([
          getAgentLoopConfig(adminToken),
          getAgentLoopRuns(adminToken, { limit: 18 }),
        ]);
        if (!active) return;
        setAgentLoopConfig(configData);
        setAgentLoopRuns(runsData);
        setResourceLoadState((current) => ({ ...current, agentLoops: true }));
        const presets = configData.presets || [];
        setAgentLoopForm((current) => {
          const resolvedPreset = presets.find((item) => item.key === current.presetKey) || presets[0] || null;
          return {
            presetKey: resolvedPreset?.key || current.presetKey || "executive_daily_brief",
            objective: current.objective || resolvedPreset?.starter_objective || "",
          };
        });
        setSelectedAgentRunId((current) => current || runsData.entries?.[0]?.id || null);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, adminSession, adminToken, resourceLoadState.agentLoops, tab]);

  useEffect(() => {
    if (!(tab === "admin" && adminSection === "agentLoops" && adminSession && selectedAgentRunId)) return;
    let active = true;
    const run = async () => {
      try {
        const detail = await getAgentLoopRun(adminToken, selectedAgentRunId);
        if (active) setSelectedAgentRun(detail);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, adminSession, adminToken, selectedAgentRunId, tab]);

  useEffect(() => {
    if (!(tab === "admin" && adminSection === "agentLoops" && adminSession && selectedAgentRunId && selectedAgentLoopIsActive)) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshAgentLoopRuns({ preserveSelection: true }).catch(() => {});
      refreshSelectedAgentLoop(selectedAgentRunId).catch(() => {});
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [adminSection, adminSession, selectedAgentLoopIsActive, selectedAgentRunId, tab]);

  useEffect(() => {
    if (!freshUpCardMode) return;
    const salespersonId = freshUpAssignedSalesperson?.id || freshUpLaunchContext.salespersonId || "";
    const storeKey = freshUpPrimaryStore?.dealership || "";
    if (!salespersonId || !storeKey) return;
    const key = `${salespersonId}:${storeKey}`;
    if (freshUpPageViewRef.current === key) return;
    freshUpPageViewRef.current = key;
    trackFreshUpEvent({
      eventType: "page_view",
      storeDealership: storeKey,
    });
  }, [
    freshUpAssignedSalesperson?.id,
    freshUpCardMode,
    freshUpLaunchContext.salespersonId,
    freshUpPrimaryStore?.dealership,
  ]);

  useEffect(() => {
    if (resourceLoadState.trafficPdfs) return;
    if (tab !== "traffic") return;
    let active = true;
    const run = async () => {
      try {
        const data = await getTrafficPdfs();
        if (!active) return;
        setTrafficPdfs(data.entries || []);
        setResourceLoadState((current) => ({ ...current, trafficPdfs: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [resourceLoadState.trafficPdfs, tab]);

  useEffect(() => {
    if (resourceLoadState.specials) return;
    if (!(tab === "specials" || (tab === "admin" && adminSection === "specials"))) return;
    let active = true;
    const run = async () => {
      try {
        const data = await getSpecials();
        if (!active) return;
        setSpecials(data.entries || []);
        setResourceLoadState((current) => ({ ...current, specials: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSection, resourceLoadState.specials, tab]);

  useEffect(() => {
    if (!adminSession && !freshUpCardMode && tab !== "admin" && !visibleTabIds.has(tab)) {
      setTab(defaultVisibleTabId);
    }
  }, [adminSession, defaultVisibleTabId, freshUpCardMode, tab, visibleTabIds]);

  useEffect(() => {
    if (!selectedSpecialId && specials.length) {
      setSelectedSpecialId(specials[0].id);
      return;
    }
    if (selectedSpecialId && !specials.some((item) => item.id === selectedSpecialId)) {
      setSelectedSpecialId(specials.length ? specials[0].id : null);
    }
  }, [selectedSpecialId, specials]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FRESH_UP_STORAGE_KEY, JSON.stringify(freshUpForm));
  }, [freshUpForm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SERVICE_NOTES_PREFERENCES_KEY,
      JSON.stringify({
        salespersonId: selectedTrafficSalesId,
        brandFilter: selectedTrafficBrandFilter,
      })
    );
  }, [selectedTrafficBrandFilter, selectedTrafficSalesId]);

  useEffect(() => {
    if (!selectedTrafficSalesId) return;
    if (!serviceEligible.some((person) => String(person.id) === String(selectedTrafficSalesId))) {
      setSelectedTrafficSalesId("");
    }
  }, [selectedTrafficSalesId, serviceEligible]);

  useEffect(() => {
    if (!freshUpLaunchContext.salespersonId || !salespeople.length) return;
    const matched = salespeople.find((person) => String(person.id) === String(freshUpLaunchContext.salespersonId));
    if (!matched) return;
    setFreshUpForm((current) => ({
      ...current,
      salespersonId: current.salespersonId || String(matched.id),
      salespersonQuery: current.salespersonQuery || matched.name,
      source: freshUpLaunchContext.cardMode ? "NFC Card" : current.source || "Desk",
    }));
  }, [freshUpLaunchContext.cardMode, freshUpLaunchContext.salespersonId, salespeople]);

  useEffect(() => {
    if (freshUpCardMode || tab !== "freshUp") return;
    let active = true;
    const run = async () => {
      try {
        const data = await getFreshUpLog({
          salespersonId: undefined,
          limit: 60,
        });
        if (active) setFreshUpLog(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [freshUpCardMode, tab]);

  useEffect(() => {
    if (!leadForm.bdcAgentId && activeBdc.length) {
      setLeadForm((current) => ({ ...current, bdcAgentId: String(activeBdc[0].id) }));
    }
  }, [leadForm.bdcAgentId, activeBdc]);

  useEffect(() => {
    if (!selectedDaysOffSalesId && daysOffSalespeople.length) {
      setSelectedDaysOffSalesId(String(daysOffSalespeople[0].id));
      return;
    }
    if (
      selectedDaysOffSalesId &&
      !daysOffSalespeople.some((person) => String(person.id) === String(selectedDaysOffSalesId))
    ) {
      setSelectedDaysOffSalesId(daysOffSalespeople.length ? String(daysOffSalespeople[0].id) : "");
    }
  }, [daysOffSalespeople, selectedDaysOffSalesId]);

  useEffect(() => {
    if (!selectedTrafficDate.startsWith(trafficMonth)) {
      const fallbackDate = today.startsWith(trafficMonth) ? today : `${trafficMonth}-01`;
      setSelectedTrafficDate(fallbackDate);
    }
  }, [selectedTrafficDate, today, trafficMonth]);

  useEffect(() => {
    if (!visibleTrafficEntries.length) {
      if (expandedTrafficEntryId !== null) {
        setExpandedTrafficEntryId(null);
      }
      return;
    }
    if (!visibleTrafficEntries.some((entry) => entry.id === expandedTrafficEntryId)) {
      setExpandedTrafficEntryId(visibleTrafficEntries[0].id);
    }
  }, [expandedTrafficEntryId, visibleTrafficEntries]);

  useEffect(() => {
    if (tab === "serviceCalendar" && trafficMonth !== month) {
      setTrafficMonth(month);
    }
  }, [month, tab, trafficMonth]);

  useEffect(() => {
    if (isBdcUniversal) {
      setLeadForm((current) => ({
        ...current,
        leadStore: current.leadStore === "Outlet" ? "Outlet" : "Kia/Mazda",
      }));
    } else if (!isBdcGlobal && leadForm.leadStore === "Kia/Mazda") {
      setLeadForm((current) => ({ ...current, leadStore: "Kia" }));
    }
  }, [isBdcUniversal, isBdcGlobal]);

  useEffect(() => {
    if ((tab === "serviceNotes" || (tab === "admin" && adminSection === "trafficLog")) && month !== trafficMonth) {
      setMonth(trafficMonth);
    }
  }, [adminSection, month, tab, trafficMonth]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!adminToken) {
        setAdminSession(null);
        return;
      }
      try {
        const session = await getAdminSession(adminToken);
        if (active) setAdminSession(session);
      } catch {
        if (!active) return;
        setAdminToken("");
        setAdminSession(null);
        localStorage.removeItem("dealer_tool_admin");
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [adminToken]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!adminSession) {
        setDaysOffData({ month: daysOffMonth, entries: [] });
        return;
      }
      try {
        const data = await getAdminDaysOff(adminToken, { month: daysOffMonth });
        if (active) setDaysOffData(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSession, adminToken, daysOffMonth]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!adminSession || !adminToken) {
        setNotificationConfig({
          sms_provider: "Twilio",
          sms_configured: false,
          email_provider: "Resend",
          email_configured: false,
        });
        return;
      }
      try {
        const data = await getNotificationConfig(adminToken);
        if (active) setNotificationConfig(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [adminSession, adminToken]);

  async function refresh() {
    try {
      const tasks = [
        loadAll(month, filters),
        refreshServiceTraffic(trafficMonth, selectedTrafficDate),
        refreshBdcState(leadForm.leadStore),
      ];
      if (adminSession && adminToken) tasks.push(refreshNotificationConfig());
      await Promise.all(tasks);
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy("login");
    setError("");
    try {
      const session = await adminLogin(login);
      setAdminToken(session.token);
      setAdminSession(session);
      localStorage.setItem("dealer_tool_admin", session.token);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function logout() {
    setAdminToken("");
    setAdminSession(null);
    localStorage.removeItem("dealer_tool_admin");
  }

  async function saveSalesperson(person) {
    setBusy(`sales-${person.id}`);
    setError("");
    try {
      await updateSalesperson(adminToken, person.id, person);
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function setDaysOffEntry(personId, offDates) {
    setDaysOffData((current) => {
      const nextEntries = current.entries.filter((entry) => entry.salesperson_id !== personId);
      if (offDates.length) {
        nextEntries.push({
          salesperson_id: personId,
          off_dates: [...offDates].sort(),
        });
      }
      nextEntries.sort((left, right) => left.salesperson_id - right.salesperson_id);
      return { ...current, month: daysOffMonth, entries: nextEntries };
    });
  }

  async function saveAllDaysOffMonth() {
    setBusy("days-off-month");
    setError("");
    try {
      const data = await replaceAdminDaysOffMonth(adminToken, {
        month: daysOffMonth,
        entries: daysOffData.entries.map((entry) => ({
          salesperson_id: entry.salesperson_id,
          off_dates: entry.off_dates,
        })),
      });
      setDaysOffData(data);
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcAgent(agent) {
    setBusy(`bdc-${agent.id}`);
    setError("");
    try {
      await updateBdcAgent(adminToken, agent.id, agent);
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addSalesperson(event) {
    event.preventDefault();
    setBusy("add-sales");
    setError("");
    try {
      await createSalesperson(adminToken, salesForm);
      setSalesForm(emptySalesForm());
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addBdcAgent(event) {
    event.preventDefault();
    setBusy("add-bdc");
    setError("");
    try {
      await createBdcAgent(adminToken, bdcForm);
      setBdcForm({ name: "", active: true });
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function buildMonth(overwrite) {
    setBusy(overwrite ? "rebuild-month" : "fill-month");
    setError("");
    try {
      const data = await generateServiceDrive(adminToken, { month, overwrite });
      setServiceMonth(data);
      await refreshServiceTraffic(trafficMonth, selectedTrafficDate);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function setSlot(scheduleDate, brand, salespersonId) {
    const key = `${scheduleDate}-${brand}`;
    setBusy(key);
    setError("");
    try {
      const data = await updateServiceDriveAssignment(adminToken, {
        schedule_date: scheduleDate,
        brand,
        salesperson_id: salespersonId ? Number(salespersonId) : null,
      });
      setServiceMonth(data);
      await refreshServiceTraffic(trafficMonth, selectedTrafficDate);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function openTrafficDay(trafficDate) {
    setSelectedTrafficDate(trafficDate);
    setTrafficMonth(trafficDate.slice(0, 7));
    setTab("serviceNotes");
  }

  function printServiceCalendar() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  function patchTrafficEntry(entryId, patch) {
    setServiceTrafficData((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
    }));
  }

  function resetTrafficEntryForm() {
    setTrafficEntryForm({
      brand: "Kia",
      customerName: "",
      customerPhone: "",
      vehicleYear: "",
      modelMake: "",
      offerIdea: "",
    });
    setTrafficEntryFiles([]);
    setTrafficEntryFileKey((current) => current + 1);
  }

  function resetReynoldsImportForm() {
    setReynoldsImportFile(null);
    setReynoldsImportFileKey((current) => current + 1);
  }

  function resetMastermindImportForm() {
    setMastermindImportFile(null);
    setMastermindImportFileKey((current) => current + 1);
  }

  function setTrafficRowFiles(entryId, files) {
    setTrafficRowUploadFiles((current) => ({
      ...current,
      [entryId]: Array.from(files || []),
    }));
  }

  function clearTrafficRowFiles(entryId) {
    setTrafficRowUploadFiles((current) => {
      const next = { ...current };
      delete next[entryId];
      return next;
    });
    setTrafficRowUploadKeys((current) => ({
      ...current,
      [entryId]: (current[entryId] || 0) + 1,
    }));
  }

  async function uploadTrafficImages(entryId, files) {
    const uploads = Array.from(files || []);
    if (!uploads.length) return null;
    const formData = new FormData();
    uploads.forEach((file) => formData.append("files", file));
    return await uploadServiceDriveTrafficImages(adminToken, entryId, formData);
  }

  async function addTrafficEntry(event) {
    event.preventDefault();
    setBusy("add-traffic-entry");
    setError("");
    setReynoldsImportResult(null);
    setMastermindImportResult(null);
    try {
      let saved = await createServiceDriveTraffic(adminToken, {
        traffic_date: selectedTrafficDate,
        brand: trafficEntryForm.brand,
        customer_name: trafficEntryForm.customerName,
        customer_phone: trafficEntryForm.customerPhone,
        vehicle_year: trafficEntryForm.vehicleYear,
        model_make: trafficEntryForm.modelMake,
        offer_idea: trafficEntryForm.offerIdea,
      });
      if (trafficEntryFiles.length) {
        saved = (await uploadTrafficImages(saved.id, trafficEntryFiles)) || saved;
      }
      patchTrafficEntry(saved.id, saved);
      resetTrafficEntryForm();
      await refreshServiceTraffic();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function importTrafficCsv(event) {
    event.preventDefault();
    if (!reynoldsImportFile) {
      setError("Choose a Reynolds SERVICEAPPTS.csv file first.");
      return;
    }
    setBusy("import-traffic-csv");
    setError("");
    setReynoldsImportResult(null);
    setReynoldsUndoResult(null);
    setMastermindImportResult(null);
    setMastermindUndoResult(null);
    try {
      const formData = new FormData();
      formData.append("file", reynoldsImportFile);
      const result = await importReynoldsServiceDriveTraffic(adminToken, formData);
      const focusDate = result.dates?.[0] || selectedTrafficDate;
      const focusMonth = focusDate ? focusDate.slice(0, 7) : trafficMonth;
      setReynoldsImportResult(result);
      resetReynoldsImportForm();
      setExpandedTrafficEntryId(null);
      if (focusMonth) setTrafficMonth(focusMonth);
      if (focusDate) setSelectedTrafficDate(focusDate);
      await refreshServiceTraffic(focusMonth, focusDate);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function importMastermindTrafficCsv(event) {
    event.preventDefault();
    if (!mastermindImportFile) {
      setError("Choose a Mastermind service appointments CSV file first.");
      return;
    }
    setBusy("import-mastermind-traffic-csv");
    setError("");
    setReynoldsImportResult(null);
    setReynoldsUndoResult(null);
    setMastermindImportResult(null);
    setMastermindUndoResult(null);
    try {
      const formData = new FormData();
      formData.append("file", mastermindImportFile);
      const result = await importMastermindServiceDriveTraffic(adminToken, formData);
      const focusDate = result.dates?.[0] || selectedTrafficDate;
      const focusMonth = focusDate ? focusDate.slice(0, 7) : trafficMonth;
      setMastermindImportResult(result);
      resetMastermindImportForm();
      setExpandedTrafficEntryId(null);
      if (focusMonth) setTrafficMonth(focusMonth);
      if (focusDate) setSelectedTrafficDate(focusDate);
      await refreshServiceTraffic(focusMonth, focusDate);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function undoTrafficCsvImport() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Undo the Reynolds CSV import? This removes Reynolds-imported traffic rows, keeps manual rows alone, and leaves any imported rows with saved salesperson notes in place."
      )
    ) {
      return;
    }
    setBusy("undo-traffic-csv");
    setError("");
    setReynoldsImportResult(null);
    setReynoldsUndoResult(null);
    setMastermindImportResult(null);
    setMastermindUndoResult(null);
    try {
      const result = await undoReynoldsServiceDriveTrafficImport(adminToken);
      await refreshServiceTraffic(trafficMonth, selectedTrafficDate);
      setExpandedTrafficEntryId(null);
      setReynoldsUndoResult(result);
      setError(result.deleted || result.preserved_with_notes ? "" : "No Reynolds-imported rows were found to remove.");
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function undoMastermindTrafficCsvImport() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Undo the Mastermind CSV import? This removes Mastermind-imported traffic rows, keeps manual rows alone, and leaves any imported rows with saved salesperson notes in place."
      )
    ) {
      return;
    }
    setBusy("undo-mastermind-traffic-csv");
    setError("");
    setReynoldsImportResult(null);
    setReynoldsUndoResult(null);
    setMastermindImportResult(null);
    setMastermindUndoResult(null);
    try {
      const result = await undoMastermindServiceDriveTrafficImport(adminToken);
      await refreshServiceTraffic(trafficMonth, selectedTrafficDate);
      setExpandedTrafficEntryId(null);
      setMastermindUndoResult(result);
      setError(result.deleted || result.preserved_with_notes ? "" : "No Mastermind-imported rows were found to remove.");
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function clearTrafficDay(trafficDate = selectedTrafficDate) {
    const resolvedDate = String(trafficDate || "").trim();
    if (!resolvedDate) {
      setError("Pick a traffic date first.");
      return;
    }
    const count = serviceTrafficData.counts_by_date?.[resolvedDate] || 0;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Clear ${count} traffic row${count === 1 ? "" : "s"} for ${resolvedDate}? This deletes the full day, including uploaded offer screenshots.`
      )
    ) {
      return;
    }

    const busyKey = `clear-traffic-day-${resolvedDate}`;
    setBusy(busyKey);
    setError("");
    setReynoldsImportResult(null);
    setReynoldsUndoResult(null);
    setMastermindImportResult(null);
    setMastermindUndoResult(null);
    try {
      const result = await deleteServiceDriveTrafficDay(adminToken, resolvedDate);
      setTrafficDayClearResult(result);
      setExpandedTrafficEntryId(null);
      setSelectedTrafficDate(resolvedDate);
      setTrafficMonth(resolvedDate.slice(0, 7));
      await refreshServiceTraffic(resolvedDate.slice(0, 7), resolvedDate);
      if (!result.deleted) {
        setError(`No traffic rows were found for ${resolvedDate}.`);
      }
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function askTrafficAnalysisPrompt(promptValue) {
    const prompt = String(promptValue || "").trim();
    if (!prompt) return;
    const answer = answerTrafficAnalysisQuestion(prompt, trafficAnalysis, trafficAnalysisData.month || trafficMonth);
    setTrafficAnalysisMessages((current) => [
      ...current,
      { role: "user", text: prompt },
      { role: "assistant", text: answer },
    ]);
  }

  function submitTrafficAnalysisQuestion(event) {
    event.preventDefault();
    const prompt = String(trafficAnalysisQuestion || "").trim();
    if (!prompt) return;
    askTrafficAnalysisPrompt(prompt);
    setTrafficAnalysisQuestion("");
  }

  async function saveTrafficEntry(entry) {
    setBusy(`traffic-admin-${entry.id}`);
    setError("");
    try {
      const saved = await updateServiceDriveTraffic(adminToken, entry.id, {
        traffic_date: entry.traffic_date,
        brand: entry.brand,
        customer_name: entry.customer_name,
        customer_phone: entry.customer_phone,
        vehicle_year: entry.vehicle_year,
        model_make: entry.model_make,
        offer_idea: entry.offer_idea,
      });
      patchTrafficEntry(entry.id, saved);
      await refreshServiceTraffic();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function uploadTrafficRowImages(entry) {
    const files = trafficRowUploadFiles[entry.id] || [];
    if (!files.length) {
      setError("Choose one or more screenshots first.");
      return;
    }
    setBusy(`traffic-images-${entry.id}`);
    setError("");
    try {
      const saved = await uploadTrafficImages(entry.id, files);
      if (saved) patchTrafficEntry(entry.id, saved);
      clearTrafficRowFiles(entry.id);
      await refreshServiceTraffic();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveTrafficSalesNotes(entry) {
    setBusy(`traffic-sales-${entry.id}`);
    setError("");
    try {
      const saved = await updateServiceDriveTrafficSales(entry.id, {
        salesperson_id: selectedTrafficSalesId ? Number(selectedTrafficSalesId) : null,
        sales_notes: entry.sales_notes,
      });
      patchTrafficEntry(entry.id, saved);
      const currentIndex = visibleTrafficEntries.findIndex((item) => item.id === entry.id);
      const trailingEntries = currentIndex >= 0 ? visibleTrafficEntries.slice(currentIndex + 1) : [];
      const nextEntry =
        trailingEntries.find((item) => !String(item.sales_notes || "").trim()) ||
        trailingEntries[0] ||
        null;
      if (nextEntry) {
        setExpandedTrafficEntryId(nextEntry.id);
      }
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function uploadTrafficPdf(event) {
    event.preventDefault();
    if (!trafficPdfForm.file) {
      setError("Choose a PDF file first.");
      return;
    }
    setBusy("upload-traffic-pdf");
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", trafficPdfForm.title);
      formData.append("file", trafficPdfForm.file);
      await createTrafficPdf(adminToken, formData);
      setTrafficPdfForm({ title: "", file: null });
      setTrafficUploadKey((current) => current + 1);
      await refreshTrafficPdfs();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function uploadSpecial(event) {
    event.preventDefault();
    if (!specialForm.editingId && !specialForm.file) {
      setError("Choose a specials image first.");
      return;
    }
    setBusy("upload-special");
    setError("");
    try {
      const formData = new FormData();
      formData.append("title", specialForm.title);
      formData.append("tag", specialForm.tag);
      if (specialForm.file) {
        formData.append("file", specialForm.file);
      }
      const created = specialForm.editingId
        ? await updateSpecial(adminToken, specialForm.editingId, formData)
        : await createSpecial(adminToken, formData);
      setSpecialForm({
        editingId: created.id,
        title: created.title,
        tag: created.tag,
        file: null,
      });
      setSpecialUploadKey((current) => current + 1);
      await refreshSpecials();
      setSelectedSpecialId(created.id);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function resetSpecialForm() {
    setSpecialForm({ editingId: null, title: "", tag: "", file: null });
    setSpecialUploadKey((current) => current + 1);
  }

  function beginSpecialEdit(item) {
    setSelectedSpecialId(item.id);
    setSpecialForm({
      editingId: item.id,
      title: item.title,
      tag: item.tag,
      file: null,
    });
    setSpecialUploadKey((current) => current + 1);
  }

  async function assignLead() {
    if (!leadForm.bdcAgentId) {
      setError("Choose a BDC agent first.");
      return;
    }
    setBusy("assign");
    setError("");
    try {
      const result = await assignBdcLead({
        bdc_agent_id: Number(leadForm.bdcAgentId),
        lead_store: leadForm.leadStore,
        customer_name: leadForm.customerName,
        customer_phone: leadForm.customerPhone,
      });
      setLastAssignment(result);
      setLeadForm((current) => ({ ...current, customerName: "", customerPhone: "" }));
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function handleClearBdcHistory() {
    if (!adminSession || !adminToken) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Clear all BDC assigned lead history? This only removes BDC lead history and reports.")
    ) {
      return;
    }
    setBusy("clear-bdc-history");
    setError("");
    try {
      await clearBdcHistory(adminToken);
      setLastAssignment(null);
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function handleUndoLastBdcAssign() {
    if (typeof window !== "undefined" && !window.confirm("Undo the most recent BDC assignment?")) {
      return;
    }
    setBusy("undo-assign");
    setError("");
    try {
      let password = "";
      if (bdcUndoSettings.require_password) {
        password = window.prompt("Enter undo password", "") || "";
        if (!password) {
          setBusy("");
          return;
        }
      }
      const result = await undoLastBdcAssign({ password });
      if (result?.removed) setLastAssignment(null);
      await refresh();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function applyFreshUpSalespersonQuery(value) {
    const match = findSalespersonMatch(activeSales, value);
    setFreshUpForm((current) => ({
      ...current,
      salespersonQuery: value,
      salespersonId: match ? String(match.id) : "",
    }));
    if (match) {
      setFreshUpStatus("");
    }
  }

  async function copyFreshUpSummary() {
    try {
      setError("");
      await copyTextValue(freshUpSummary);
      setFreshUpStatus("Summary copied.");
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  function resetFreshUpForm() {
    setFreshUpForm({
      ...FRESH_UP_DEFAULTS,
      salespersonId: freshUpCardMode ? freshUpLaunchContext.salespersonId || "" : "",
      salespersonQuery: freshUpCardMode ? freshUpAssignedSalesperson?.name || "" : "",
      source: freshUpCardMode ? "NFC Card" : "Desk",
    });
    setFreshUpStatus("");
  }

  async function copyFreshUpCardLink() {
    if (!freshUpCardHref) return;
    try {
      await copyTextValue(freshUpCardHref);
      setFreshUpStatus("NFC link copied.");
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  async function submitFreshUpLog() {
    setBusy("freshup-submit");
    setError("");
    try {
      const salespersonId =
        freshUpAssignedSalesperson?.id || (freshUpForm.salespersonId ? Number(freshUpForm.salespersonId) : undefined);
      if (!salespersonId) {
        throw new Error("Pick the salesperson first.");
      }
      await createFreshUpLog({
        customer_name: freshUpForm.customerName,
        customer_phone: freshUpForm.phone,
        salesperson_id: salespersonId,
        source: freshUpCardMode ? "NFC Card" : "Desk",
      });
      if (!freshUpCardMode) {
        await refreshFreshUpLog();
      }
      setFreshUpForm((current) => ({
        ...current,
        customerName: "",
        phone: "",
        salespersonId: String(salespersonId),
        salespersonQuery: freshUpAssignedSalesperson?.name || current.salespersonQuery,
        source: freshUpCardMode ? "NFC Card" : "Desk",
      }));
      setFreshUpStatus(
        freshUpCardMode
          ? `Thanks. ${freshUpAssignedSalesperson?.name || "Our team"} will reach out soon.`
          : "Freshup logged."
      );
      if (freshUpCardMode && typeof document !== "undefined") {
        window.setTimeout(() => {
          document.getElementById("freshup-links")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function setFreshUpLinkField(field, value) {
    setFreshUpLinksConfig((current) => ({ ...current, [field]: value }));
  }

  function setFreshUpStoreField(dealership, field, value) {
    setFreshUpLinksConfig((current) => ({
      ...current,
      stores: (current.stores || []).map((store) => (store.dealership === dealership ? { ...store, [field]: value } : store)),
    }));
  }

  async function saveFreshUpLinksSettings() {
    setBusy("freshup-links");
    setError("");
    try {
      const updated = await updateFreshUpLinks(adminToken, freshUpLinksConfig);
      setFreshUpLinksConfig(updated);
      setFreshUpStatus("Freshup customer page saved.");
      setResourceLoadState((current) => ({ ...current, freshUpLinks: true }));
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function copyChromeExtensionsLink() {
    try {
      await copyTextValue("chrome://extensions/");
      setMarketplaceGuideStatus("Copied chrome://extensions/ to the clipboard.");
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  return (
    <div className="shell">
      <main className="app">
        {!freshUpCardMode ? (
        <header className="hero">
          <div className="hero-brand">
            <div className="hero-brand__top">
              <div className="hero-logo-shell">
                <img className="hero-logo" src="/dbt-hub-icon.png" alt="DBT hub icon" />
              </div>
              <div className="hero-copy">
                <span className="eyebrow hero-eyebrow">BDC Dealership Hub</span>
                <div className="hero-title-lockup">
                  <div className="hero-title__acronym" aria-hidden="true">
                    <span>D</span>
                    <span>B</span>
                    <span>T</span>
                  </div>
                  <h1 className="hero-title__expanded">
                    <span>Dealership</span>
                    <span>BDC</span>
                    <span>Tool</span>
                  </h1>
                </div>
                <p className="hero-subtitle">
                  Service-drive traffic, admin controls, lead rotation, and notes all in one command board.
                </p>
              </div>
            </div>
            <div className="hero-ribbon">
              <div className="hero-ribbon__item">
                <span>Traffic this month</span>
                <strong>{trafficMonthTotal}</strong>
              </div>
              <div className="hero-ribbon__item">
                <span>Assigned slots</span>
                <strong>{serviceMonth ? `${serviceMonth.assigned_slots}/${serviceMonth.total_slots}` : "0/0"}</strong>
              </div>
              <div className="hero-ribbon__item">
                <span>Active staff</span>
                <strong>{activeSales.length}</strong>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <span>Admin</span>
            <strong>{adminSession ? adminSession.username : "Not signed in"}</strong>
            <small>{adminSession ? "Management actions unlocked" : "Only the admin tab requires login"}</small>
          </div>
        </header>
        ) : null}

        {!freshUpCardMode ? (
          <nav className="tabs">
              {tabsToShow.map((item) => (
                <button
                  key={item.id}
                  type="button"
                className={`tab ${tab === item.id ? "is-active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}

        {error ? <div className="notice error">{error}</div> : null}
        {loading ? <div className="notice">Loading...</div> : null}

        {tab === "serviceCalendar" ? (
          <section className="stack service-calendar-section">
            <div className="calendar-print-header">
              <span className="eyebrow">Service drive calendar</span>
              <h1>{monthLabel(month)}</h1>
              <p>Kia and Mazda assignments by day.</p>
            </div>

            <div className="panel row service-calendar-toolbar">
              <div>
                <span className="eyebrow">Service drive month</span>
                <h2>{monthLabel(month)}</h2>
              </div>
              <div className="controls">
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
                <button type="button" className="secondary" onClick={printServiceCalendar}>
                  Print PDF
                </button>
                {adminSession ? (
                  <>
                    <button type="button" onClick={() => buildMonth(false)} disabled={busy === "fill-month"}>
                      Fill Open Slots
                    </button>
                    <button type="button" className="secondary" onClick={() => buildMonth(true)} disabled={busy === "rebuild-month"}>
                      Rebuild Month
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span>Active salespeople</span>
                <strong>{activeSales.length}</strong>
              </div>
              <div className="stat">
                <span>Service eligible</span>
                <strong>{serviceEligible.length}</strong>
              </div>
              <div className="stat">
                <span>Assigned service slots</span>
                <strong>{serviceMonth ? `${serviceMonth.assigned_slots}/${serviceMonth.total_slots}` : "0/0"}</strong>
              </div>
            </div>

            <div className="calendar-board">
              <div className="calendar-board__weekdays">
                {CALENDAR_WEEKDAYS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {serviceCalendarCells.map((day, index) => {
                  if (!day) {
                    return <div key={`blank-${index}`} className="calendar-blank" aria-hidden="true" />;
                  }

                  const parts = dateParts(day.date);
                  const isSunday = parts.weekdayIndex === 0;
                  const trafficCount =
                    serviceTrafficData.month === month ? serviceTrafficData.counts_by_date?.[day.date] || 0 : 0;

                  return (
                    <article
                      key={day.date}
                      className={`calendar-day ${parts.weekdayIndex === 0 || parts.weekdayIndex === 6 ? "is-weekend" : ""} ${day.date === today ? "is-today" : ""}`}
                    >
                      <div className="calendar-day__header">
                        <div className="calendar-day__lead">
                          <span className="calendar-day__weekday">{day.day_label}</span>
                          {day.date === today ? <span className="calendar-day__today">Today</span> : null}
                        </div>
                        <div className="calendar-day__stamp">
                          <strong>{parts.dayNumber}</strong>
                          <small>{parts.monthShort}</small>
                        </div>
                      </div>

                      <div className="calendar-day__traffic">
                        <span>{trafficCount} traffic rows</span>
                        <div className="calendar-day__traffic-actions">
                          <button
                            type="button"
                            className="calendar-day__plus"
                            aria-label={`Open service-drive traffic for ${day.date}`}
                            onClick={() => openTrafficDay(day.date)}
                          >
                            <b>+</b>
                            <small>Traffic</small>
                          </button>
                          {adminSession && trafficCount ? (
                            <button
                              type="button"
                              className="secondary calendar-day__clear"
                              onClick={() => clearTrafficDay(day.date)}
                              disabled={busy === `clear-traffic-day-${day.date}`}
                            >
                              {busy === `clear-traffic-day-${day.date}` ? "Clearing..." : "Clear Day"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="calendar-day__assignments">
                        {[
                          ["Kia", day.kia],
                          ["Mazda", day.mazda],
                        ].map(([brand, slot]) => (
                          <div key={brand} className="assignment">
                            <div className="assignment__summary">
                              <span className="assignment__brand">{brand}</span>
                              <strong>{isSunday ? "Closed" : slot.salesperson_name || "Open"}</strong>
                              <small>{isSunday ? "Sunday" : slot.salesperson_dealership || "No assignment"}</small>
                            </div>
                            {adminSession && !isSunday ? (
                              <select
                                className="assignment__select"
                                value={slot.salesperson_id ?? ""}
                                onChange={(event) => setSlot(day.date, brand, event.target.value)}
                                disabled={busy === `${day.date}-${brand}`}
                              >
                                <option value="">Open</option>
                                {serviceEligible.map((person) => (
                                  <option key={`${brand}-${person.id}`} value={person.id}>
                                    {person.name} - {person.dealership}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="calendar-print-sheet">
              <div className="calendar-print-sheet__title">
                <img className="calendar-print-sheet__logo" src="/dbt-hub-icon.png" alt="DBT hub icon" />
                <div className="calendar-print-sheet__title-copy">
                  <span className="eyebrow">Service drive calendar</span>
                  <h2>{monthLabel(month)}</h2>
                </div>
              </div>
              <div className="calendar-print-sheet__weekdays">
                {CALENDAR_WEEKDAYS.map((label) => (
                  <span key={`print-${label}`}>{label}</span>
                ))}
              </div>
              <div
                className={`calendar-print-grid ${
                  serviceCalendarPrintCells.length > 35 ? "calendar-print-grid--six-rows" : "calendar-print-grid--five-rows"
                }`}
              >
                {serviceCalendarPrintCells.map((day, index) => {
                  if (!day) {
                    return <div key={`print-blank-${index}`} className="calendar-print-cell calendar-print-cell--blank" aria-hidden="true" />;
                  }

                  const parts = dateParts(day.date);
                  const isSunday = isSundayDate(day.date);
                  return (
                    <article
                      key={`print-${day.date}`}
                      className={`calendar-print-cell ${day.date === today ? "is-today" : ""}`}
                    >
                      <div className="calendar-print-cell__header">
                        <strong>{parts.dayNumber}</strong>
                        <small>{parts.monthShort}</small>
                      </div>
                      <div className="calendar-print-cell__assignments">
                        <div className="calendar-print-line calendar-print-line--kia">
                          <span>Kia Service Drive:</span>
                          <b className="calendar-print-name-bubble calendar-print-name-bubble--kia">
                            {isSunday ? "Closed" : shortPersonName(day.kia?.salesperson_name)}
                          </b>
                        </div>
                        <div className="calendar-print-line calendar-print-line--mazda">
                          <span>Mazda Service Drive:</span>
                          <b className="calendar-print-name-bubble calendar-print-name-bubble--mazda">
                            {isSunday ? "Closed" : shortPersonName(day.mazda?.salesperson_name)}
                          </b>
                        </div>
                        <div className="calendar-print-line calendar-print-line--off">
                          <span>Off:</span>
                          <b className="calendar-print-name-bubble calendar-print-name-bubble--off">
                            {day.people_off?.length ? day.people_off.map((name) => shortPersonName(name)).join(", ") : "None"}
                          </b>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "serviceNotes" ? (
          <section className="stack service-notes-shell">
            <div className="panel traffic-notes-hero service-notes-hero">
              <div className="traffic-focus-panel__headline">
                <div>
                  <span className="eyebrow">{focusTrafficIsToday ? "Today's note board" : "Service drive notes"}</span>
                  <h2>{longDateLabel(focusTrafficDate)}</h2>
                  <p className="admin-note">
                    Pick your date and name once, then move row by row. The mobile layout keeps the note entry flow tight
                    so salespeople can update the board quickly from Safari or the installed app.
                  </p>
                </div>
                <div className="traffic-day-panel__count">{visibleTrafficCount} rows</div>
              </div>
              <div className="traffic-focus-grid">
                <div className="traffic-focus-status">
                  <strong>{selectedTrafficSalesperson?.name || "Notes are open"}</strong>
                  <small>
                    {selectedTrafficHasAuthor
                      ? "Your selected name tag will be attached to each note you save."
                      : "Pick your name to keep the board tagged cleanly, or leave it open if a manager is updating rows."}
                  </small>
                </div>
                <div className="traffic-team-card traffic-team-card--focus">
                  <span>Kia assigned now</span>
                  <strong>{focusTrafficKia.salesperson_name || "Open"}</strong>
                  <small>{focusTrafficKia.salesperson_dealership || "No assignment"}</small>
                </div>
                <div className="traffic-team-card traffic-team-card--focus">
                  <span>Mazda assigned now</span>
                  <strong>{focusTrafficMazda.salesperson_name || "Open"}</strong>
                  <small>{focusTrafficMazda.salesperson_dealership || "No assignment"}</small>
                </div>
                <div className="traffic-summary-stat traffic-summary-stat--focus">
                  <span>{selectedTrafficFilterLabel}</span>
                  <strong>{visibleTrafficCount}</strong>
                </div>
              </div>

              <div className="service-notes-kpis">
                <div className="service-notes-kpi">
                  <span>Saved</span>
                  <strong>{serviceNotesSavedCount}</strong>
                </div>
                <div className="service-notes-kpi">
                  <span>Pending</span>
                  <strong>{serviceNotesPendingCount}</strong>
                </div>
                <div className="service-notes-kpi">
                  <span>Name tag</span>
                  <strong>
                    {selectedTrafficSalesperson
                      ? `${selectedTrafficSalesperson.name.split(" ")[0]} · ${selectedTrafficSalesperson.dealership}`
                      : "Open"}
                  </strong>
                </div>
              </div>

              <div className="traffic-franchise-toggle">
                <span className="traffic-franchise-toggle__label">Franchise view</span>
                <div className="traffic-franchise-toggle__buttons">
                  {["All", "Kia", "Mazda"].map((brand) => (
                    <button
                      key={`traffic-filter-${brand}`}
                      type="button"
                      className={`traffic-franchise-toggle__button traffic-franchise-toggle__button--${brand.toLowerCase()} ${
                        selectedTrafficBrandFilter === brand ? "is-active" : ""
                      }`}
                      onClick={() => setSelectedTrafficBrandFilter(brand)}
                    >
                      {brand === "All" ? "All Franchises" : brand}
                    </button>
                  ))}
                </div>
              </div>

              <div className="traffic-notes-hero__controls">
                <label>
                  <span>Date</span>
                  <input
                    type="date"
                    value={selectedTrafficDate}
                    onChange={(event) => {
                      setSelectedTrafficDate(event.target.value);
                      if (event.target.value) {
                        setTrafficMonth(event.target.value.slice(0, 7));
                      }
                    }}
                  />
                </label>
                <label>
                  <span>Salesperson tag</span>
                  <select value={selectedTrafficSalesId} onChange={(event) => applyTrafficSalespersonSelection(event.target.value)}>
                    <option value="">No name tag</option>
                    {serviceEligible.map((person) => (
                      <option key={`traffic-sales-${person.id}`} value={person.id}>
                        {person.name} - {person.dealership}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="traffic-notes-hero__actions">
                  {selectedTrafficSalesStore ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setSelectedTrafficBrandFilter(selectedTrafficSalesStore)}
                    >
                      Show My Store
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setSelectedTrafficDate(today);
                      setTrafficMonth(today.slice(0, 7));
                    }}
                  >
                    Jump to Today
                  </button>
                  <button type="button" className="secondary" onClick={() => setTab("serviceCalendar")}>
                    Back to Calendar
                  </button>
                </div>
              </div>
            </div>

            <div className="notes-list notes-list--accordion">
              {visibleTrafficEntries.length ? (
                visibleTrafficEntries.map((entry) => {
                  const brandKey = String(entry.brand || "Kia").toLowerCase();
                  const matchesSelectedStore = Boolean(selectedTrafficSalesStore && selectedTrafficSalesStore === entry.brand);
                  const isExpanded = expandedTrafficEntryId === entry.id;
                  const vehicleLine = entry.model_make || "Model not entered";
                  const hasSavedNotes = Boolean(String(entry.sales_notes || "").trim());
                  const customerPhoneLink = phoneHref(entry.customer_phone);
                  return (
                    <article
                      key={entry.id}
                      className={`note-card note-card--accordion note-card--${brandKey} ${
                        matchesSelectedStore ? "note-card--store-match" : ""
                      } ${isExpanded ? "is-expanded" : "is-collapsed"}`}
                    >
                      <button
                        type="button"
                        className="note-card__summary"
                        onClick={() => setExpandedTrafficEntryId(entry.id)}
                        aria-expanded={isExpanded}
                      >
                          <div className="note-card__summary-main">
                            <div>
                              <span className="eyebrow">Service drive traffic</span>
                              <strong>{entry.customer_name || "Unnamed prospect"}</strong>
                            </div>
                            <div className="note-card__summary-phone">
                              <span>Phone</span>
                              <strong>{entry.customer_phone || "No phone entered"}</strong>
                            </div>
                            <div className="note-card__summary-vehicle">
                              <span>Vehicle</span>
                              <strong>{vehicleLine || "Year / model not entered"}</strong>
                              <div className="note-card__summary-metrics">
                                <span className="note-metric-chip note-metric-chip--year">
                                  {entry.vehicle_year || "Year n/a"}
                                </span>
                                <span className="note-metric-chip note-metric-chip--odometer">
                                  {odometerLabel(entry.odometer)}
                                </span>
                              </div>
                            </div>
                          </div>
                        <div className="note-card__summary-side">
                          <span className={`brand-pill brand-pill--${brandKey}`}>{entry.brand}</span>
                          <span className="note-card__summary-date">
                            {entry.appointment_label ? `Appt ${entry.appointment_label}` : entry.traffic_date}
                          </span>
                          <span
                            className={`note-card__summary-status ${
                              hasSavedNotes ? "note-card__summary-status--saved" : "note-card__summary-status--pending"
                            }`}
                          >
                            <span className="note-card__summary-status-icon" aria-hidden="true">
                              {hasSavedNotes ? "✓" : "•"}
                            </span>
                            {hasSavedNotes ? "Notes Saved" : "Pending"}
                          </span>
                          <span className="note-card__summary-toggle">{isExpanded ? "Open" : "Expand"}</span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="note-card__details">
                      <div className="note-meta">
                        <div className={`meta-item meta-item--brand meta-item--${brandKey}`}>
                          <span>Store</span>
                          <strong>{entry.brand}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Appointment</span>
                          <strong>{entry.appointment_label || "No time entered"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Phone</span>
                          <strong>{entry.customer_phone || "No phone entered"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Vehicle year</span>
                          <strong>{entry.vehicle_year || "N/A"}</strong>
                        </div>
                        <div className="meta-item meta-item--emphasis">
                          <span>Odometer</span>
                          <strong>{odometerLabel(entry.odometer)}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Model / Make</span>
                          <strong>{entry.model_make || "No model entered"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Drive team</span>
                          <strong>{driveTeamText(entry.drive_team)}</strong>
                        </div>
                      </div>

                      <div className="note-copy">
                        <div className="note-copy__block is-readonly">
                          <span>Offer idea</span>
                          <p>{entry.offer_idea || "No offer idea entered yet."}</p>
                          <TrafficOfferGallery images={entry.offer_images} brand={entry.brand} />
                        </div>

                        <label className="note-copy__block note-copy__block--editor">
                          <span>Salesperson notes</span>
                          <textarea
                            rows={5}
                            value={entry.sales_notes}
                            placeholder="Quick summary, objections, appointment outcome, trade details, next step, or follow-up plan."
                            onChange={(event) => patchTrafficEntry(entry.id, { sales_notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="note-actions note-actions--service">
                        <div className="note-actions__copy">
                          <small>
                            {selectedTrafficHasAuthor
                              ? `Saving with name tag: ${selectedTrafficSalesperson?.name || "selected salesperson"}`
                              : "Saving with no name tag. Select a name above only if you want it attached to the note."}
                            {selectedTrafficSalesStore
                              ? matchesSelectedStore
                                  ? ` - ${entry.brand} is your selected store`
                                  : ` - ${entry.brand} belongs to the other store`
                              : ""}
                          </small>
                          <small className="note-actions__meta">
                            Latest note by: {entry.sales_note_salesperson_name || "No name tag saved"} · Save moves you to the next row.
                          </small>
                        </div>
                        <div className="note-actions__quick">
                          {customerPhoneLink ? (
                            <a className="note-action-link" href={customerPhoneLink}>
                              Call Customer
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => saveTrafficSalesNotes(entry)}
                            disabled={busy === `traffic-sales-${entry.id}`}
                          >
                            {busy === `traffic-sales-${entry.id}` ? "Saving..." : "Save Note"}
                          </button>
                        </div>
                      </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="empty">
                  {selectedTrafficBrandFilter === "All"
                    ? "No traffic rows have been entered for that day."
                    : `No ${selectedTrafficBrandFilter} traffic rows have been entered for that day.`}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {false && tab === "serviceNotes" ? (
          <section className="stack">
            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Traffic month</span>
                  <h2>Prospecting traffic for {selectedTrafficDate}</h2>
                  <p className="admin-note">
                    Choose your salesperson name, open a day from the calendar, and update only the notes column for that
                    day’s traffic rows.
                  </p>
                </div>
              </div>
              <div className="filters filters--notes">
                <label>
                  <span>Traffic date</span>
                  <input
                    type="date"
                    value={selectedTrafficDate}
                    onChange={(event) => {
                      setSelectedTrafficDate(event.target.value);
                      if (event.target.value) {
                        setTrafficMonth(event.target.value.slice(0, 7));
                      }
                    }}
                  />
                </label>
                <label>
                  <span>Salesperson</span>
                  <select
                    value={selectedTrafficSalesId}
                    onChange={(event) => setSelectedTrafficSalesId(event.target.value)}
                  >
                    <option value="">Choose your name</option>
                    {serviceEligible.map((person) => (
                      <option key={`note-sales-${person.id}`} value={person.id}>
                        {person.name} - {person.dealership}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span>Traffic rows that day</span>
                <strong>{serviceTrafficData.total}</strong>
              </div>
              <div className="stat">
                <span>Calendar count for selected day</span>
                <strong>{selectedTrafficCount}</strong>
              </div>
              <div className="stat">
                <span>Selected salesperson</span>
                <strong>{selectedTrafficSalesperson?.name || "None"}</strong>
              </div>
            </div>

            <div className="notes-list">
              {serviceTrafficData.entries.length ? (
                serviceTrafficData.entries.map((entry) => {
                  const driveTeamIds = entry.drive_team.map((member) => member.salesperson_id).filter(Boolean);
                  const canEditSales =
                    selectedTrafficSalesId && driveTeamIds.includes(Number(selectedTrafficSalesId));

                  return (
                    <article key={entry.id} className="note-card">
                      <div className="note-card__top">
                        <div>
                          <span className="eyebrow">Service drive traffic</span>
                          <h3>{entry.customer_name}</h3>
                          <p className="note-card__subtitle">{entry.traffic_date}</p>
                        </div>
                        <span className="brand-pill brand-pill--kia">Prospect</span>
                      </div>

                      <div className="note-meta">
                        <div className="meta-item">
                          <span>Year</span>
                          <strong>{entry.vehicle_year || "N/A"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Model / Make</span>
                          <strong>{entry.model_make || "No model entered"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Drive team</span>
                          <strong>
                            {entry.drive_team
                              .map((member) => `${member.brand}: ${member.salesperson_name || "Open"}`)
                              .join(" · ") || "No team assigned"}
                          </strong>
                        </div>
                      </div>

                      <div className="note-copy">
                        <div className="note-copy__block is-readonly">
                          <span>Offer idea</span>
                          <p>{entry.offer_idea || "No offer idea entered yet."}</p>
                        </div>

                        <label className="note-copy__block">
                          <span>Notes</span>
                          <textarea
                            rows={5}
                            value={entry.sales_notes}
                            disabled={!canEditSales}
                            onChange={(event) => patchTrafficEntry(entry.id, { sales_notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="note-actions">
                        <small>
                          {canEditSales
                            ? "You can only update the notes field for traffic on your assigned day."
                            : selectedTrafficSalesId
                              ? "That salesperson is not assigned to the service drive for this day."
                              : "Pick your salesperson name above to unlock note saving."}
                        </small>
                        <button
                          type="button"
                          onClick={() => saveTrafficSalesNotes(entry)}
                          disabled={!canEditSales || busy === `traffic-sales-${entry.id}`}
                        >
                          {busy === `traffic-sales-${entry.id}` ? "Saving..." : "Save Notes"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty">No traffic rows have been entered for that day.</div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "bdc" ? (
          <section className="stack">
            <div className="panel lead-grid">
              <div>
                <span className="eyebrow">BDC lead assign</span>
                <h2>Ask for the next salesperson in the round robin.</h2>
                <p>
                  {isBdcGlobal
                    ? "Lead store still logs the source, but assignments rotate through all active salespeople."
                    : isBdcUniversal
                      ? "Kia and Mazda leads share one rotation. Outlet stays separate."
                      : "Choose the source store first, then assign the lead only within that store's salesperson pool."}
                </p>
                <div className="mode-pill-row">
                  <span
                    className={`mode-pill ${
                      isBdcGlobal ? "mode-pill--global" : isBdcUniversal ? "mode-pill--universal" : "mode-pill--franchise"
                    }`}
                  >
                    Distribution:{" "}
                    {isBdcGlobal ? "Global round robin" : isBdcUniversal ? "Universal (Kia/Mazda shared)" : "Franchise specific"}
                  </span>
                </div>
              </div>
              <div className="assign-card">
                <label>
                  <span>BDC agent</span>
                  <select
                    value={leadForm.bdcAgentId}
                    onChange={(event) => setLeadForm((current) => ({ ...current, bdcAgentId: event.target.value }))}
                  >
                    <option value="">Choose an agent</option>
                    {activeBdc.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Lead store</span>
                  <select
                    value={leadForm.leadStore}
                    onChange={(event) => setLeadForm((current) => ({ ...current, leadStore: event.target.value }))}
                    disabled={isBdcGlobal}
                  >
                    {isBdcUniversal ? (
                      <>
                        <option value="Kia/Mazda">Kia/Mazda</option>
                        <option value="Outlet">Outlet</option>
                      </>
                    ) : (
                      DEALERSHIP_ORDER.map((dealership) => (
                        <option key={`lead-store-${dealership}`} value={dealership}>
                          {dealership}
                        </option>
                      ))
                    )}
                  </select>
                  {isBdcGlobal ? <small>Global mode: store selection is locked.</small> : null}
                </label>
                <label>
                  <span>Customer name</span>
                  <input
                    value={leadForm.customerName}
                    onChange={(event) => setLeadForm((current) => ({ ...current, customerName: event.target.value }))}
                    placeholder="Walk-in or lead name"
                  />
                </label>
                <label>
                  <span>Customer phone</span>
                  <input
                    value={leadForm.customerPhone}
                    onChange={(event) => setLeadForm((current) => ({ ...current, customerPhone: event.target.value }))}
                    placeholder="Phone number"
                  />
                </label>
                <div className="next-up">
                  <span>Next up for {isBdcGlobal ? "All stores" : leadForm.leadStore}</span>
                  <strong>{bdcState?.next_salesperson?.name || "No active salesperson"}</strong>
                  <small>
                    {bdcClosedToday
                      ? "Closed on Sundays"
                      : bdcState?.next_salesperson?.dealership ||
                        (leadPoolSales.length
                          ? isBdcGlobal
                            ? "Everyone is scheduled off today"
                            : isBdcUniversal && leadForm.leadStore === "Outlet"
                              ? "Everyone in Outlet is scheduled off today"
                              : isBdcUniversal
                                ? "Everyone in Kia/Mazda is scheduled off today"
                            : `Everyone in ${leadForm.leadStore} is scheduled off today`
                          : isBdcGlobal
                            ? "No active salespeople"
                            : isBdcUniversal && leadForm.leadStore === "Outlet"
                              ? "No active Outlet salespeople"
                              : isBdcUniversal
                                ? "No active Kia/Mazda salespeople"
                            : `No active ${leadForm.leadStore} salespeople`)}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={assignLead}
                  disabled={busy === "assign" || bdcClosedToday || !activeBdc.length || !bdcState?.next_salesperson}
                >
                  {busy === "assign" ? "Assigning..." : "Assign Next Lead"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleUndoLastBdcAssign}
                  disabled={busy === "undo-assign"}
                >
                  {busy === "undo-assign" ? "Undoing..." : "Undo Last Assignment"}
                </button>
              </div>
            </div>

            {latestBdcAssignment ? (
              <div className="bdc-last-assigned">
                <span className="eyebrow">Last assigned</span>
                <div className="bdc-last-assigned__headline">
                  <strong>{latestBdcAssignment.salesperson_name}</strong>
                  <span>{latestBdcAssignment.lead_store || latestBdcAssignment.salesperson_dealership}</span>
                </div>
                <p>
                  {latestBdcAssignment.bdc_agent_name} sent {latestBdcAssignment.customer_name || "a customer"} to{" "}
                  {latestBdcAssignment.salesperson_name}.
                </p>
                <small>
                  {latestBdcAssignment.customer_phone || "No phone added"} · {dateTimeLabel(latestBdcAssignment.assigned_at)}
                </small>
                {latestBdcNotifications.length ? (
                  <div className="bdc-last-assigned__notifications">
                    {latestBdcNotifications.map((item) => (
                      <span
                        key={item}
                        className={`bdc-last-assigned__notification ${
                          item.toLowerCase().includes("sent") ? "is-success" : "is-warning"
                        }`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!bdcClosedToday && leadPoolSales.length && !bdcState?.next_salesperson ? (
              <div className="notice">
                {isBdcGlobal
                  ? "Nobody is eligible in the global round robin today because every active salesperson is scheduled off."
                  : isBdcUniversal
                    ? leadForm.leadStore === "Outlet"
                      ? "Nobody is eligible in the Outlet round robin today because every active Outlet salesperson is scheduled off."
                      : "Nobody is eligible in the Kia/Mazda round robin today because every active salesperson in those stores is scheduled off."
                    : `Nobody is eligible in the ${leadForm.leadStore} round robin today because every active salesperson in that store is scheduled off.`}
              </div>
            ) : null}

            {bdcClosedToday ? <div className="notice">BDC round robin is closed on Sundays.</div> : null}

            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Immutable log</span>
                  <h3>Newest assignments first</h3>
                </div>
                <small>{bdcLog.total} total assignments</small>
              </div>
              <LogTable entries={bdcLog.entries.slice(0, 25)} empty="No BDC assignments yet." />
              {adminSession ? (
                <div className="admin-danger-zone">
                  <div>
                    <strong>Admin only</strong>
                    <small>Clears only the BDC assigned-lead history and BDC reports. Service-drive data stays untouched.</small>
                  </div>
                  <button
                    type="button"
                    className="button-danger"
                    onClick={handleClearBdcHistory}
                    disabled={busy === "clear-bdc-history"}
                  >
                    {busy === "clear-bdc-history" ? "Clearing..." : "Clear BDC History"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "reports" ? (
          <section className="stack">
            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">BDC reporting</span>
                  <h2>Filterable assignment totals and history</h2>
                </div>
              </div>
              <div className="filters">
                <label>
                  <span>Salesperson</span>
                  <select
                    value={filters.salespersonId}
                    onChange={(event) => setFilters((current) => ({ ...current, salespersonId: event.target.value }))}
                  >
                    <option value="">All salespeople</option>
                    {salespeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} - {person.dealership}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Lead store</span>
                  <select
                    value={filters.leadStore}
                    onChange={(event) => setFilters((current) => ({ ...current, leadStore: event.target.value }))}
                  >
                    <option value="">All stores</option>
                    {isBdcUniversal ? (
                      <>
                        <option value="Kia/Mazda">Kia/Mazda</option>
                        <option value="Outlet">Outlet</option>
                      </>
                    ) : (
                      DEALERSHIP_ORDER.map((dealership) => (
                        <option key={`report-store-${dealership}`} value={dealership}>
                          {dealership}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </label>
              </div>
            </div>

            <div className="stats">
              <div className="stat">
                <span>Total in range</span>
                <strong>{bdcReport?.total_assignments ?? 0}</strong>
              </div>
              <div className="stat">
                <span>Selected salesperson actual</span>
                <strong>{bdcReport?.filtered_assignments ?? 0}</strong>
              </div>
              <div className="stat">
                <span>Expected round robin range</span>
                <strong>
                  {bdcReport
                    ? `${bdcReport.expected_min}${bdcReport.expected_min === bdcReport.expected_max ? "" : `-${bdcReport.expected_max}`}`
                    : "0"}
                </strong>
              </div>
            </div>

            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Distribution</span>
                  <h3>Assignments by salesperson</h3>
                </div>
              </div>
              <div className="report-list">
                {(bdcReport?.rows || []).map((row) => (
                  <div key={`${row.salesperson_id ?? row.salesperson_name}`} className="report-item">
                    <div>
                      <strong>{row.salesperson_name}</strong>
                      <small>{row.dealership || "Historical record"}</small>
                    </div>
                    <b>{row.assignments}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Filtered log</span>
                  <h3>Transparent history</h3>
                </div>
              </div>
              <LogTable entries={bdcLog.entries} empty="No assignments match these filters." />
            </div>
          </section>
        ) : null}

        {tab === "trafficAnalysis" ? (
          <section className="stack traffic-analysis-page">
            <div className="panel traffic-analysis-hero">
              <div>
                <span className="eyebrow">Service drive intelligence</span>
                <h2>Traffic analysis command center</h2>
                <p>
                  A denser month view for traffic volume, note coverage, owner load, and unanswered follow-up. Ask the
                  page direct questions about the notes and rows already on the board.
                </p>
              </div>
              <div className="traffic-analysis-hero__controls">
                <label>
                  <span>Month</span>
                  <input type="month" value={trafficMonth} onChange={(event) => setTrafficMonth(event.target.value)} />
                </label>
                <div className="traffic-analysis-hero__status">
                  <span>{trafficAnalysisLoading ? "Refreshing dataset" : "Dataset loaded"}</span>
                  <strong>{monthLabel(trafficAnalysisData.month || trafficMonth)}</strong>
                  <small>{trafficAnalysis.totalRows} traffic rows in scope</small>
                </div>
              </div>
            </div>

            <div className="traffic-analysis-stats">
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Total Traffic</span>
                  <TrafficAnalysisHint text="Total service drive traffic rows loaded for the selected month, across all visible traffic dates." />
                </div>
                <strong>{trafficAnalysis.totalRows}</strong>
                <small>{trafficAnalysis.activeDays} active day{trafficAnalysis.activeDays === 1 ? "" : "s"} in month</small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Note Coverage</span>
                  <TrafficAnalysisHint text="Percent of traffic rows that already have salesperson notes saved." />
                </div>
                <strong>{trafficAnalysis.noteCoverage}%</strong>
                <small>{trafficAnalysis.rowsWithNotes} rows with notes saved</small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Open Follow-Ups</span>
                  <TrafficAnalysisHint text="Traffic rows that still do not have any saved salesperson notes." />
                </div>
                <strong>{trafficAnalysis.pendingCount}</strong>
                <small>Rows still missing salesperson notes</small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Busiest Day</span>
                  <TrafficAnalysisHint text="The highest-volume traffic day in the selected month, based on imported and manually added rows." />
                </div>
                <strong>{trafficAnalysis.busiestDay ? trafficAnalysis.busiestDay.count : 0}</strong>
                <small>
                  {trafficAnalysis.busiestDay ? longDateLabel(trafficAnalysis.busiestDay.date) : "No traffic yet"}
                </small>
              </article>
            </div>

            <div className="traffic-analysis-grid">
              <div className="panel traffic-analysis-panel traffic-analysis-panel--wide">
                <div className="row">
                  <div>
                    <span className="eyebrow">Pulse</span>
                    <h3>Daily traffic load</h3>
                  </div>
                  <small>{trafficAnalysis.avgPerDay} average rows per active day</small>
                </div>
                {trafficAnalysis.timeline.length ? (
                  <div className="traffic-analysis-bars">
                    {trafficAnalysis.timeline.map((item) => (
                      <div
                        key={item.date}
                        className="traffic-analysis-bars__item"
                        title={`${longDateLabel(item.date)}: ${item.count} traffic row${item.count === 1 ? "" : "s"}`}
                      >
                        <span>{dateParts(item.date).dayNumber}</span>
                        <div className="traffic-analysis-bars__track">
                          <div
                            className="traffic-analysis-bars__fill"
                            style={{ width: `${Math.max(10, Math.round((item.count / trafficAnalysisMaxDayCount) * 100))}%` }}
                          />
                        </div>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No traffic rows exist for this month yet.</div>
                )}
                {trafficAnalysisInsights.length ? (
                  <div className="traffic-analysis-insights traffic-analysis-insights--compact">
                    {trafficAnalysisInsights.map((item) => (
                      <div key={item} className="traffic-analysis-insights__item">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <TrafficAnalysisSection
                eyebrow="Brand split"
                title="Kia vs Mazda"
                summary={`${trafficAnalysis.brandCards[0]?.rows || 0} Kia · ${trafficAnalysis.brandCards[1]?.rows || 0} Mazda`}
                hint="Compares franchise traffic volume and note coverage for the selected month."
                defaultOpen
              >
                <div className="traffic-analysis-brand-list">
                  {trafficAnalysis.brandCards.map((item) => (
                    <div key={item.brand} className="traffic-analysis-brand-card">
                      <div className="traffic-analysis-brand-card__top">
                        <strong>{item.brand}</strong>
                        <span>{item.rows} rows</span>
                      </div>
                      <div className="traffic-analysis-brand-card__bar">
                        <div className="traffic-analysis-brand-card__bar-fill" style={{ width: `${item.share}%` }} />
                      </div>
                      <small>
                        {item.share}% of month volume · {item.noteCoverage}% notes saved
                      </small>
                    </div>
                  ))}
                </div>
              </TrafficAnalysisSection>

              <TrafficAnalysisSection
                eyebrow="Ownership"
                title="Top appointment owners"
                summary={trafficAnalysis.topAssignees[0] ? `${trafficAnalysis.topAssignees[0].label} leads` : "No owner data"}
                hint="Pulled from imported assignee or appointment-owner fields inside the traffic data."
              >
                {trafficAnalysis.topAssignees.length ? (
                  <div className="traffic-analysis-list">
                    {trafficAnalysis.topAssignees.map((item) => (
                      <div key={item.label} className="traffic-analysis-list__item">
                        <div>
                          <strong>{item.label}</strong>
                          <small>Imported appointment owner</small>
                        </div>
                        <b>{item.count}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">No assignee data found in the imported traffic yet.</div>
                )}
              </TrafficAnalysisSection>

              <TrafficAnalysisSection
                eyebrow="Execution"
                title="Note activity"
                summary={`${trafficAnalysis.topAuthors.length} active note author${trafficAnalysis.topAuthors.length === 1 ? "" : "s"}`}
                hint="Shows who is actually saving notes and the themes appearing most often in the note text."
              >
                <div className="traffic-analysis-list">
                  {trafficAnalysis.topAuthors.length ? (
                    trafficAnalysis.topAuthors.map((item) => (
                      <div key={item.label} className="traffic-analysis-list__item">
                        <div>
                          <strong>{item.label}</strong>
                          <small>Saved note author</small>
                        </div>
                        <b>{item.count}</b>
                      </div>
                    ))
                  ) : (
                    <div className="empty">No saved note authors yet for this month.</div>
                  )}
                </div>
                {trafficAnalysis.topTerms.length ? (
                  <div className="traffic-analysis-tags">
                    {trafficAnalysis.topTerms.map((item) => (
                      <span key={item.label} className="traffic-analysis-tag" title={`${item.count} notes mention ${item.label}`}>
                        {item.label} · {item.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </TrafficAnalysisSection>

              <TrafficAnalysisSection
                eyebrow="Follow-up queue"
                title="Rows still needing notes"
                summary={`${trafficAnalysis.pendingCount} open row${trafficAnalysis.pendingCount === 1 ? "" : "s"}`}
                hint="Traffic rows without a saved salesperson note yet. This is the fastest queue to work from."
              >
                {trafficAnalysis.pendingRows.length ? (
                  <div className="traffic-analysis-list">
                    {trafficAnalysis.pendingRows.map((entry) => (
                      <div
                        key={`pending-${entry.id}`}
                        className="traffic-analysis-list__item traffic-analysis-list__item--stacked"
                        title={`${entry.customer_name || "Unnamed customer"} · ${entry.brand} · ${[entry.traffic_date, entry.appointment_label].filter(Boolean).join(" · ")}`}
                      >
                        <div>
                          <strong>{entry.customer_name || "Unnamed customer"}</strong>
                          <small>
                            {[entry.traffic_date, entry.appointment_label].filter(Boolean).join(" · ") || "No appointment time"}
                          </small>
                        </div>
                        <b>{entry.brand}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Everything in this month already has notes saved.</div>
                )}
              </TrafficAnalysisSection>

              <div className="panel traffic-analysis-panel traffic-analysis-panel--chat">
                <div className="row">
                  <div>
                    <span className="eyebrow">Ask the data</span>
                    <h3>Traffic analysis chat</h3>
                  </div>
                  <small>Proof of concept Q&A on the live month dataset</small>
                </div>
                <div className="traffic-analysis-prompts">
                  {TRAFFIC_ANALYSIS_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" className="secondary" onClick={() => askTrafficAnalysisPrompt(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
                <div className="traffic-analysis-chat">
                  {trafficAnalysisMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`traffic-analysis-chat__bubble traffic-analysis-chat__bubble--${message.role}`}
                    >
                      <span>{message.role === "assistant" ? "Insight" : "Question"}</span>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>
                <form className="traffic-analysis-chat__form" onSubmit={submitTrafficAnalysisQuestion}>
                  <textarea
                    rows={3}
                    value={trafficAnalysisQuestion}
                    onChange={(event) => setTrafficAnalysisQuestion(event.target.value)}
                    placeholder="Ask: Which days were busiest, who still needs follow-up, or how Kia compares to Mazda."
                  />
                  <button type="submit" disabled={!trafficAnalysisQuestion.trim()}>
                    Ask About This Month
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "traffic" ? (
          <section className="stack">
            <div className="panel">
              <span className="eyebrow">Service drive traffic</span>
              <h2>Embedded traffic page</h2>
            </div>
            <div className="frame">
              <iframe title="Service Drive Traffic" src={TRAFFIC_URL} loading="lazy" />
            </div>
            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Traffic PDFs</span>
                  <h3>Uploaded documents</h3>
                </div>
              </div>
              {adminSession ? (
                <form className="upload-form" onSubmit={uploadTrafficPdf}>
                  <label>
                    <span>Document title</span>
                    <input
                      value={trafficPdfForm.title}
                      onChange={(event) => setTrafficPdfForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="March service traffic sheet"
                    />
                  </label>
                  <label>
                    <span>PDF file</span>
                    <input
                      key={trafficUploadKey}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setTrafficPdfForm((current) => ({ ...current, file: event.target.files?.[0] || null }))
                      }
                    />
                  </label>
                  <button type="submit" disabled={busy === "upload-traffic-pdf"}>
                    {busy === "upload-traffic-pdf" ? "Uploading..." : "Upload PDF"}
                  </button>
                </form>
              ) : null}

              <div className="asset-list">
                {trafficPdfs.length ? (
                  trafficPdfs.map((entry) => (
                    <article key={entry.id} className="asset-card">
                      <div>
                        <span className="eyebrow">PDF</span>
                        <h4>{entry.title}</h4>
                        <p>{entry.original_filename}</p>
                      </div>
                      <a className="asset-link" href={assetUrl(entry.file_url)} target="_blank" rel="noreferrer">
                        Open PDF
                      </a>
                    </article>
                  ))
                ) : (
                  <div className="empty">No traffic PDFs uploaded yet.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "freshUp" ? (
          <section className={`stack freshup-shell ${freshUpCardMode ? "freshup-shell--card" : ""}`}>
            {!freshUpCardMode ? (
              <div className="panel freshup-hero">
                <div>
                  <span className="eyebrow">Freshup Log</span>
                  <h2>Fast contact capture for the lot.</h2>
                  <p>
                    This is now a lightweight mobile-first log. Pick the salesperson, capture the customer name and phone,
                    and everything lands in the running log below.
                  </p>
                </div>
                <div className="freshup-hero__status">
                  <span>Ready state</span>
                  <strong>{freshUpFilledCount}/3 filled</strong>
                  <small>Optimized for quick desk or lot entry.</small>
                </div>
              </div>
            ) : null}

            <div className="freshup-layout">
              <form
                className={`panel freshup-capture ${freshUpCardMode ? "freshup-capture--card" : ""}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  submitFreshUpLog();
                }}
              >
                {freshUpCardMode ? (
                  <div className="freshup-card-intro">
                    <div className="freshup-brand-stack">
                      <div className="freshup-brand-avatar">
                        <img src="/logo-facebook.png" alt="Bert Ogden heart logo" />
                      </div>
                      <div className="freshup-brand-mark">
                        <img
                          src={freshUpPrimaryBrand.logo}
                          alt={`${freshUpPrimaryStore?.dealership || "Bert Ogden"} logo`}
                          className={
                            freshUpPrimaryStore?.dealership === "Outlet"
                              ? "freshup-brand-mark__image freshup-brand-mark__image--rounded"
                              : "freshup-brand-mark__image"
                          }
                        />
                        <span>{freshUpPrimaryStore?.display_name || freshUpAssignedSalesperson?.dealership || "Bert Ogden Mission"}</span>
                      </div>
                    </div>
                    <span className="eyebrow">Contact {freshUpAssignedSalesperson?.name || "Our Team"}</span>
                    <h2>{freshUpAssignedSalesperson?.name || freshUpLinksConfig.page_title}</h2>
                    <p>{freshUpLinksConfig.page_subtitle}</p>
                    <div className="freshup-contact-strip">
                      <strong>{freshUpPrimaryStore?.display_name || "Bert Ogden Mission"}</strong>
                      <span>{freshUpLinksConfig.form_subtitle}</span>
                    </div>
                  </div>
                ) : null}
                {!freshUpCardMode ? (
                  <div className="freshup-capture__header">
                    <div>
                      <span className="eyebrow">Quick Entry</span>
                      <h3>Fresh up input</h3>
                    </div>
                    <button type="button" className="secondary" onClick={resetFreshUpForm}>
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="freshup-capture__header freshup-capture__header--compact">
                    <div>
                      <h3>{freshUpLinksConfig.form_title}</h3>
                    </div>
                  </div>
                )}

                <div className="freshup-form">
                  <label>
                    <span>{freshUpCardMode ? "Your Name" : "Customer Name"}</span>
                    <input
                      value={freshUpForm.customerName}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder={freshUpCardMode ? "Enter your name" : "Full name"}
                      autoComplete="name"
                    />
                  </label>

                  <label>
                    <span>{freshUpCardMode ? "Best Phone Number" : "Phone Number"}</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={freshUpForm.phone}
                      onChange={(event) =>
                        setFreshUpForm((current) => ({ ...current, phone: formatPhoneInput(event.target.value) }))
                      }
                      placeholder={freshUpCardMode ? "(956) 555-1234" : "(956) 555-1234"}
                    />
                  </label>

                  {freshUpCardMode ? (
                    <div className="freshup-lockbox freshup-lockbox--customer">
                      <strong>{freshUpAssignedSalesperson?.name || "Salesperson not set"}</strong>
                      <small>{freshUpAssignedSalesperson?.dealership || "This NFC link needs a salesperson selected."}</small>
                    </div>
                  ) : (
                    <label>
                      <span>Salesperson</span>
                      <input
                        list="freshup-salespeople"
                        value={freshUpForm.salespersonQuery}
                        onChange={(event) => applyFreshUpSalespersonQuery(event.target.value)}
                        placeholder="Start typing the salesperson name"
                        autoComplete="off"
                      />
                      <small>
                        {freshUpAssignedSalesperson
                          ? `Matched to ${freshUpAssignedSalesperson.name} · ${freshUpAssignedSalesperson.dealership}`
                          : "Type the salesperson name and pick the match."}
                      </small>
                    </label>
                  )}

                  <datalist id="freshup-salespeople">
                    {activeSales.map((person) => (
                      <option key={`freshup-person-${person.id}`} value={person.name}>
                        {person.dealership}
                      </option>
                    ))}
                  </datalist>

                  <div className="freshup-actions">
                    <button
                      type="submit"
                      disabled={busy === "freshup-submit" || !freshUpAssignedSalesperson || !freshUpForm.customerName || !freshUpForm.phone}
                    >
                      {busy === "freshup-submit" ? "Saving..." : freshUpCardMode ? freshUpLinksConfig.submit_label : "Log Freshup"}
                    </button>
                    {!freshUpCardMode ? (
                      <button type="button" className="secondary" onClick={copyFreshUpSummary}>
                        Copy Recap
                      </button>
                    ) : null}
                  </div>

                  {freshUpStatus ? <div className="notice success">{freshUpStatus}</div> : null}
                </div>
              </form>

              <div id={freshUpCardMode ? "freshup-links" : undefined} className={`panel freshup-nfc ${freshUpCardMode ? "freshup-nfc--card" : ""}`}>
                <span className="eyebrow">{freshUpCardMode ? "Helpful Links" : "NFC Card Side"}</span>
                <h3>{freshUpCardMode ? freshUpPrimaryStore?.display_name || freshUpLinksConfig.page_title : "Program one link per salesperson"}</h3>
                <p>
                  {freshUpCardMode
                    ? "Use the links below for financing, inventory, maps, or a direct call."
                    : "Put this link on the NFC business card. When a customer taps, it opens a customer-facing landing page with contact capture at the top and the right links underneath."}
                </p>
                {!freshUpCardMode ? (
                  <>
                    <div className="freshup-nfc__link">
                      <strong>{freshUpAssignedSalesperson?.name || "Select a salesperson first"}</strong>
                      <code>{freshUpCardHref || "Pick a salesperson to generate the NFC link."}</code>
                    </div>
                    <div className="freshup-actions">
                      <button type="button" onClick={copyFreshUpCardLink} disabled={!freshUpCardHref}>
                        Copy NFC Link
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => window.open(freshUpCardHref, "_blank", "noopener,noreferrer")}
                        disabled={!freshUpCardHref}
                      >
                        Preview Tap Page
                      </button>
                    </div>
                    <div className="marketplace-callout">
                      <strong>How the tap works</strong>
                      <span>
                        The NFC card just opens a URL. This page collects the name and phone number, tags the salesperson, and drops the entry into
                        the log below.
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="freshup-store-grid">
                  {freshUpStoreCards.map((store) => {
                    const brand = freshUpStoreBrandMeta(store.dealership);
                    const socials = FRESHUP_SOCIAL_LINKS.filter(({ key }) => String(store[key] || "").trim());
                    const isPrimary = store.dealership === freshUpAssignedSalesperson?.dealership;
                    return (
                      <article
                        key={store.dealership}
                        className={`freshup-store-card ${isPrimary ? "freshup-store-card--primary" : ""}`}
                        style={{ "--freshup-accent": brand.accent, "--freshup-tint": brand.tint }}
                      >
                        <div className="freshup-store-card__header">
                          <div className="freshup-store-card__brand">
                            <span className="freshup-store-card__logo-wrap">
                              <img
                                src={brand.logo}
                                alt={`${store.dealership} logo`}
                                className={store.dealership === "Outlet" ? "freshup-store-card__logo freshup-store-card__logo--rounded" : "freshup-store-card__logo"}
                              />
                            </span>
                            <div>
                              <span className="eyebrow">{isPrimary ? "Primary Store" : brand.badge}</span>
                              <h4>{store.display_name}</h4>
                              <p>Financing shortcuts and inventory links for {store.display_name}.</p>
                            </div>
                          </div>
                        </div>
                        {socials.length ? (
                          <div className="freshup-social-row freshup-social-row--card">
                            {socials.map((item) => (
                              <a
                                key={`${store.dealership}-${item.key}`}
                                className="freshup-social-pill"
                                href={store[item.key]}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`${store.display_name} ${item.label}`}
                                onClick={() =>
                                  trackFreshUpEvent({
                                    eventType: "link_click",
                                    linkType: item.key.replace("_url", ""),
                                    targetUrl: store[item.key],
                                    storeDealership: store.dealership,
                                  })
                                }
                              >
                                <span>{item.icon}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                        <div className="freshup-store-card__actions">
                          {store.maps_url ? (
                            <a
                              className="freshup-link-btn freshup-link-btn--dark"
                              href={store.maps_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() =>
                                trackFreshUpEvent({
                                  eventType: "link_click",
                                  linkType: "maps",
                                  targetUrl: store.maps_url,
                                  storeDealership: store.dealership,
                                })
                              }
                            >
                              {store.maps_label || "Google Maps"}
                            </a>
                          ) : null}
                          {store.call_url ? (
                            <a
                              className="freshup-link-btn freshup-link-btn--blue"
                              href={store.call_url}
                              onClick={() =>
                                trackFreshUpEvent({
                                  eventType: "link_click",
                                  linkType: "call",
                                  targetUrl: store.call_url,
                                  storeDealership: store.dealership,
                                })
                              }
                            >
                              {store.call_label || "Call Now"}
                            </a>
                          ) : null}
                          <a
                            className="freshup-link-btn"
                            href={store.soft_pull_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackFreshUpEvent({
                                eventType: "link_click",
                                linkType: "soft_pull",
                                targetUrl: store.soft_pull_url,
                                storeDealership: store.dealership,
                              })
                            }
                          >
                            {store.soft_pull_label}
                          </a>
                          <a
                            className="freshup-link-btn"
                            href={store.hard_pull_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackFreshUpEvent({
                                eventType: "link_click",
                                linkType: "hard_pull",
                                targetUrl: store.hard_pull_url,
                                storeDealership: store.dealership,
                              })
                            }
                          >
                            {store.hard_pull_label}
                          </a>
                          <a
                            className="freshup-link-btn freshup-link-btn--soft"
                            href={store.inventory_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() =>
                              trackFreshUpEvent({
                                eventType: "link_click",
                                linkType: "inventory",
                                targetUrl: store.inventory_url,
                                storeDealership: store.dealership,
                              })
                            }
                          >
                            {store.inventory_label}
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>

            {!freshUpCardMode ? (
              <div className="panel freshup-log-panel">
                <div className="row">
                  <div>
                    <span className="eyebrow">Live Log</span>
                    <h3>Newest freshups first</h3>
                  </div>
                  <small>{freshUpLog.total} total logged</small>
                </div>
                <FreshUpLogList entries={freshUpLog.entries} empty="No freshups logged yet." />
              </div>
            ) : null}
          </section>
        ) : null}

        {false && tab === "freshUp" ? (
          <section className="stack fresh-up-section">
            <div className="panel fresh-up-hero">
              <div>
                <span className="eyebrow">Fresh Up Quick Add</span>
                <h2>Capture the walk-in before it slips.</h2>
                <p>
                  This is a fast intake board for reps or managers. Add the guest basics, assign the salesperson, then
                  copy a clean handoff summary for text, CRM notes, or a desk turn.
                </p>
              </div>
              <div className="fresh-up-hero__status">
                <span>Draft strength</span>
                <strong>{freshUpFilledCount}/7 key fields</strong>
                <small>Saved in this browser automatically while you type.</small>
              </div>
            </div>

            <div className="fresh-up-grid">
              <div className="panel fresh-up-card">
                <div className="fresh-up-card__header">
                  <div>
                    <span className="eyebrow">Quick intake</span>
                    <h3>Guest basics</h3>
                  </div>
                  <button type="button" className="secondary" onClick={resetFreshUpForm}>
                    Start Clean
                  </button>
                </div>

                <div className="fresh-up-form-grid">
                  <label>
                    Customer Name
                    <input
                      value={freshUpForm.customerName}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, customerName: event.target.value }))}
                      placeholder="Customer full name"
                    />
                  </label>
                  <label>
                    Phone
                    <input
                      value={freshUpForm.phone}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Best callback number"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={freshUpForm.email}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Email address"
                    />
                  </label>
                  <label>
                    Salesperson
                    <select
                      value={freshUpForm.salespersonId}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, salespersonId: event.target.value }))}
                    >
                      <option value="">Select salesperson</option>
                      {activeSales.map((person) => (
                        <option key={`fresh-up-sales-${person.id}`} value={person.id}>
                          {person.name} · {person.dealership}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Vehicle Interest
                    <input
                      value={freshUpForm.vehicleInterest}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, vehicleInterest: event.target.value }))}
                      placeholder="2024 Kia Telluride EX"
                    />
                  </label>
                  <label>
                    Stock Number
                    <input
                      value={freshUpForm.stockNumber}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, stockNumber: event.target.value }))}
                      placeholder="Stock or VIN shortcut"
                    />
                  </label>
                  <label>
                    Lead Source
                    <select
                      value={freshUpForm.source}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, source: event.target.value }))}
                    >
                      <option value="Walk-in">Walk-in</option>
                      <option value="Phone Up">Phone Up</option>
                      <option value="Be Back">Be Back</option>
                      <option value="Internet">Internet</option>
                      <option value="Referral">Referral</option>
                    </select>
                  </label>
                  <label>
                    Trade-In
                    <select
                      value={freshUpForm.tradeIn}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, tradeIn: event.target.value }))}
                    >
                      <option value="Unknown">Unknown</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </label>
                  <label>
                    Next Step
                    <select
                      value={freshUpForm.nextStep}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, nextStep: event.target.value }))}
                    >
                      <option value="Needs TO">Needs TO</option>
                      <option value="Needs Appraisal">Needs Appraisal</option>
                      <option value="Needs Numbers">Needs Numbers</option>
                      <option value="Appointment Set">Appointment Set</option>
                      <option value="Follow Up">Follow Up</option>
                    </select>
                  </label>
                  <label className="fresh-up-form-grid__wide">
                    Notes
                    <textarea
                      value={freshUpForm.notes}
                      onChange={(event) => setFreshUpForm((current) => ({ ...current, notes: event.target.value }))}
                      placeholder="Trade details, objections, payment target, desk notes, or what happened on the lot."
                    />
                  </label>
                </div>
              </div>

              <div className="panel fresh-up-card fresh-up-card--preview">
                <div className="fresh-up-card__header">
                  <div>
                    <span className="eyebrow">Clipboard output</span>
                    <h3>Ready-to-paste handoff</h3>
                  </div>
                  <button type="button" onClick={copyFreshUpSummary}>
                    Copy Summary
                  </button>
                </div>

                <div className="fresh-up-chip-row">
                  <div className="fresh-up-chip">
                    <span>Assigned</span>
                    <strong>{freshUpAssignedSalesperson?.name || "Open"}</strong>
                  </div>
                  <div className="fresh-up-chip">
                    <span>Lead Source</span>
                    <strong>{freshUpForm.source}</strong>
                  </div>
                  <div className="fresh-up-chip">
                    <span>Next Step</span>
                    <strong>{freshUpForm.nextStep}</strong>
                  </div>
                </div>

                <pre className="fresh-up-summary">{freshUpSummary}</pre>

                <div className="fresh-up-callout">
                  <strong>{freshUpCopiedAt ? `Copied ${dateTimeLabel(freshUpCopiedAt)}` : "One-click copy"}</strong>
                  <span>Use the summary for CRM notes, a manager handoff, text follow-up, or a fast desk recap.</span>
                </div>
              </div>
            </div>

            <div className="panel fresh-up-playbook">
              <div className="fresh-up-playbook__item">
                <span className="eyebrow">Best use</span>
                <h3>Lot traffic and handoffs</h3>
                <p>Keep this open on a desktop or iPad and fill it in while the guest is still in front of you.</p>
              </div>
              <div className="fresh-up-playbook__item">
                <span className="eyebrow">What it solves</span>
                <h3>No more scratch-paper loss</h3>
                <p>The draft stays in the browser until you clear it, so quick ups do not disappear between turns.</p>
              </div>
              <div className="fresh-up-playbook__item">
                <span className="eyebrow">Next build</span>
                <h3>Easy to wire deeper</h3>
                <p>This can later post into a CRM, BDC log, or Marketplace flow once you decide the destination.</p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "marketplace" ? (
          <section className="stack marketplace-section">
            <div className="panel marketplace-hero">
              <span className="eyebrow">Facebook Marketplace</span>
              <h2>One-click posting flow for reps</h2>
              <p>
                Facebook still has to be finished inside Facebook, but reps should only need one main action now:
                open the vehicle page, click `Quick Post Current Vehicle`, and let the helper open Marketplace and
                try to fill the form automatically.
              </p>
            </div>

            <div className="marketplace-grid">
              <div className="panel marketplace-card">
                <span className="eyebrow">Step 1</span>
                <h3>Install the Chrome extension once</h3>
                    <a className="asset-link" href="/facebook-marketplace-extension.zip?v=0.5.0" download>
                  Download Extension Zip
                </a>
                <div className="marketplace-helper-strip">
                  <span>Then open `chrome://extensions/` in Chrome.</span>
                  <button type="button" className="secondary" onClick={copyChromeExtensionsLink}>
                    Copy link
                  </button>
                </div>
                <ol className="numbered-list">
                  <li>Download the zip above</li>
                  <li>Unzip it anywhere on your computer</li>
                  <li>Open `chrome://extensions`</li>
                  <li>Turn on Developer Mode</li>
                  <li>Click `Load unpacked`</li>
                  <li>Select the unzipped `facebook-marketplace-extension` folder</li>
                </ol>
                <div className="marketplace-callout">
                  <strong>No rep setup</strong>
                  <span>The helper already defaults to the right API. No extra plugin is needed. If it was loaded unpacked before, just click Reload in `chrome://extensions` instead of deleting it.</span>
                </div>
                <p className="admin-note">Chrome does not let the website turn on Developer Mode for the user. That part still has to be clicked manually once.</p>
                {marketplaceGuideStatus ? <div className="notice">{marketplaceGuideStatus}</div> : null}
              </div>

              <div className="panel marketplace-card">
                <span className="eyebrow">Step 2</span>
                <h3>Daily rep workflow</h3>
                <ol className="numbered-list">
                  <li>Open the Bert Ogden vehicle page in Chrome</li>
                  <li>Click the extension and press `Quick Post Current Vehicle`</li>
                  <li>The helper downloads the vehicle photos and opens Facebook Marketplace automatically</li>
                  <li>Let the helper try to fill the Facebook form and queue the photo upload for you</li>
                  <li>Review the listing and finish the post manually</li>
                </ol>
                <div className="marketplace-callout">
                  <strong>Main improvement</strong>
                  <span>Reps should not need to write a caption by hand or save photos one by one before posting.</span>
                </div>
              </div>

              <div className="panel marketplace-card">
                <span className="eyebrow">Step 3</span>
                <h3>What still needs attention</h3>
                <ul className="feature-list">
                  <li>Year, make, and model</li>
                  <li>Bert Ogden price when available</li>
                  <li>Mileage</li>
                  <li>VIN</li>
                  <li>Condition and vehicle-focused draft text</li>
                  <li>Vehicle page URL</li>
                  <li>Available gallery images from the vehicle page</li>
                </ul>
                <div className="marketplace-callout">
                  <strong>Still needs review</strong>
                  <span>Facebook can still change its form. If something misses, the helper panel on the page can retry the draft fill and show what was or was not applied.</span>
                </div>
              </div>
            </div>

            <div className="panel marketplace-template-preview">
              <span className="eyebrow">Current template</span>
              <h3>Admin-controlled post content</h3>
              <div className="marketplace-template-grid">
                <div>
                  <span className="eyebrow">Title template</span>
                  <pre>{marketplaceBuilderTemplate.title_template}</pre>
                </div>
                <div>
                  <span className="eyebrow">Description template</span>
                  <pre>{marketplaceBuilderTemplate.description_template}</pre>
                </div>
              </div>
              <p className="admin-note">
                Vehicle details come from the live inventory page. Admin wording is limited to headline framing, the price
                label, the CTA line, and whether mileage, VIN, and the vehicle link should be included.
              </p>
            </div>
          </section>
        ) : null}

        {tab === "quote" ? (
          <section className="stack quote-section">
            <div className="panel quote-hero">
              <span className="eyebrow">Quote Tool</span>
              <h2>Payment estimate on the fly</h2>
              <p>
                This calculator uses the standard amortization formula to estimate a monthly payment. It includes MSRP,
                trade equity, down payment, taxes, fees, term, optional VAP, and the APR from your credit tier.
              </p>
            </div>

            <div className="panel quote-grid">
              <div className="quote-form">
                <div className="quote-form__section">
                  <span className="eyebrow">Vehicle</span>
                  <label>
                    <span>Brand</span>
                    <select
                      value={quoteForm.brand}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, brand: event.target.value }))}
                    >
                      {QUOTE_BRANDS.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>MSRP</span>
                    <input
                      inputMode="decimal"
                      placeholder="45,000"
                      value={quoteForm.msrp}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, msrp: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="quote-form__section">
                  <span className="eyebrow">Customer</span>
                  <label>
                    <span>Estimated credit score</span>
                    <input
                      inputMode="numeric"
                      placeholder="720"
                      value={quoteForm.creditScore}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, creditScore: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Trade-in equity</span>
                    <input
                      inputMode="decimal"
                      placeholder="5,000"
                      value={quoteForm.tradeEquity}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, tradeEquity: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Down payment</span>
                    <input
                      inputMode="decimal"
                      placeholder="2,500"
                      value={quoteForm.downPayment}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, downPayment: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="quote-form__section">
                  <span className="eyebrow">Taxes & Fees</span>
                  <label>
                    <span>Tax rate (%)</span>
                    <input
                      inputMode="decimal"
                      placeholder="8.25"
                      value={quoteForm.taxRate}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, taxRate: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Fees (total)</span>
                    <input
                      inputMode="decimal"
                      placeholder="1,250"
                      value={quoteForm.fees}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, fees: event.target.value }))}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={quoteForm.vapIncluded}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, vapIncluded: event.target.checked }))}
                    />
                    <span>VAP package included</span>
                  </label>
                  {quoteForm.vapIncluded ? (
                    <label>
                      <span>VAP amount</span>
                      <input
                        inputMode="decimal"
                        placeholder="1,995"
                        value={quoteForm.vapAmount}
                        onChange={(event) => setQuoteForm((current) => ({ ...current, vapAmount: event.target.value }))}
                      />
                    </label>
                  ) : null}
                </div>

                <div className="quote-form__section">
                  <span className="eyebrow">Term</span>
                  <label>
                    <span>Term (months)</span>
                    <input
                      inputMode="numeric"
                      placeholder="72"
                      value={quoteForm.months}
                      onChange={(event) => setQuoteForm((current) => ({ ...current, months: event.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="quote-result">
                <div>
                  <span className="eyebrow">Estimated payment</span>
                  <h2>{quoteMonths > 0 ? formatMoney(quotePayment) : "$0.00"}</h2>
                </div>
                <div className="quote-metrics">
                  <div className="quote-metric">
                    <span>Credit tier</span>
                    <strong>{selectedQuoteTier || "Enter score"}</strong>
                  </div>
                  <div className="quote-metric">
                    <span>APR</span>
                    <strong>{selectedQuoteTier ? `${selectedQuoteApr.toFixed(2)}%` : "Set score"}</strong>
                  </div>
                  <div className="quote-metric">
                    <span>Amount financed</span>
                    <strong>{formatMoney(quotePrincipal)}</strong>
                  </div>
                  <div className="quote-metric">
                    <span>Total interest</span>
                    <strong>{formatMoney(quoteTotalInterest)}</strong>
                  </div>
                  <div className="quote-metric">
                    <span>Taxes</span>
                    <strong>{formatMoney(quoteTax)}</strong>
                  </div>
                  <div className="quote-metric">
                    <span>Fees + VAP</span>
                    <strong>{formatMoney(quoteFees + quoteVap)}</strong>
                  </div>
                </div>
                <p className="quote-footnote">
                  Rates are controlled by Admin &gt; Quote Rates. Tax is applied to MSRP minus trade equity. Adjust if your
                  lender uses a different taxable base.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "specials" ? (
          <section className="stack">
            <div className="panel">
              <span className="eyebrow">Specials</span>
              <h2>Offer tiles</h2>
            </div>

            {selectedSpecial ? (
              <div className="panel specials-hero">
                <div className="specials-hero__copy">
                  <span className="eyebrow">{selectedSpecial.tag}</span>
                  <h2>{selectedSpecial.title}</h2>
                  <p>Click any tile below to switch the current offer.</p>
                </div>
                <div className="specials-hero__media">
                  <img src={assetUrl(selectedSpecial.image_url)} alt={selectedSpecial.title} />
                </div>
              </div>
            ) : (
              <div className="empty">No specials uploaded yet.</div>
            )}

            <div className="specials-grid">
              {specials.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`special-card ${selectedSpecial?.id === item.id ? "is-active" : ""}`}
                  onClick={() => setSelectedSpecialId(item.id)}
                >
                  <img src={assetUrl(item.image_url)} alt={item.title} />
                  <div className="special-card__copy">
                    <span>{item.tag}</span>
                    <strong>{item.title}</strong>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "admin" ? (
          <section className="stack">
            {!adminSession ? (
              <div className="panel">
                <span className="eyebrow">Admin login</span>
                <h2>Sign in to manage the roster</h2>
                <form className="form" onSubmit={handleLogin}>
                  <label>
                    <span>Username</span>
                    <input
                      value={login.username}
                      onChange={(event) => setLogin((current) => ({ ...current, username: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={login.password}
                      onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                    />
                  </label>
                  <button type="submit" disabled={busy === "login"}>
                    {busy === "login" ? "Signing in..." : "Sign In"}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="panel row">
                  <div>
                    <span className="eyebrow">Admin unlocked</span>
                    <h2>{adminSession.username}</h2>
                  </div>
                  <button type="button" className="secondary" onClick={logout}>
                    Sign Out
                  </button>
                </div>

                <div className="subtabs">
                  {ADMIN_SECTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`subtab ${adminSection === item.id ? "is-active" : ""}`}
                      onClick={() => setAdminSection(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {adminSection === "staff" ? (
                  <>
                    <div className="admin-grid">
                      <div className="panel">
                        <span className="eyebrow">Add salesperson</span>
                        <form className="form" onSubmit={addSalesperson}>
                          <label>
                            <span>Name</span>
                            <input
                              value={salesForm.name}
                              onChange={(event) => setSalesForm((current) => ({ ...current, name: event.target.value }))}
                            />
                          </label>
                          <label>
                            <span>Dealership</span>
                            <select
                              value={salesForm.dealership}
                              onChange={(event) =>
                                setSalesForm((current) => ({ ...current, dealership: event.target.value }))
                              }
                            >
                              <option value="Kia">Kia</option>
                              <option value="Mazda">Mazda</option>
                              <option value="Outlet">Outlet</option>
                            </select>
                          </label>
                          <label>
                            <span>Phone number for text alerts</span>
                            <input
                              value={salesForm.phone_number}
                              onChange={(event) =>
                                setSalesForm((current) => ({ ...current, phone_number: event.target.value }))
                              }
                              placeholder="(956) 555-1234"
                            />
                          </label>
                          <label>
                            <span>Email for assignment alerts</span>
                            <input
                              type="email"
                              value={salesForm.email}
                              onChange={(event) => setSalesForm((current) => ({ ...current, email: event.target.value }))}
                              placeholder="rep@bertogden.com"
                            />
                          </label>
                          <div className="notification-toggle-grid">
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={salesForm.notify_sms}
                                onChange={(event) =>
                                  setSalesForm((current) => ({ ...current, notify_sms: event.target.checked }))
                                }
                              />
                              <span>Notify by text</span>
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={salesForm.notify_email}
                                onChange={(event) =>
                                  setSalesForm((current) => ({ ...current, notify_email: event.target.checked }))
                                }
                              />
                              <span>Notify by email</span>
                            </label>
                          </div>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={salesForm.active}
                              onChange={(event) => setSalesForm((current) => ({ ...current, active: event.target.checked }))}
                            />
                            <span>Active</span>
                          </label>
                          <button type="submit" disabled={busy === "add-sales"}>
                            {busy === "add-sales" ? "Adding..." : "Add Salesperson"}
                          </button>
                        </form>
                      </div>

                      <div className="panel">
                        <span className="eyebrow">Add BDC agent</span>
                        <form className="form" onSubmit={addBdcAgent}>
                          <label>
                            <span>Name</span>
                            <input
                              value={bdcForm.name}
                              onChange={(event) => setBdcForm((current) => ({ ...current, name: event.target.value }))}
                            />
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={bdcForm.active}
                              onChange={(event) => setBdcForm((current) => ({ ...current, active: event.target.checked }))}
                            />
                            <span>Active</span>
                          </label>
                          <button type="submit" disabled={busy === "add-bdc"}>
                            {busy === "add-bdc" ? "Adding..." : "Add BDC Agent"}
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="panel notification-setup-panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Lead notifications</span>
                          <h3>Assignment alerts setup</h3>
                        </div>
                      </div>
                      <div className="notification-status-grid">
                        <div className={`notification-status-card ${notificationConfig.sms_configured ? "is-ready" : "is-missing"}`}>
                          <span className="eyebrow">Text</span>
                          <strong>{notificationConfig.sms_provider}</strong>
                          <small>
                            {notificationConfig.sms_configured
                              ? "Ready to send assignment texts."
                              : "Needs Twilio env vars before texts can go out."}
                          </small>
                        </div>
                        <div
                          className={`notification-status-card ${notificationConfig.email_configured ? "is-ready" : "is-missing"}`}
                        >
                          <span className="eyebrow">Email</span>
                          <strong>{notificationConfig.email_provider}</strong>
                          <small>
                            {notificationConfig.email_configured
                              ? "Ready to send assignment emails."
                              : "Needs Resend env vars before emails can go out."}
                          </small>
                        </div>
                      </div>
                      <div className="notification-setup-list">
                        <div>
                          <strong>Text setup</strong>
                          <small>`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`</small>
                        </div>
                        <div>
                          <strong>Email setup</strong>
                          <small>`RESEND_API_KEY`, `BDC_NOTIFY_EMAIL_FROM`, `BDC_NOTIFY_EMAIL_REPLY_TO` (optional)</small>
                        </div>
                      </div>
                      <div className="notification-test-grid">
                        <form className="notification-test-form" onSubmit={submitSmsTest}>
                          <label>
                            <span>Send a test text</span>
                            <input
                              type="tel"
                              value={smsTestPhone}
                              onChange={(event) => {
                                setSmsTestPhone(event.target.value);
                                setSmsTestFeedback(null);
                              }}
                              placeholder="(956) 555-1234 or +19565551234"
                            />
                          </label>
                          <div className="notification-test-actions">
                            <button
                              type="submit"
                            disabled={
                              busy === "notification-sms-test" ||
                              !notificationConfig.sms_configured ||
                              !smsTestPhone.trim()
                            }
                          >
                            {busy === "notification-sms-test" ? "Sending..." : "Send test text"}
                          </button>
                          <small>Uses the current Twilio sender number from Render.</small>
                        </div>
                        {smsTestFeedback ? (
                          <div
                            className={`notification-test-feedback ${
                              smsTestFeedback.kind === "error" ? "is-error" : "is-success"
                            }`}
                          >
                            {smsTestFeedback.message}
                          </div>
                        ) : null}
                      </form>
                      <form className="notification-test-form" onSubmit={submitEmailTest}>
                        <label>
                          <span>Send a test email</span>
                          <input
                            type="email"
                            value={emailTestAddress}
                            onChange={(event) => {
                              setEmailTestAddress(event.target.value);
                              setEmailTestFeedback(null);
                            }}
                            placeholder="you@example.com"
                          />
                        </label>
                        <div className="notification-test-actions">
                          <button
                            type="submit"
                            disabled={
                              busy === "notification-email-test" ||
                              !notificationConfig.email_configured ||
                              !emailTestAddress.trim()
                            }
                          >
                            {busy === "notification-email-test" ? "Sending..." : "Send test email"}
                          </button>
                          <small>Uses the current Resend sender from Render.</small>
                        </div>
                        {emailTestFeedback ? (
                          <div
                            className={`notification-test-feedback ${
                              emailTestFeedback.kind === "error" ? "is-error" : "is-success"
                            }`}
                          >
                            {emailTestFeedback.message}
                          </div>
                        ) : null}
                      </form>
                    </div>
                    </div>

                    <div className="panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Salespeople by store</span>
                          <h3>Roster columns</h3>
                        </div>
                      </div>
                      <div className="store-roster-grid">
                        {dealershipColumns.map((group) => (
                          <section key={group.dealership} className="store-column">
                            <div className="store-column__header">
                              <div>
                                <span className="eyebrow">{group.dealership}</span>
                                <h4>{group.dealership}</h4>
                              </div>
                              <b>{group.people.length}</b>
                            </div>
                            <div className="editor-list">
                              {group.people.length ? (
                                group.people.map((person) => (
                                  <EditorCard key={person.id} title={person.name}>
                                    <div className="form compact">
                                      <label>
                                        <span>Name</span>
                                        <input
                                          value={person.name}
                                          onChange={(event) =>
                                            setSalespeople((current) =>
                                              current.map((item) =>
                                                item.id === person.id ? { ...item, name: event.target.value } : item
                                              )
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>Dealership</span>
                                        <select
                                          value={person.dealership}
                                          onChange={(event) =>
                                            setSalespeople((current) =>
                                              current.map((item) =>
                                                item.id === person.id ? { ...item, dealership: event.target.value } : item
                                              )
                                            )
                                          }
                                        >
                                          <option value="Kia">Kia</option>
                                          <option value="Mazda">Mazda</option>
                                          <option value="Outlet">Outlet</option>
                                        </select>
                                      </label>
                                      <label>
                                        <span>Phone number</span>
                                        <input
                                          value={person.phone_number || ""}
                                          onChange={(event) =>
                                            setSalespeople((current) =>
                                              current.map((item) =>
                                                item.id === person.id ? { ...item, phone_number: event.target.value } : item
                                              )
                                            )
                                          }
                                          placeholder="(956) 555-1234"
                                        />
                                      </label>
                                      <label>
                                        <span>Email</span>
                                        <input
                                          type="email"
                                          value={person.email || ""}
                                          onChange={(event) =>
                                            setSalespeople((current) =>
                                              current.map((item) =>
                                                item.id === person.id ? { ...item, email: event.target.value } : item
                                              )
                                            )
                                          }
                                          placeholder="rep@bertogden.com"
                                        />
                                      </label>
                                      <div className="notification-toggle-grid">
                                        <label className="checkbox">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(person.notify_sms)}
                                            onChange={(event) =>
                                              setSalespeople((current) =>
                                                current.map((item) =>
                                                  item.id === person.id ? { ...item, notify_sms: event.target.checked } : item
                                                )
                                              )
                                            }
                                          />
                                          <span>Text alerts</span>
                                        </label>
                                        <label className="checkbox">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(person.notify_email)}
                                            onChange={(event) =>
                                              setSalespeople((current) =>
                                                current.map((item) =>
                                                  item.id === person.id ? { ...item, notify_email: event.target.checked } : item
                                                )
                                              )
                                            }
                                          />
                                          <span>Email alerts</span>
                                        </label>
                                      </div>
                                      <label className="checkbox">
                                        <input
                                          type="checkbox"
                                          checked={person.active}
                                          onChange={(event) =>
                                            setSalespeople((current) =>
                                              current.map((item) =>
                                                item.id === person.id ? { ...item, active: event.target.checked } : item
                                              )
                                            )
                                          }
                                        />
                                        <span>Active</span>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => saveSalesperson(person)}
                                        disabled={busy === `sales-${person.id}`}
                                      >
                                        {busy === `sales-${person.id}` ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </EditorCard>
                                ))
                              ) : (
                                <div className="empty">No {group.dealership} salespeople yet.</div>
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>

                    <div className="panel">
                      <span className="eyebrow">Edit BDC agents</span>
                      <div className="editor-list editor-list--two-up">
                        {bdcAgents.map((agent) => (
                          <EditorCard key={agent.id} title={agent.name}>
                            <div className="form compact">
                              <label>
                                <span>Name</span>
                                <input
                                  value={agent.name}
                                  onChange={(event) =>
                                    setBdcAgents((current) =>
                                      current.map((item) =>
                                        item.id === agent.id ? { ...item, name: event.target.value } : item
                                      )
                                    )
                                  }
                                />
                              </label>
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={agent.active}
                                  onChange={(event) =>
                                    setBdcAgents((current) =>
                                      current.map((item) =>
                                        item.id === agent.id ? { ...item, active: event.target.checked } : item
                                      )
                                    )
                                  }
                                />
                                <span>Active</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => saveBdcAgent(agent)}
                                disabled={busy === `bdc-${agent.id}`}
                              >
                                {busy === `bdc-${agent.id}` ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </EditorCard>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {adminSection === "daysOff" ? (
                  <>
                    <div className="panel row">
                      <div>
                        <span className="eyebrow">Sales days off</span>
                        <h2>{monthLabel(daysOffMonth)}</h2>
                        <p className="admin-note">
                          Pick one salesperson, mark exact dates off, and save the whole month together. Those dates
                          block both service-drive assignments and BDC round-robin leads.
                        </p>
                      </div>
                      <div className="controls">
                        <input type="month" value={daysOffMonth} onChange={(event) => setDaysOffMonth(event.target.value)} />
                        <select
                          value={selectedDaysOffSalesId}
                          onChange={(event) => setSelectedDaysOffSalesId(event.target.value)}
                        >
                          <option value="">Choose salesperson</option>
                          {daysOffSalespeople.map((person) => (
                            <option key={`days-off-select-${person.id}`} value={person.id}>
                              {person.name} - {person.dealership}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="stats">
                      <div className="stat">
                        <span>Active salespeople</span>
                        <strong>{activeSales.length}</strong>
                      </div>
                      <div className="stat">
                        <span>{selectedDaysOffSalesperson ? `${selectedDaysOffSalesperson.name} days off` : "Selected days off"}</span>
                        <strong>{selectedDaysOffDates.length}</strong>
                      </div>
                      <div className="stat">
                        <span>Total blocked dates</span>
                        <strong>{daysOffData.entries.reduce((sum, entry) => sum + entry.off_dates.length, 0)}</strong>
                      </div>
                    </div>

                    <div className="days-off-layout">
                      <div className="panel">
                        <span className="eyebrow">Salespeople</span>
                        <h3>Alphabetical list</h3>
                        <div className="days-off-people">
                          {daysOffSalespeople.map((person) => {
                            const total = (daysOffEntriesBySalesperson.get(person.id) || []).length;
                            return (
                              <button
                                key={`days-off-person-${person.id}`}
                                type="button"
                                className={`person-row ${selectedDaysOffSalesperson?.id === person.id ? "is-active" : ""}`}
                                onClick={() => setSelectedDaysOffSalesId(String(person.id))}
                              >
                                <div>
                                  <strong>{person.name}</strong>
                                  <small>
                                    {person.dealership}
                                    {person.active ? "" : " - Inactive"}
                                  </small>
                                </div>
                                <b>{total}</b>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="panel">
                        <div className="row">
                          <div>
                            <span className="eyebrow">Month at a glance</span>
                            <h3>{selectedDaysOffSalesperson ? selectedDaysOffSalesperson.name : "Choose a salesperson"}</h3>
                          </div>
                          {selectedDaysOffSalesperson ? (
                            <div className="controls">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setDaysOffEntry(selectedDaysOffSalesperson.id, [])}
                              >
                                Clear Month
                              </button>
                              <button
                                type="button"
                                onClick={saveAllDaysOffMonth}
                                disabled={busy === "days-off-month"}
                              >
                                {busy === "days-off-month" ? "Saving..." : "Save All Month Changes"}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {selectedDaysOffSalesperson ? (
                          <>
                            <p className="admin-note">
                              Click a date to toggle it off for {selectedDaysOffSalesperson.name}. Each square also
                              shows how many total people are off that day.
                            </p>
                            <div className="days-off-board">
                              <div className="calendar-board__weekdays">
                                {CALENDAR_WEEKDAYS.map((label) => (
                                  <span key={`days-off-${label}`}>{label}</span>
                                ))}
                              </div>
                              <div className="days-off-grid">
                                {daysOffMonthCells.map((value, index) => {
                                  if (!value) {
                                    return <div key={`days-off-blank-${index}`} className="calendar-blank" aria-hidden="true" />;
                                  }

                                  const parts = dateParts(value);
                                  const isOff = selectedDaysOffDates.includes(value);
                                  const summary = monthDaysOffSummary.find((item) => item.date === value);
                                  const offNames = summary?.people.map((person) => person.name).join(", ") || "No one off";

                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={`days-off-day ${isOff ? "is-off" : ""}`}
                                      title={offNames}
                                      onClick={() =>
                                        setDaysOffEntry(
                                          selectedDaysOffSalesperson.id,
                                          toggleDate(selectedDaysOffDates, value)
                                        )
                                      }
                                    >
                                      <span>{parts.monthShort}</span>
                                      <strong>{parts.dayNumber}</strong>
                                      <small>{isOff ? "Off" : "Working"}</small>
                                      <b>{summary?.people.length || 0} off</b>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="empty">Choose a salesperson to build the month schedule.</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : null}

                {adminSection === "trafficLog" ? (
                  <>
                    <div className="panel traffic-toolbar traffic-toolbar--admin">
                      <div className="traffic-toolbar__copy">
                        <span className="eyebrow">Traffic log</span>
                        <h3>{monthLabel(trafficMonth)}</h3>
                        <p className="admin-note">
                          Pick a day from the month view, add prospect rows like a clean spreadsheet, and keep the
                          customer-facing details locked to admin-only edits.
                        </p>
                      </div>
                      <div className="traffic-toolbar__controls">
                        <label>
                          <span>Month</span>
                          <input
                            type="month"
                            value={trafficMonth}
                            onChange={(event) => setTrafficMonth(event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Date</span>
                          <input
                            type="date"
                            value={selectedTrafficDate}
                            onChange={(event) => {
                              setSelectedTrafficDate(event.target.value);
                              if (event.target.value) {
                                setTrafficMonth(event.target.value.slice(0, 7));
                              }
                            }}
                          />
                        </label>
                        <div className="traffic-toolbar__chips">
                          <div className="traffic-chip">
                            <span>Month total</span>
                            <strong>{trafficMonthTotal}</strong>
                          </div>
                          <div className="traffic-chip">
                            <span>Selected day</span>
                            <strong>{selectedTrafficCount}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="traffic-dashboard">
                      <div className="panel traffic-day-panel">
                        <div className="row">
                          <div>
                            <span className="eyebrow">Month at a glance</span>
                            <h3>{monthLabel(trafficMonth)}</h3>
                          </div>
                          <div className="traffic-day-panel__count">{selectedTrafficCount} rows</div>
                        </div>
                        <div className="traffic-picker-scroll">
                          <TrafficDayPicker
                            cells={trafficMonthCells}
                            countsByDate={serviceTrafficData.counts_by_date}
                            selectedDate={selectedTrafficDate}
                            today={today}
                            onSelect={setSelectedTrafficDate}
                            serviceDayMap={serviceDayMap}
                            idPrefix="admin-traffic"
                          />
                        </div>
                      </div>

                      <div className="traffic-sidebar">
                        <div className="panel traffic-summary-panel">
                          <div className="row">
                            <div>
                              <span className="eyebrow">Selected day</span>
                              <h3>{longDateLabel(selectedTrafficDate)}</h3>
                            </div>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => clearTrafficDay(selectedTrafficDate)}
                              disabled={busy === `clear-traffic-day-${selectedTrafficDate}` || !selectedTrafficCount}
                            >
                              {busy === `clear-traffic-day-${selectedTrafficDate}` ? "Clearing..." : "Clear Day"}
                            </button>
                          </div>
                          <p className="admin-note">
                            Sales staff can only edit the notes field from the public page. Everything else stays admin
                            controlled here.
                          </p>
                          <div className="traffic-summary-panel__status">
                            <strong>
                              {selectedTrafficCount} traffic row{selectedTrafficCount === 1 ? "" : "s"} on this date
                            </strong>
                            <small>Clearing the day removes every row and any uploaded offer screenshots for that date.</small>
                          </div>
                          {trafficDayClearResult?.traffic_date === selectedTrafficDate && trafficDayClearResult.deleted ? (
                            <div className="notice success">
                              Cleared {trafficDayClearResult.deleted} row
                              {trafficDayClearResult.deleted === 1 ? "" : "s"}
                              {trafficDayClearResult.deleted_images
                                ? ` and ${trafficDayClearResult.deleted_images} screenshot${
                                    trafficDayClearResult.deleted_images === 1 ? "" : "s"
                                  }.`
                                : "."}
                            </div>
                          ) : null}
                          <div className="traffic-team-grid">
                            <div className="traffic-team-card">
                              <span>Kia</span>
                              <strong>{selectedTrafficKia.salesperson_name || "Open"}</strong>
                              <small>{selectedTrafficKia.salesperson_dealership || "No assignment"}</small>
                            </div>
                            <div className="traffic-team-card">
                              <span>Mazda</span>
                              <strong>{selectedTrafficMazda.salesperson_name || "Open"}</strong>
                              <small>{selectedTrafficMazda.salesperson_dealership || "No assignment"}</small>
                            </div>
                          </div>
                        </div>

                        <div className="panel">
                          <div className="row">
                            <div>
                              <span className="eyebrow">Reynolds import</span>
                              <h3>SERVICEAPPTS.csv</h3>
                            </div>
                            <button type="button" className="secondary" onClick={resetReynoldsImportForm}>
                              Clear File
                            </button>
                          </div>
                          <p className="admin-note">
                            Upload a Reynolds service appointment export and convert it into traffic rows for the notes
                            page. The importer maps appointment date, store, customer, phone, year, model, and service
                            context automatically.
                          </p>
                          {reynoldsImportResult ? (
                            <div className="notice success">
                              Imported {reynoldsImportResult.total_rows} rows: {reynoldsImportResult.created} created,{" "}
                              {reynoldsImportResult.updated} updated, {reynoldsImportResult.skipped} skipped across{" "}
                              {reynoldsImportResult.dates.length} date{reynoldsImportResult.dates.length === 1 ? "" : "s"}.
                            </div>
                          ) : null}
                          {reynoldsUndoResult ? (
                            <div className="notice success">
                              Removed {reynoldsUndoResult.deleted} Reynolds-imported row
                              {reynoldsUndoResult.deleted === 1 ? "" : "s"}
                              {reynoldsUndoResult.preserved_with_notes
                                ? ` and kept ${reynoldsUndoResult.preserved_with_notes} row${
                                    reynoldsUndoResult.preserved_with_notes === 1 ? "" : "s"
                                  } with saved salesperson notes.`
                                : "."}
                            </div>
                          ) : null}
                          <form className="form compact" onSubmit={importTrafficCsv}>
                            <label>
                              <span>CSV file</span>
                              <input
                                key={reynoldsImportFileKey}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) => setReynoldsImportFile(event.target.files?.[0] || null)}
                              />
                              <small>
                                Best with the Reynolds `SERVICEAPPTS.csv` export. Re-importing the same appointment rows
                                updates them instead of duplicating them.
                              </small>
                            </label>
                            <button type="submit" disabled={busy === "import-traffic-csv"}>
                              {busy === "import-traffic-csv" ? "Importing..." : "Import Reynolds CSV"}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={undoTrafficCsvImport}
                              disabled={busy === "undo-traffic-csv"}
                            >
                              {busy === "undo-traffic-csv" ? "Undoing..." : "Undo Reynolds Import"}
                            </button>
                          </form>
                        </div>

                        <div className="panel">
                          <div className="row">
                            <div>
                              <span className="eyebrow">Mastermind import</span>
                              <h3>Raw service appointments export</h3>
                            </div>
                            <button type="button" className="secondary" onClick={resetMastermindImportForm}>
                              Clear File
                            </button>
                          </div>
                          <p className="admin-note">
                            Upload the raw Mastermind service appointments CSV exactly as exported. The importer keeps
                            the useful traffic fields only: appointment date and time, store, customer, best phone,
                            vehicle, mileage, assignee, status, and showroom link. Unsupported Outlet rows are skipped.
                          </p>
                          {mastermindImportResult ? (
                            <div className="notice success">
                              Imported {mastermindImportResult.total_rows} rows: {mastermindImportResult.created} created,{" "}
                              {mastermindImportResult.updated} updated, {mastermindImportResult.skipped} skipped across{" "}
                              {mastermindImportResult.dates.length} date
                              {mastermindImportResult.dates.length === 1 ? "" : "s"}.
                            </div>
                          ) : null}
                          {mastermindUndoResult ? (
                            <div className="notice success">
                              Removed {mastermindUndoResult.deleted} Mastermind-imported row
                              {mastermindUndoResult.deleted === 1 ? "" : "s"}
                              {mastermindUndoResult.preserved_with_notes
                                ? ` and kept ${mastermindUndoResult.preserved_with_notes} row${
                                    mastermindUndoResult.preserved_with_notes === 1 ? "" : "s"
                                  } with saved salesperson notes.`
                                : "."}
                            </div>
                          ) : null}
                          <form className="form compact" onSubmit={importMastermindTrafficCsv}>
                            <label>
                              <span>CSV file</span>
                              <input
                                key={mastermindImportFileKey}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={(event) => setMastermindImportFile(event.target.files?.[0] || null)}
                              />
                              <small>
                                Best with the Automotive Mastermind service appointments export. Re-importing the same
                                appointments updates matching rows instead of duplicating them.
                              </small>
                            </label>
                            <button type="submit" disabled={busy === "import-mastermind-traffic-csv"}>
                              {busy === "import-mastermind-traffic-csv" ? "Importing..." : "Import Mastermind CSV"}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={undoMastermindTrafficCsvImport}
                              disabled={busy === "undo-mastermind-traffic-csv"}
                            >
                              {busy === "undo-mastermind-traffic-csv" ? "Undoing..." : "Undo Mastermind Import"}
                            </button>
                          </form>
                        </div>

                        <div className="panel">
                          <div className="row">
                            <div>
                              <span className="eyebrow">Add traffic row</span>
                              <h3>{selectedTrafficDate}</h3>
                            </div>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() =>
                                resetTrafficEntryForm()
                              }
                            >
                              Clear Fields
                            </button>
                          </div>

                          <form className="form" onSubmit={addTrafficEntry}>
                            <div className="traffic-entry-grid">
                              <label>
                                <span>Store</span>
                                <select
                                  value={trafficEntryForm.brand}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, brand: event.target.value }))
                                  }
                                >
                                  {TRAFFIC_BRANDS.map((brand) => (
                                    <option key={`traffic-form-${brand}`} value={brand}>
                                      {brand}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Name</span>
                                <input
                                  value={trafficEntryForm.customerName}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, customerName: event.target.value }))
                                  }
                                  placeholder="Customer name"
                                />
                              </label>
                              <label>
                                <span>Phone number</span>
                                <input
                                  value={trafficEntryForm.customerPhone}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, customerPhone: event.target.value }))
                                  }
                                  placeholder="956-555-1212"
                                />
                              </label>
                              <label>
                                <span>Year</span>
                                <input
                                  value={trafficEntryForm.vehicleYear}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, vehicleYear: event.target.value }))
                                  }
                                  placeholder="2024"
                                />
                              </label>
                              <label>
                                <span>Model / Make</span>
                                <input
                                  value={trafficEntryForm.modelMake}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, modelMake: event.target.value }))
                                  }
                                  placeholder="Sportage / Kia"
                                />
                              </label>
                              <label className="traffic-entry-grid__wide">
                                <span>Offer Idea</span>
                                <textarea
                                  rows={5}
                                  value={trafficEntryForm.offerIdea}
                                  onChange={(event) =>
                                    setTrafficEntryForm((current) => ({ ...current, offerIdea: event.target.value }))
                                  }
                                  placeholder="Lease idea, trade angle, payment idea, or next step"
                                />
                              </label>
                              <label className="traffic-entry-grid__wide">
                                <span>Offer screenshots</span>
                                <input
                                  key={trafficEntryFileKey}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(event) => setTrafficEntryFiles(Array.from(event.target.files || []))}
                                />
                                <small>{trafficEntryFiles.length ? `${trafficEntryFiles.length} image(s) ready to upload` : "Optional screenshots for the offer idea"}</small>
                              </label>
                            </div>
                            <button type="submit" disabled={busy === "add-traffic-entry"}>
                              {busy === "add-traffic-entry" ? "Adding..." : "+ Add Traffic Row"}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>

                    <div className="notes-list">
                      {serviceTrafficData.entries.length ? (
                        serviceTrafficData.entries.map((entry) => {
                          const brandKey = String(entry.brand || "Kia").toLowerCase();
                          return (
                          <article key={entry.id} className={`note-card note-card--${brandKey} is-admin`}>
                            <div className="note-card__top">
                              <div>
                                <span className="eyebrow">Traffic row</span>
                                <h3>{entry.customer_name}</h3>
                                <p className="note-card__subtitle">{entry.traffic_date}</p>
                              </div>
                              <span className={`brand-pill brand-pill--${brandKey}`}>{entry.brand}</span>
                            </div>

                            <div className="traffic-entry-grid">
                              <label>
                                <span>Date</span>
                                <input
                                  type="date"
                                  value={entry.traffic_date}
                                  onChange={(event) => patchTrafficEntry(entry.id, { traffic_date: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Store</span>
                                <select
                                  value={entry.brand}
                                  onChange={(event) => patchTrafficEntry(entry.id, { brand: event.target.value })}
                                >
                                  {TRAFFIC_BRANDS.map((brand) => (
                                    <option key={`traffic-row-${entry.id}-${brand}`} value={brand}>
                                      {brand}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Name</span>
                                <input
                                  value={entry.customer_name}
                                  onChange={(event) => patchTrafficEntry(entry.id, { customer_name: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Phone number</span>
                                <input
                                  value={entry.customer_phone || ""}
                                  onChange={(event) => patchTrafficEntry(entry.id, { customer_phone: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Year</span>
                                <input
                                  value={entry.vehicle_year}
                                  onChange={(event) => patchTrafficEntry(entry.id, { vehicle_year: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Model / Make</span>
                                <input
                                  value={entry.model_make}
                                  onChange={(event) => patchTrafficEntry(entry.id, { model_make: event.target.value })}
                                />
                              </label>
                            </div>

                            <div className="note-copy note-copy--admin">
                              <label className="note-copy__block">
                                <span>Offer idea</span>
                                <textarea
                                  rows={4}
                                  value={entry.offer_idea}
                                  onChange={(event) => patchTrafficEntry(entry.id, { offer_idea: event.target.value })}
                                />
                                <TrafficOfferGallery images={entry.offer_images} brand={entry.brand} />
                              </label>
                              <div className="note-copy__block is-readonly">
                                <span>Salesperson notes</span>
                                <p>{entry.sales_notes || "No salesperson notes saved yet."}</p>
                              </div>
                            </div>

                            <div className="traffic-upload-row">
                              <label className="traffic-upload-row__input">
                                <span>Add offer screenshots</span>
                                <input
                                  key={trafficRowUploadKeys[entry.id] || 0}
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(event) => setTrafficRowFiles(entry.id, event.target.files || [])}
                                />
                              </label>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => uploadTrafficRowImages(entry)}
                                disabled={busy === `traffic-images-${entry.id}` || !(trafficRowUploadFiles[entry.id] || []).length}
                              >
                                {busy === `traffic-images-${entry.id}` ? "Uploading..." : "Upload Images"}
                              </button>
                            </div>

                            <div className="note-actions">
                              <small>
                                {driveTeamText(entry.drive_team)}
                                {entry.sales_note_salesperson_name ? ` - Latest note by ${entry.sales_note_salesperson_name}` : ""}
                              </small>
                              <button
                                type="button"
                                onClick={() => saveTrafficEntry(entry)}
                                disabled={busy === `traffic-admin-${entry.id}`}
                              >
                                {busy === `traffic-admin-${entry.id}` ? "Saving..." : "Save Row"}
                              </button>
                            </div>
                          </article>
                        )})
                      ) : (
                        <div className="empty">No traffic rows have been entered for this day.</div>
                      )}
                    </div>
                  </>
                ) : null}

                {adminSection === "agentLoops" ? (
                  <>
                    <div className="admin-grid agent-loop-grid">
                      <div className="panel agent-loop-panel">
                        <span className="eyebrow">Agent orchestration</span>
                        <h3>Run bounded operator loops against live store data</h3>
                        <p className="admin-note">
                          These loops use OpenAI to inspect BDC, freshups, service traffic, notes, quote rates, and the marketplace template.
                          Every run stays bounded, persists its own event history, and can be reviewed or canceled from here.
                        </p>
                        <div className={`notice ${agentLoopConfig.configured ? "success" : "error"}`}>
                          {agentLoopConfig.configured
                            ? `${agentLoopConfig.provider} is configured with ${agentLoopConfig.model} at ${agentLoopConfig.reasoning_effort} reasoning. Each run gets up to ${agentLoopConfig.max_steps} tool steps.`
                            : "Set OPENAI_API_KEY on the backend before running agent loops."}
                        </div>
                        <form className="form" onSubmit={submitAgentLoop}>
                          <label>
                            <span>Preset</span>
                            <select
                              value={agentLoopForm.presetKey}
                              onChange={(event) => applyAgentLoopPreset(event.target.value)}
                            >
                              {agentLoopPresets.map((preset) => (
                                <option key={preset.key} value={preset.key}>
                                  {preset.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {selectedAgentLoopPreset ? (
                            <div className="asset-card">
                              <strong>{selectedAgentLoopPreset.label}</strong>
                              <p>{selectedAgentLoopPreset.description}</p>
                            </div>
                          ) : null}
                          <label>
                            <span>Objective</span>
                            <textarea
                              rows={6}
                              value={agentLoopForm.objective}
                              onChange={(event) =>
                                setAgentLoopForm((current) => ({ ...current, objective: event.target.value }))
                              }
                              placeholder="Tell the loop exactly what to analyze or optimize."
                            />
                          </label>
                          <div className="controls">
                            <button type="submit" disabled={busy === "agent-loop-run" || !agentLoopConfig.configured}>
                              {busy === "agent-loop-run" ? "Starting..." : "Run Agent Loop"}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={async () => {
                                try {
                                  await refreshAgentLoopConfig();
                                  await refreshAgentLoopRuns({ preserveSelection: true });
                                  if (selectedAgentRunId) await refreshSelectedAgentLoop(selectedAgentRunId);
                                } catch (errorValue) {
                                  setError(errText(errorValue));
                                }
                              }}
                            >
                              Refresh
                            </button>
                            {selectedAgentLoopIsActive ? (
                              <button
                                type="button"
                                className="secondary"
                                onClick={cancelCurrentAgentLoop}
                                disabled={busy === "agent-loop-cancel"}
                              >
                                {busy === "agent-loop-cancel" ? "Canceling..." : "Cancel Selected Run"}
                              </button>
                            ) : null}
                          </div>
                        </form>
                        {agentLoopFeedback ? (
                          <div className={`notice ${agentLoopFeedback.kind}`}>{agentLoopFeedback.message}</div>
                        ) : null}
                      </div>

                      <div className="panel agent-loop-panel">
                        <div className="row">
                          <div>
                            <span className="eyebrow">Run history</span>
                            <h3>Latest agent loops</h3>
                          </div>
                          <small>{agentLoopRuns.total} total recorded</small>
                        </div>
                        <div className="agent-run-list">
                          {agentLoopRuns.entries.length ? (
                            agentLoopRuns.entries.map((run) => (
                              <button
                                key={`agent-run-${run.id}`}
                                type="button"
                                className={`agent-run-card ${selectedAgentRunId === run.id ? "is-active" : ""}`}
                                onClick={() => setSelectedAgentRunId(run.id)}
                              >
                                <div className="agent-run-card__top">
                                  <strong>{run.preset_label}</strong>
                                  <span className={`agent-status-pill ${agentLoopStatusTone(run.status)}`}>
                                    {agentLoopStatusLabel(run.status)}
                                  </span>
                                </div>
                                <small>
                                  {dateTimeLabel(run.created_at)} · {run.total_steps} steps
                                </small>
                                <p>{run.objective}</p>
                              </button>
                            ))
                          ) : (
                            <div className="empty">No agent loops have been run yet.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="panel agent-loop-detail">
                      {selectedAgentRun ? (
                        <>
                          <div className="agent-loop-detail__header">
                            <div>
                              <span className="eyebrow">Selected run</span>
                              <h3>{selectedAgentRun.preset_label}</h3>
                              <p className="admin-note">{selectedAgentRun.objective}</p>
                            </div>
                            <span className={`agent-status-pill ${agentLoopStatusTone(selectedAgentRun.status)}`}>
                              {agentLoopStatusLabel(selectedAgentRun.status)}
                            </span>
                          </div>

                          <div className="agent-loop-metrics">
                            <div className="metric-card">
                              <span>Created</span>
                              <strong>{dateTimeLabel(selectedAgentRun.created_at)}</strong>
                            </div>
                            <div className="metric-card">
                              <span>Model</span>
                              <strong>{selectedAgentRun.model}</strong>
                            </div>
                            <div className="metric-card">
                              <span>Reasoning</span>
                              <strong>{selectedAgentRun.reasoning_effort}</strong>
                            </div>
                            <div className="metric-card">
                              <span>Steps</span>
                              <strong>{selectedAgentRun.total_steps}</strong>
                            </div>
                          </div>

                          {selectedAgentRun.summary ? (
                            <div className="marketplace-callout agent-loop-summary">
                              <strong>Summary</strong>
                              <span>{selectedAgentRun.summary}</span>
                            </div>
                          ) : null}

                          {selectedAgentRun.latest_thinking ? (
                            <div className="asset-card">
                              <strong>Latest thinking</strong>
                              <p>{selectedAgentRun.latest_thinking}</p>
                            </div>
                          ) : null}

                          {selectedAgentRun.error_message ? (
                            <div className="notice error">{selectedAgentRun.error_message}</div>
                          ) : null}

                          <div className="agent-loop-detail__lists">
                            <div>
                              <span className="eyebrow">High priority actions</span>
                              {selectedAgentRun.high_priority_actions.length ? (
                                <ul className="feature-list">
                                  {selectedAgentRun.high_priority_actions.map((item, index) => (
                                    <li key={`agent-action-${index}`}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="admin-note">No final actions have been recorded yet.</p>
                              )}
                            </div>
                            <div>
                              <span className="eyebrow">Observations</span>
                              {selectedAgentRun.observations.length ? (
                                <ul className="feature-list">
                                  {selectedAgentRun.observations.map((item, index) => (
                                    <li key={`agent-observation-${index}`}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="admin-note">No extra observations were saved on this run.</p>
                              )}
                            </div>
                          </div>

                          <div className="agent-loop-events">
                            <div className="row">
                              <div>
                                <span className="eyebrow">Event timeline</span>
                                <h4>Stored loop trace</h4>
                              </div>
                              <small>{selectedAgentRun.events.length} events loaded</small>
                            </div>
                            {selectedAgentRun.events.length ? (
                              selectedAgentRun.events.map((event) => (
                                <article key={`agent-event-${event.id}`} className="agent-event-card">
                                  <div className="agent-event-card__top">
                                    <div>
                                      <strong>{event.title}</strong>
                                      <small>
                                        Step {event.step_index} · {dateTimeLabel(event.created_at)}
                                      </small>
                                    </div>
                                    <span className="eyebrow">{event.event_type}</span>
                                  </div>
                                  {event.content ? <p>{event.content}</p> : null}
                                  {Object.keys(event.payload || {}).length ? (
                                    <details>
                                      <summary>Payload</summary>
                                      <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                                    </details>
                                  ) : null}
                                </article>
                              ))
                            ) : (
                              <div className="empty">No events were recorded for this run yet.</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="empty">Pick a run from the history to inspect the loop trace.</div>
                      )}
                    </div>
                  </>
                ) : null}

                {adminSection === "marketplace" ? (
                  <div className="panel marketplace-admin">
                    <div className="marketplace-admin__header">
                      <div>
                        <span className="eyebrow">Marketplace template</span>
                        <h3>Facebook post content</h3>
                      </div>
                      <button type="button" className="secondary" onClick={resetMarketplaceTemplateDraft}>
                        Reset Builder
                      </button>
                    </div>
                    <p className="admin-note">
                      Use the simple builder below. No bracket syntax is required. The extension inserts year, make,
                      model, price, mileage, VIN, and the vehicle URL automatically.
                    </p>

                    <div className="marketplace-admin__layout">
                      <div className="marketplace-admin__editor">
                        <div className="marketplace-admin__section">
                          <div className="marketplace-admin__section-head">
                            <div>
                              <span className="eyebrow">Step 1</span>
                              <h4>Simple builder</h4>
                            </div>
                            <small>Type plain words only. The vehicle details are inserted for you.</small>
                          </div>
                          <div className="form">
                            <div className="marketplace-admin__two-up">
                              <label>
                                <span>Headline prefix</span>
                                <input
                                  value={marketplaceBuilder.titlePrefix}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, titlePrefix: event.target.value }))
                                  }
                                  placeholder="Optional, like Clean trade-in"
                                />
                              </label>
                              <label>
                                <span>Headline suffix</span>
                                <input
                                  value={marketplaceBuilder.titleSuffix}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, titleSuffix: event.target.value }))
                                  }
                                  placeholder="Optional, like Financing available"
                                />
                              </label>
                            </div>
                            <div className="notice">
                              Vehicle headline will always include the vehicle name automatically.
                            </div>
                            <div className="marketplace-admin__two-up">
                              <label>
                                <span>Price label</span>
                                <input
                                  value={marketplaceBuilder.priceLabel}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, priceLabel: event.target.value }))
                                  }
                                  placeholder="Bert Ogden Price"
                                />
                              </label>
                              <label>
                                <span>CTA text</span>
                                <input
                                  value={marketplaceBuilder.ctaText}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, ctaText: event.target.value }))
                                  }
                                  placeholder="Message us for availability and financing options."
                                />
                              </label>
                            </div>
                            <div className="notice">
                              The helper now builds the description from live vehicle data only. Freeform admin description
                              lines are disabled so one vehicle never inherits another unit's wording.
                            </div>
                            <div className="editor-list editor-list--two-up">
                              <label className="checkbox panel inset-panel">
                                <input
                                  type="checkbox"
                                  checked={marketplaceBuilder.includeVehicleLine}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, includeVehicleLine: event.target.checked }))
                                  }
                                />
                                <span>Repeat vehicle name in description</span>
                              </label>
                              <label className="checkbox panel inset-panel">
                                <input
                                  type="checkbox"
                                  checked={marketplaceBuilder.includeMileage}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, includeMileage: event.target.checked }))
                                  }
                                />
                                <span>Include mileage line</span>
                              </label>
                              <label className="checkbox panel inset-panel">
                                <input
                                  type="checkbox"
                                  checked={marketplaceBuilder.includeVin}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, includeVin: event.target.checked }))
                                  }
                                />
                                <span>Include VIN line</span>
                              </label>
                              <label className="checkbox panel inset-panel">
                                <input
                                  type="checkbox"
                                  checked={marketplaceBuilder.includeUrl}
                                  onChange={(event) =>
                                    setMarketplaceBuilder((current) => ({ ...current, includeUrl: event.target.checked }))
                                  }
                                />
                                <span>Include vehicle link</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="marketplace-admin__preview">
                        <div className="marketplace-preview-card">
                          <span className="eyebrow">Live sample output</span>
                          <h4>{marketplacePreviewTitle}</h4>
                          <div className="marketplace-preview-card__meta">
                            <span>{marketplacePreviewData.price_label}: {marketplacePreviewData.price}</span>
                            <span>{marketplacePreviewData.mileage}</span>
                            <span>{marketplacePreviewData.vin}</span>
                          </div>
                          <pre>{marketplacePreviewDescription}</pre>
                        </div>

                        <div className="marketplace-preview-card">
                          <span className="eyebrow">What gets inserted automatically</span>
                          <div className="marketplace-token-grid">
                            {["Vehicle name", "Price", "Mileage", "VIN", "Vehicle link"].map((label) => (
                              <div key={`placeholder-${label}`} className="marketplace-token">
                                {label}
                              </div>
                            ))}
                          </div>
                          <small>
                            Sales managers should only type reusable wording here. Do not type one specific unit’s year,
                            price, or VIN into the builder.
                          </small>
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={saveMarketplaceTemplate} disabled={busy === "marketplace-template"}>
                      {busy === "marketplace-template" ? "Saving..." : "Save Simple Layout"}
                    </button>
                  </div>
                ) : null}

                {adminSection === "quoteRates" ? (
                  <div className="panel">
                    <span className="eyebrow">Quote rates</span>
                    <h3>APR by credit tier</h3>
                    <p className="admin-note">
                      Set the APR that should be used for each credit tier and brand. These rates power the Quote Tool.
                    </p>
                    <div className="quote-rate-grid">
                      {QUOTE_BRANDS.map((brand) => (
                        <div key={brand} className="quote-rate-card">
                          <h4>{brand}</h4>
                          {CREDIT_TIERS.map((tier) => (
                            <label key={`${brand}-${tier.label}`} className="quote-rate-input">
                              <span>{tier.label}</span>
                              <input
                                inputMode="decimal"
                                placeholder="7.99"
                                value={quoteRateDraft?.[brand]?.[tier.label] ?? ""}
                                onChange={(event) => updateQuoteRateDraft(brand, tier.label, event.target.value)}
                              />
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={saveQuoteRates} disabled={busy === "quote-rates"}>
                      {busy === "quote-rates" ? "Saving..." : "Save Quote Rates"}
                    </button>
                  </div>
                ) : null}

                {adminSection === "bdcDistribution" ? (
                  <div className="panel">
                    <span className="eyebrow">Lead distribution type</span>
                    <h3>BDC round robin mode</h3>
                    <p className="admin-note">
                      Choose whether BDC assignments are store-specific or one combined rotation across all salespeople.
                    </p>
                    <div className="distribution-toggle">
                      <button
                        type="button"
                        className={`pill ${bdcDistribution.mode === "franchise" ? "is-active" : ""}`}
                        onClick={() => saveBdcDistribution("franchise")}
                        disabled={busy === "bdc-distribution"}
                      >
                        Franchise specific
                      </button>
                      <button
                        type="button"
                        className={`pill ${bdcDistribution.mode === "global" ? "is-active" : ""}`}
                        onClick={() => saveBdcDistribution("global")}
                        disabled={busy === "bdc-distribution"}
                      >
                        Global round robin
                      </button>
                      <button
                        type="button"
                        className={`pill ${bdcDistribution.mode === "universal" ? "is-active" : ""}`}
                        onClick={() => saveBdcDistribution("universal")}
                        disabled={busy === "bdc-distribution"}
                      >
                        Universal (Kia/Mazda shared)
                      </button>
                    </div>
                    <div className="notice">
                      {bdcDistribution.mode === "global"
                        ? "Leads will rotate through all active salespeople across Kia, Mazda, and Outlet."
                        : bdcDistribution.mode === "universal"
                          ? "Kia and Mazda leads share one rotation. Outlet stays separate."
                          : "Leads will rotate only within the selected lead store's salespeople."}
                    </div>
                  </div>
                ) : null}

                {adminSection === "bdcDistribution" ? (
                  <div className="panel">
                    <span className="eyebrow">Undo assignment security</span>
                    <h3>Require password for BDC undo</h3>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={bdcUndoSettings.require_password}
                        onChange={(event) =>
                          setBdcUndoSettings((current) => ({ ...current, require_password: event.target.checked }))
                        }
                      />
                      <span>Require password for Undo Last Assignment</span>
                    </label>
                    {bdcUndoSettings.require_password ? (
                      <label>
                        <span>Undo password</span>
                        <input
                          type="password"
                          placeholder="bdc"
                          value={bdcUndoPassword}
                          onChange={(event) => setBdcUndoPassword(event.target.value)}
                        />
                        <small>Leave blank to keep the current password.</small>
                      </label>
                    ) : null}
                    <button type="button" onClick={saveBdcUndoSettings} disabled={busy === "bdc-undo-settings"}>
                      {busy === "bdc-undo-settings" ? "Saving..." : "Save Undo Settings"}
                    </button>
                  </div>
                ) : null}

                {adminSection === "tabs" ? (
                  <div className="panel">
                    <span className="eyebrow">Tab visibility</span>
                    <h3>Choose which tabs non-admin users can see</h3>
                    <p className="admin-note">
                      Hidden tabs stay visible when you are logged in as admin. Everyone else will only see the tabs you
                      leave enabled here. The Admin tab always stays visible so you can still sign in.
                    </p>
                    <div className="editor-list editor-list--two-up">
                      {TABS.filter((item) => item.id !== "admin").map((item) => {
                        const visible = (tabVisibility.entries || []).find((entry) => entry.tab_id === item.id)?.visible ?? true;
                        return (
                          <label key={item.id} className="checkbox panel inset-panel">
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={(event) => setTabVisibilityValue(item.id, event.target.checked)}
                            />
                            <span>{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <button type="button" onClick={saveTabVisibilitySettings} disabled={busy === "tab-visibility"}>
                      {busy === "tab-visibility" ? "Saving..." : "Save Tab Visibility"}
                    </button>
                  </div>
                ) : null}

                {adminSection === "freshupLinks" ? (
                  <div className="stack">
                    <div className="panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Freshup customer page</span>
                          <h3>Linktree-style landing page</h3>
                          <p className="admin-note">
                            This controls the customer-facing salesperson page used by the Freshup NFC link. The contact form stays at the top and the links render underneath it.
                          </p>
                        </div>
                        <button type="button" onClick={saveFreshUpLinksSettings} disabled={busy === "freshup-links"}>
                          {busy === "freshup-links" ? "Saving..." : "Save Freshup Links"}
                        </button>
                      </div>

                      <details className="freshup-admin-group" open>
                        <summary>
                          <div>
                            <strong>Page settings</strong>
                            <small>Hero copy, form text, and submit label.</small>
                          </div>
                        </summary>
                        <div className="editor-list editor-list--two-up">
                          <label>
                            <span>Page title</span>
                            <input
                              value={freshUpLinksConfig.page_title}
                              onChange={(event) => setFreshUpLinkField("page_title", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Submit button label</span>
                            <input
                              value={freshUpLinksConfig.submit_label}
                              onChange={(event) => setFreshUpLinkField("submit_label", event.target.value)}
                            />
                          </label>
                          <label className="editor-list__wide">
                            <span>Page subtitle</span>
                            <textarea
                              value={freshUpLinksConfig.page_subtitle}
                              onChange={(event) => setFreshUpLinkField("page_subtitle", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Form title</span>
                            <input
                              value={freshUpLinksConfig.form_title}
                              onChange={(event) => setFreshUpLinkField("form_title", event.target.value)}
                            />
                          </label>
                          <label className="editor-list__wide">
                            <span>Form subtitle</span>
                            <textarea
                              value={freshUpLinksConfig.form_subtitle}
                              onChange={(event) => setFreshUpLinkField("form_subtitle", event.target.value)}
                            />
                          </label>
                        </div>
                      </details>
                    </div>

                    <div className="panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Freshup analytics</span>
                          <h3>Customer page activity</h3>
                          <p className="admin-note">Last 30 days of visits, submissions, and link clicks from NFC customer pages.</p>
                        </div>
                        <button type="button" className="secondary" onClick={refreshFreshUpAnalytics} disabled={busy === "freshup-links"}>
                          Refresh Analytics
                        </button>
                      </div>

                      <div className="analytics-grid">
                        <div className="analytics-card">
                          <span className="eyebrow">Page views</span>
                          <strong>{freshUpAnalytics.page_views}</strong>
                          <small>Customer opens from NFC or direct links.</small>
                        </div>
                        <div className="analytics-card">
                          <span className="eyebrow">Submissions</span>
                          <strong>{freshUpAnalytics.submissions}</strong>
                          <small>Contact forms completed on the customer page.</small>
                        </div>
                        <div className="analytics-card">
                          <span className="eyebrow">Link clicks</span>
                          <strong>{freshUpAnalytics.link_clicks}</strong>
                          <small>Outbound taps into maps, finance, inventory, or social.</small>
                        </div>
                        <div className="analytics-card">
                          <span className="eyebrow">Conversion</span>
                          <strong>{freshUpConversionRate}%</strong>
                          <small>Submissions divided by page views.</small>
                        </div>
                      </div>

                      <div className="analytics-breakdown">
                        <div className="analytics-card">
                          <span className="eyebrow">Top links</span>
                          <div className="analytics-chip-row">
                            {(freshUpAnalytics.clicks_by_link_type || []).length ? (
                              freshUpAnalytics.clicks_by_link_type.map((item) => (
                                <span key={`freshup-link-type-${item.label}`} className="analytics-chip">
                                  {freshUpAnalyticsLabel(item.label)} · {item.count}
                                </span>
                              ))
                            ) : (
                              <span className="admin-note">No link clicks yet.</span>
                            )}
                          </div>
                        </div>
                        <div className="analytics-card">
                          <span className="eyebrow">Clicks by store</span>
                          <div className="analytics-chip-row">
                            {(freshUpAnalytics.clicks_by_store || []).length ? (
                              freshUpAnalytics.clicks_by_store.map((item) => (
                                <span key={`freshup-store-clicks-${item.label}`} className="analytics-chip">
                                  {item.label} · {item.count}
                                </span>
                              ))
                            ) : (
                              <span className="admin-note">No store click data yet.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="analytics-card">
                        <span className="eyebrow">Recent activity</span>
                        <div className="analytics-list">
                          {(freshUpAnalytics.recent || []).length ? (
                            freshUpAnalytics.recent.map((entry) => (
                              <article key={`freshup-analytics-${entry.id}`} className="analytics-list__item">
                                <div>
                                  <strong>{freshUpAnalyticsLabel(entry.event_type)}</strong>
                                  <small>
                                    {entry.salesperson_name || "Unassigned"} · {entry.store_dealership || entry.salesperson_dealership || "No store"}
                                  </small>
                                </div>
                                <div className="analytics-list__meta">
                                  {entry.link_type ? <span>{freshUpAnalyticsLabel(entry.link_type)}</span> : null}
                                  <span>{dateTimeLabel(entry.event_at)}</span>
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="admin-note">No analytics events yet.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="stack">
                      {(freshUpLinksConfig.stores || []).map((store) => {
                        const brand = freshUpStoreBrandMeta(store.dealership);
                        return (
                          <details
                            key={`freshup-links-${store.dealership}`}
                            className="panel freshup-admin-group freshup-admin-group--store"
                          >
                            <summary>
                              <div className="freshup-admin-summary">
                                <div className="freshup-admin-summary__brand">
                                  <span className="freshup-admin-summary__logo">
                                    <img
                                      src={brand.logo}
                                      alt={`${store.dealership} logo`}
                                      className={store.dealership === "Outlet" ? "freshup-admin-summary__logo-image freshup-admin-summary__logo-image--rounded" : "freshup-admin-summary__logo-image"}
                                    />
                                  </span>
                                  <div>
                                    <strong>{store.display_name}</strong>
                                    <small>{store.dealership} customer-facing links and social destinations.</small>
                                  </div>
                                </div>
                              </div>
                            </summary>

                            <div className="editor-list editor-list--two-up">
                              <label>
                                <span>Store name</span>
                                <input
                                  value={store.display_name}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "display_name", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Call button label</span>
                                <input
                                  value={store.call_label}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "call_label", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Call URL</span>
                                <input
                                  value={store.call_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "call_url", event.target.value)}
                                  placeholder="tel:(956) 555-1234"
                                />
                              </label>
                              <label>
                                <span>Maps button label</span>
                                <input
                                  value={store.maps_label}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "maps_label", event.target.value)}
                                />
                              </label>
                              <label className="editor-list__wide">
                                <span>Maps URL</span>
                                <input
                                  value={store.maps_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "maps_url", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Instagram URL</span>
                                <input
                                  value={store.instagram_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "instagram_url", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Facebook URL</span>
                                <input
                                  value={store.facebook_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "facebook_url", event.target.value)}
                                />
                              </label>
                              <label className="editor-list__wide">
                                <span>YouTube URL</span>
                                <input
                                  value={store.youtube_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "youtube_url", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Soft pull button label</span>
                                <input
                                  value={store.soft_pull_label}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "soft_pull_label", event.target.value)}
                                />
                              </label>
                              <label className="editor-list__wide">
                                <span>Soft pull URL</span>
                                <input
                                  value={store.soft_pull_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "soft_pull_url", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Hard pull button label</span>
                                <input
                                  value={store.hard_pull_label}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "hard_pull_label", event.target.value)}
                                />
                              </label>
                              <label className="editor-list__wide">
                                <span>Hard pull URL</span>
                                <input
                                  value={store.hard_pull_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "hard_pull_url", event.target.value)}
                                />
                              </label>
                              <label>
                                <span>Inventory button label</span>
                                <input
                                  value={store.inventory_label}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "inventory_label", event.target.value)}
                                />
                              </label>
                              <label className="editor-list__wide">
                                <span>Inventory URL</span>
                                <input
                                  value={store.inventory_url}
                                  onChange={(event) => setFreshUpStoreField(store.dealership, "inventory_url", event.target.value)}
                                />
                              </label>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {false && adminSection === "serviceNotes" ? (
                  <>
                    <div className="admin-grid">
                      <div className="panel">
                        <span className="eyebrow">Add appointment</span>
                        <h3>+ Service drive note entry</h3>
                        <form className="form" onSubmit={addServiceNote}>
                          <label>
                            <span>Appointment date and time</span>
                            <input
                              type="datetime-local"
                              value={serviceNoteForm.appointmentAt}
                              onChange={(event) =>
                                setServiceNoteForm((current) => ({ ...current, appointmentAt: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>Store</span>
                            <select
                              value={serviceNoteForm.brand}
                              onChange={(event) =>
                                setServiceNoteForm((current) => ({ ...current, brand: event.target.value }))
                              }
                            >
                              <option value="Kia">Kia</option>
                              <option value="Mazda">Mazda</option>
                            </select>
                          </label>
                          <label>
                            <span>Customer name</span>
                            <input
                              value={serviceNoteForm.customerName}
                              onChange={(event) =>
                                setServiceNoteForm((current) => ({ ...current, customerName: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>Phone number</span>
                            <input
                              value={serviceNoteForm.customerPhone}
                              onChange={(event) =>
                                setServiceNoteForm((current) => ({ ...current, customerPhone: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>Admin notes</span>
                            <textarea
                              rows={5}
                              value={serviceNoteForm.adminNotes}
                              onChange={(event) =>
                                setServiceNoteForm((current) => ({ ...current, adminNotes: event.target.value }))
                              }
                            />
                          </label>
                          <button type="submit" disabled={busy === "add-service-note"}>
                            {busy === "add-service-note" ? "Adding..." : "+ Add Appointment"}
                          </button>
                        </form>
                      </div>

                      <div className="panel">
                        <span className="eyebrow">Filter appointments</span>
                        <h3>Find the right service rows</h3>
                        <div className="filters filters--notes">
                          <label>
                            <span>Start date</span>
                            <input
                              type="date"
                              value={serviceNotesFilters.startDate}
                              onChange={(event) =>
                                setServiceNotesFilters((current) => ({ ...current, startDate: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>End date</span>
                            <input
                              type="date"
                              value={serviceNotesFilters.endDate}
                              onChange={(event) =>
                                setServiceNotesFilters((current) => ({ ...current, endDate: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            <span>Store</span>
                            <select
                              value={serviceNotesFilters.brand}
                              onChange={(event) =>
                                setServiceNotesFilters((current) => ({ ...current, brand: event.target.value }))
                              }
                            >
                              <option value="">All stores</option>
                              <option value="Kia">Kia</option>
                              <option value="Mazda">Mazda</option>
                            </select>
                          </label>
                          <label>
                            <span>Assigned salesperson</span>
                            <select
                              value={serviceNotesFilters.salespersonId}
                              onChange={(event) =>
                                setServiceNotesFilters((current) => ({ ...current, salespersonId: event.target.value }))
                              }
                            >
                              <option value="">All salespeople</option>
                              {serviceEligible.map((person) => (
                                <option key={`admin-note-sales-${person.id}`} value={person.id}>
                                  {person.name} - {person.dealership}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <p className="admin-note">
                          Admin controls the appointment date, time, customer, phone, and admin notes here. Salespeople only
                          update the salesperson notes field from the public notes page.
                        </p>
                      </div>
                    </div>

                    <div className="notes-list">
                      {serviceNotesData.entries.length ? (
                        serviceNotesData.entries.map((entry) => (
                          <article key={entry.id} className="note-card is-admin">
                            <div className="note-card__top">
                              <div>
                                <span className="eyebrow">Service drive note</span>
                                <h3>{entry.customer_name}</h3>
                                <p className="note-card__subtitle">
                                  Assigned to {entry.salesperson_name || "Open service slot"}
                                </p>
                              </div>
                              <span className={`brand-pill brand-pill--${entry.brand.toLowerCase()}`}>{entry.brand}</span>
                            </div>

                            <div className="note-admin-grid">
                              <label>
                                <span>Appointment date and time</span>
                                <input
                                  type="datetime-local"
                                  value={entry.appointment_at}
                                  onChange={(event) => patchServiceNoteEntry(entry.id, { appointment_at: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Store</span>
                                <select
                                  value={entry.brand}
                                  onChange={(event) => patchServiceNoteEntry(entry.id, { brand: event.target.value })}
                                >
                                  <option value="Kia">Kia</option>
                                  <option value="Mazda">Mazda</option>
                                </select>
                              </label>
                              <label>
                                <span>Customer name</span>
                                <input
                                  value={entry.customer_name}
                                  onChange={(event) => patchServiceNoteEntry(entry.id, { customer_name: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Phone number</span>
                                <input
                                  value={entry.customer_phone}
                                  onChange={(event) => patchServiceNoteEntry(entry.id, { customer_phone: event.target.value })}
                                />
                              </label>
                            </div>

                            <div className="note-copy note-copy--admin">
                              <label className="note-copy__block">
                                <span>Admin notes</span>
                                <textarea
                                  rows={4}
                                  value={entry.admin_notes}
                                  onChange={(event) => patchServiceNoteEntry(entry.id, { admin_notes: event.target.value })}
                                />
                              </label>
                              <div className="note-copy__block is-readonly">
                                <span>Salesperson notes</span>
                                <p>{entry.sales_notes || "No salesperson notes saved yet."}</p>
                              </div>
                            </div>

                            <div className="note-actions">
                              <small>{dateTimeLabel(entry.appointment_at)} · {entry.brand}</small>
                              <button
                                type="button"
                                onClick={() => saveServiceNote(entry)}
                                disabled={busy === `service-note-admin-${entry.id}`}
                              >
                                {busy === `service-note-admin-${entry.id}` ? "Saving..." : "Save Appointment"}
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty">No service appointments match these filters.</div>
                      )}
                    </div>
                  </>
                ) : null}

                {adminSection === "specials" ? (
                  <>
                    <div className="admin-grid">
                      <div className="panel">
                        <span className="eyebrow">{specialForm.editingId ? "Edit special" : "Upload special"}</span>
                        <h3>1080 x 1080 offer tile</h3>
                        {specialForm.editingId && selectedSpecial ? (
                          <div className="asset-card">
                            <strong>Editing: {selectedSpecial.title}</strong>
                            <p>
                              Tag: {selectedSpecial.tag}
                              <br />
                              Leave the image field empty if you only want to change the title or tag.
                            </p>
                          </div>
                        ) : null}
                        <form className="form" onSubmit={uploadSpecial}>
                          <label>
                            <span>Title</span>
                            <input
                              value={specialForm.title}
                              onChange={(event) => setSpecialForm((current) => ({ ...current, title: event.target.value }))}
                              placeholder="Sportage Lease Offer"
                            />
                          </label>
                          <label>
                            <span>Tag</span>
                            <input
                              value={specialForm.tag}
                              onChange={(event) => setSpecialForm((current) => ({ ...current, tag: event.target.value }))}
                              placeholder="Sportage"
                            />
                          </label>
                          <label>
                            <span>Image file</span>
                            <input
                              key={specialUploadKey}
                              type="file"
                              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                              onChange={(event) =>
                                setSpecialForm((current) => ({ ...current, file: event.target.files?.[0] || null }))
                              }
                            />
                          </label>
                          <div className="controls">
                            <button type="submit" disabled={busy === "upload-special"}>
                              {busy === "upload-special"
                                ? specialForm.editingId
                                  ? "Saving..."
                                  : "Uploading..."
                                : specialForm.editingId
                                  ? "Save Changes"
                                  : "Upload Special"}
                            </button>
                            {specialForm.editingId ? (
                              <button type="button" className="secondary" onClick={resetSpecialForm}>
                                Create New Tile
                              </button>
                            ) : null}
                          </div>
                        </form>
                      </div>

                      <div className="panel">
                        <span className="eyebrow">Live specials</span>
                        <h3>Current uploaded graphics</h3>
                        <p className="admin-note">Click any tile to edit its title, tag, or replace the image.</p>
                        <div className="specials-grid specials-grid--admin">
                          {specials.length ? (
                            specials.map((item) => (
                              <button
                                key={`admin-special-${item.id}`}
                                type="button"
                                className={`special-card ${selectedSpecial?.id === item.id ? "is-active" : ""}`}
                                onClick={() => beginSpecialEdit(item)}
                              >
                                <img src={assetUrl(item.image_url)} alt={item.title} />
                                <div className="special-card__copy">
                                  <span>{item.tag}</span>
                                  <strong>{item.title}</strong>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="empty">No specials uploaded yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
