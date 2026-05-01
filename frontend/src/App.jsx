import React, { useEffect, useRef, useState } from "react";
import {
  apiBase,
  adminLogin,
  adminLogout,
  assignBdcLead,
  cancelAgentLoopRun,
  COOKIE_ADMIN_SESSION_MARKER,
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
  getBdcLeadPushConfig,
  getBdcLog,
  getBdcReport,
  getBdcSalesTracker,
  getSalesAnalyticsDashboard,
  getBdcState,
  getFreshUpLog,
  getFreshUpLinks,
  getFreshUpAnalytics,
  getBdcDistribution,
  getBdcUndoSettings,
  importSpecialFeed,
  importSpecialFeedSource,
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
  updateBdcLeadPushConfig,
  updateBdcSalesTrackerAgentMetrics,
  updateBdcSalesTrackerEntry,
  updateBdcSalesTrackerMonth,
  updateBdcSalesTrackerRules,
  updateBdcSalesTrackerFocusNote,
  updateFreshUpLinks,
  undoLastBdcAssign,
  updateBdcUndoSettings,
  updateMarketplaceTemplate,
  updateQuoteRates,
  updateSalesperson,
  updateSpecial,
  updateSpecialsConfig,
  updateTabVisibility,
  updateServiceDriveAssignment,
  updateServiceDriveTraffic,
  uploadServiceDriveTrafficImages,
  updateServiceDriveTrafficSales,
  createBdcSalesTrackerEntry,
  createBdcSalesTrackerDmsLogBulkEntries,
  createBdcSalesTrackerDmsLogEntry,
  deleteBdcSalesTrackerEntry,
  deleteBdcSalesTrackerDmsLogEntry,
  markBdcSalesTrackerDmsLogEntrySold,
  runSalesAnalyticsReport,
  updateBdcSalesTrackerDmsLogEntry,
} from "./api.js";
import CrmCleanupSection from "./CrmCleanupSection.jsx";
import { ADMIN_RELEASE_HISTORY, LATEST_ADMIN_RELEASE } from "./releaseHistory.js";
import SalesAnalyticsSection from "./SalesAnalyticsSection.jsx";
import {
  STAFF_ROSTER_DEALERSHIPS,
  buildStaffRosterCsv,
  normalizeStaffRosterLookupKey,
  parseStaffRosterCsv,
} from "./staffRosterCsv.js";
import "./App.css";

const TABS = [
  { id: "serviceCalendar", label: "Service Drive Calendar" },
  { id: "serviceNotes", label: "Service Drive Notes" },
  { id: "trafficAnalysis", label: "Service Drive Traffic Analysis" },
  { id: "bdc", label: "BDC Assign" },
  { id: "bdcSalesTracker", label: "BDC Sales Tracker" },
  { id: "salesAnalytics", label: "Sales Analytics" },
  { id: "reports", label: "BDC Reports" },
  { id: "crmCleanup", label: "CRM Cleanup" },
  { id: "traffic", label: "Service Drive Traffic" },
  { id: "freshUp", label: "Freshup Log" },
  { id: "marketplace", label: "Facebook Marketplace" },
  { id: "quote", label: "Quote Tool" },
  { id: "specials", label: "Specials" },
  { id: "admin", label: "Admin" },
];
const NON_ADMIN_TABS = TABS.filter((item) => item.id !== "admin");
const TAB_INDEX = Object.fromEntries(TABS.map((item, index) => [item.id, index]));
const SIGNED_OUT_HERO_QUOTE = {
  label: "Sales Energy",
  text: '"You can have everything in life you want, if you will just help other people get what they want."',
  author: "Zig Ziglar",
};

const SPECIAL_FEED_SOURCES = [
  {
    key: "kia_new",
    label: "Kia Monthly Specials",
    description: "Imports the live Kia specials page and turns it into month-stamped offer tiles.",
    defaultUrl: "https://www.bertogdenmissionkia.com/new-specials/",
  },
  {
    key: "mazda_new",
    label: "Mazda Monthly Specials",
    description: "Imports the live Mazda new inventory page and turns it into month-stamped offer tiles.",
    defaultUrl: "https://www.bertogdenmissionmazda.com/new-vehicles/",
  },
  {
    key: "used_srp",
    label: "Mission Auto Outlet Top Picks",
    description: "Pulls the strongest Mission Auto Outlet used picks from the live Mission search results page.",
    defaultUrl:
      "https://www.bertogdenmissionautooutlet.com/used-vehicles/?q=mission%2520&_dFR%5Btype%5D%5B0%5D=Pre-Owned&_dFR%5Btype%5D%5B1%5D=Certified%2520Pre-Owned",
  },
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
  { id: "salesAnalytics", label: "Sales Analytics" },
  { id: "tabs", label: "Page Order" },
  { id: "freshupLinks", label: "Freshup Links" },
  { id: "agentLoops", label: "Agent Loops" },
  { id: "marketplace", label: "Marketplace" },
  { id: "quoteRates", label: "Quote Rates" },
  { id: "specials", label: "Specials" },
];

function defaultTabVisibilityState() {
  return {
    entries: NON_ADMIN_TABS.map((item, index) => ({ tab_id: item.id, visible: true, position: index })),
  };
}

function sortTabVisibilityEntries(entries = []) {
  const fallbackEntries = NON_ADMIN_TABS.map((item, index) => ({
    tab_id: item.id,
    visible: true,
    position: index,
  }));
  const incomingById = new Map(
    (entries || [])
      .filter((entry) => NON_ADMIN_TABS.some((item) => item.id === entry.tab_id))
      .map((entry) => [entry.tab_id, entry])
  );
  return fallbackEntries
    .map((fallback) => ({
      ...fallback,
      ...(incomingById.get(fallback.tab_id) || {}),
    }))
    .sort((left, right) => {
      const leftPosition = Number.isFinite(Number(left.position)) ? Number(left.position) : TAB_INDEX[left.tab_id] ?? 0;
      const rightPosition = Number.isFinite(Number(right.position)) ? Number(right.position) : TAB_INDEX[right.tab_id] ?? 0;
      return leftPosition - rightPosition || (TAB_INDEX[left.tab_id] ?? 0) - (TAB_INDEX[right.tab_id] ?? 0);
    })
    .map((entry, index) => ({ ...entry, position: index }));
}

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
const TRACKER_NO_APT_OPTION = {
  name: "NO APT",
  source: "Missed appointment payout",
  sortKey: -1,
};
const TRACKER_HISTORICAL_INPUT_LABEL = "Historical Input";
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
  "Which weekdays carry the most traffic?",
  "How many rows are 100k miles or older?",
  "Where are the best upgrade opportunities?",
  "Who owns the most appointments?",
];
const FRESH_UP_STORAGE_KEY = "dealer_tool_fresh_up_form";
const SERVICE_NOTES_PREFERENCES_KEY = "dealer_tool_service_notes_prefs";
const BDC_SALES_TRACKER_PREFERENCES_KEY = "dealer_tool_bdc_sales_tracker_prefs";
const ADMIN_TOKEN_STORAGE_KEY = "dealer_tool_admin_token";
const FRESH_UP_DEFAULTS = {
  customerName: "",
  phone: "",
  salespersonId: "",
  salespersonQuery: "",
  source: "Desk",
};
const FRESHUP_LINKS_DEFAULTS = {
  page_title: "Get your gift",
  page_subtitle: "Enter your phone first. We will text this month's gift code, then choose the next step below.",
  form_title: "Text me my gift code",
  form_subtitle: "Your salesperson stays attached to this form.",
  submit_label: "Get Your Gift",
  stores: [
    {
      dealership: "Kia",
      display_name: "Mission Kia",
      call_label: "Call Sales Agent",
      call_url: "tel:(956) 429 8898",
      maps_label: "Google Maps",
      maps_url:
        "https://www.google.com/maps/place/Bert+Ogden+Mission+Kia/@26.1969595,-98.2927102,17z/data=!3m1!4b1!4m6!3m5!1s0x8665a7eced82c205:0x3fe685adeab8c28e!8m2!3d26.1969595!4d-98.2901353!16s%2Fg%2F1tjdgmn5?entry=ttu&g_ep=EgoyMDI2MDIyMi4wIKXMDSoASAFQAw%3D%3D",
      instagram_url: "https://www.instagram.com/bertogdenkiamission/",
      facebook_url: "https://www.facebook.com/BertOgdenMissionKia",
      youtube_url: "https://www.youtube.com/channel/UCGVeQ1vKWK3bLq396D8P_4A",
      soft_pull_label: "Quick Qualify Application",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/fcb574d194ea477c945ec558b605c0f7-202061",
      hard_pull_label: "Hard Pull Credit Submission",
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
      soft_pull_label: "Quick Qualify Application",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/3019d192efae4e3684cc49a88095425a-202061",
      hard_pull_label: "Hard Pull Credit Submission",
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
      soft_pull_label: "Quick Qualify Application",
      soft_pull_url: "https://www.700dealer.com/QuickQualify/88a0b45934bf4a4e8937c8ccb61c463f-202061",
      hard_pull_label: "Hard Pull Credit Submission",
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
const CALENDAR_WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TRAFFIC_TIME_WINDOWS = [
  { key: "early", label: "Before 9a", min: 0, max: 8 },
  { key: "morning", label: "9a to 11a", min: 9, max: 11 },
  { key: "midday", label: "Noon to 2p", min: 12, max: 14 },
  { key: "afternoon", label: "3p to 5p", min: 15, max: 17 },
  { key: "late", label: "After 5p", min: 18, max: 23 },
];
const TRAFFIC_ODOMETER_BANDS = [
  { key: "under30", label: "Under 30k", min: 0, max: 29999 },
  { key: "30to60", label: "30k to 59k", min: 30000, max: 59999 },
  { key: "60to90", label: "60k to 89k", min: 60000, max: 89999 },
  { key: "90to120", label: "90k to 119k", min: 90000, max: 119999 },
  { key: "120plus", label: "120k+", min: 120000, max: Number.POSITIVE_INFINITY },
];
const TRAFFIC_VEHICLE_AGE_BANDS = [
  { key: "late", label: "0 to 2 yrs", min: 0, max: 2 },
  { key: "mid", label: "3 to 5 yrs", min: 3, max: 5 },
  { key: "mature", label: "6 to 8 yrs", min: 6, max: 8 },
  { key: "older", label: "9+ yrs", min: 9, max: Number.POSITIVE_INFINITY },
];
const SALES_ANALYTICS_VARIANTS = [
  { key: "sales", label: "Sales people" },
  { key: "sales-manager", label: "Sales managers" },
  { key: "bdc-staff", label: "BDC staff" },
];
const SALES_ANALYTICS_PULL_WINDOW_LABEL = "2 to 4 minutes";
const DEFAULT_BDC_LEAD_PUSH_CONFIG = {
  enabled: true,
  chat_name: "Kau 429-8898 (You)",
  runner_ready: false,
  runner_online: false,
  runner_label: "Home PC",
  runner_status_text: "",
  message_type: "whatsapp-self",
};

function emptySalesAnalyticsDashboard() {
  return {
    config: {
      variant_key: "sales",
      variant_label: "Sales people",
      schedule_label: "",
      schedule_days: [],
      schedule_times: [],
      chat_name: "Kau 429-8898 (You)",
      report_name: "BDC Activity Report Sales",
      runner_ready: false,
      runner_online: false,
      runner_label: "Home PC",
      runner_status_text: "",
      can_trigger: false,
    },
    status: {
      variant_key: "sales",
      variant_label: "Sales people",
      state: "idle",
      started_at: "",
      finished_at: "",
      last_success_at: "",
      last_error: "",
      message: "",
    },
    latest: null,
    history: [],
  };
}

function applySalesAnalyticsStatusToDashboard(dashboard, status) {
  if (!status) return dashboard || emptySalesAnalyticsDashboard();
  return {
    ...(dashboard || emptySalesAnalyticsDashboard()),
    status: {
      ...(dashboard?.status || emptySalesAnalyticsDashboard().status),
      ...status,
    },
  };
}

function emptySalesAnalyticsDashboardMap() {
  return Object.fromEntries(SALES_ANALYTICS_VARIANTS.map((variant) => [variant.key, emptySalesAnalyticsDashboard()]));
}

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

function weekdayShortLabel(index) {
  return CALENDAR_WEEKDAYS[index] || "";
}

function weekdayLongLabel(index) {
  return CALENDAR_WEEKDAY_LONG[index] || "";
}

function parseDateLike(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
  return new Date(raw);
}

function dateTimeLabel(value) {
  const parsed = parseDateLike(value);
  if (!parsed) return "";
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function specialMonthStamp(value) {
  const parsed = parseDateLike(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return monthLabel(currentMonth());
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsed);
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

function bdcNotificationToneClass(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("fail") || text.includes("error") || text.includes("not ready")) return "is-warning";
  if (text.includes("queued") || text.includes("sent") || text.includes("delivered")) return "is-success";
  if (text.includes("disabled") || text.includes("paused") || text.includes("skipped")) return "is-neutral";
  return "is-neutral";
}

function humanStatusLabel(value) {
  const text = String(value || "idle").trim();
  if (!text) return "Idle";
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function formatWholeNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return Math.round(numeric).toLocaleString("en-US");
}

function parseTrafficYearValue(value) {
  const match = String(value || "").match(/\b(19|20)\d{2}\b/);
  if (!match) return 0;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : 0;
}

function medianNumber(values) {
  const list = (values || []).filter((value) => Number.isFinite(Number(value))).map((value) => Number(value)).sort((a, b) => a - b);
  if (!list.length) return 0;
  const middle = Math.floor(list.length / 2);
  if (list.length % 2 === 1) return list[middle];
  return (list[middle - 1] + list[middle]) / 2;
}

function averageNumber(values) {
  const list = (values || []).filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function trafficEntryAppointmentHour(entry) {
  const appointmentTs = Number(entry?.appointment_ts || 0);
  if (appointmentTs > 0) {
    return new Date(appointmentTs * 1000).getHours();
  }
  const match = String(entry?.appointment_label || "").match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return null;
  let hours = Number(match[1] || 0);
  const meridiem = String(match[3] || "").toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return Number.isFinite(hours) ? hours : null;
}

function trafficTimeWindowForEntry(entry) {
  const hour = trafficEntryAppointmentHour(entry);
  if (hour === null) return "";
  return TRAFFIC_TIME_WINDOWS.find((window) => hour >= window.min && hour <= window.max)?.key || "";
}

function trafficSourceLabelFromOffer(details = {}) {
  const raw = String(details.imported || "").toLowerCase();
  if (!raw) return "Manual";
  if (raw.includes("reynolds")) return "Reynolds";
  if (raw.includes("mastermind")) return "Mastermind";
  return "Imported";
}

function trafficModelFamilyLabel(modelMake, vehicleYear) {
  const base = String(modelMake || "").replace(new RegExp(`^${String(vehicleYear || "").trim()}\\s+`), "").trim();
  return base || String(modelMake || "").trim() || "Unknown vehicle";
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

function formatPercent(value, digits = 1) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(digits)}%`;
}

function formatTrackerNumber(value, digits = 1) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : "0.0";
}

function bdcSalesTrackerAgentKey(agent) {
  return `agent-${agent?.agent_id ?? "unknown"}`;
}

function emptyBdcSalesTrackerEntryDraft() {
  return { dms_number: "", dms_numbers_text: "", profile_name: "", customer_phone: "", notes: "" };
}

function emptyBdcSalesTrackerNoteDraft() {
  return "";
}

function emptyBdcSalesTrackerDmsLogDraft() {
  return { customer_name: "", apt_set_under: "", notes: "" };
}

function emptyBdcSalesTrackerDmsBulkDraft() {
  return { dms_numbers_text: "", apt_set_under: "", notes: "" };
}

function parseBdcSalesTrackerDmsLogIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return { customer_name: "", opportunity_id: "", dms_number: "" };
  }
  const parts = raw
    .split("/")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return { customer_name: raw, opportunity_id: "", dms_number: "" };
  }
  let opportunity_id = "";
  let dms_number = "";
  for (const part of parts.slice(1)) {
    const lowered = part.toLowerCase();
    if (!opportunity_id && (lowered.includes("opp") || lowered.includes("opportunity"))) {
      opportunity_id = part.replace(/^(?:opp(?:ortunity)?\s*id\.?\s*[:#-]?\s*)/i, "").replace(/^[\s.:-]+|[\s.:-]+$/g, "");
      continue;
    }
    if (!dms_number && lowered.includes("dms")) {
      dms_number = part.replace(/^(?:dms\s*(?:no\.?|number)?\s*[:#-]?\s*)/i, "").replace(/^[\s.:-]+|[\s.:-]+$/g, "");
      continue;
    }
    if (!opportunity_id) {
      opportunity_id = part;
    } else if (!dms_number) {
      dms_number = part;
    }
  }
  return {
    customer_name: parts[0],
    opportunity_id,
    dms_number,
  };
}

function defaultBdcSalesTrackerRulesDraft() {
  return {
    appointment_set_rate_floor: "20",
    appointment_set_rate_target: "30",
    appointment_show_rate_floor: "50",
    appointment_show_rate_target: "60",
    sold_from_appointments_rate_floor: "10",
    sold_from_appointments_rate_target: "15",
    sold_from_appointments_rate_ceiling: "18",
  };
}

function parseBdcSalesTrackerDraftNumbers(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const seen = new Set();
  const numbers = [];
  raw.split(/[\s,;|]+/).forEach((chunk) => {
    const token = String(chunk || "").trim();
    if (!token) return;
    const lowered = token.toLowerCase();
    if (seen.has(lowered)) return;
    seen.add(lowered);
    numbers.push(token);
  });
  return numbers;
}

function trackerEntryHasSaleIdentity(entry) {
  return Boolean(
    String(entry?.profile_name || "").trim() ||
      String(entry?.opportunity_id || "").trim() ||
      String(entry?.dms_number || "").trim() ||
      String(entry?.customer_phone || "").trim()
  );
}

function trackerEntryIsNoteOnly(entry) {
  return !trackerEntryHasSaleIdentity(entry) && Boolean(String(entry?.notes || "").trim());
}

function trackerEntryFieldValue(entry, field) {
  if (field === "profile_name") return String(entry?.profile_name || "");
  if (field === "opportunity_id") return String(entry?.opportunity_id || "");
  if (field === "dms_number") return String(entry?.dms_number || "");
  if (field === "notes") return String(entry?.notes || "");
  return [
    String(entry?.profile_name || ""),
    String(entry?.opportunity_id || ""),
    String(entry?.dms_number || ""),
    String(entry?.customer_phone || ""),
    String(entry?.notes || ""),
  ].join(" ");
}

function trackerEntryMatchesSearch(entry, field, query) {
  const normalizedQuery = normalizeLookupText(query);
  if (!normalizedQuery) return true;
  return normalizeLookupText(trackerEntryFieldValue(entry, field)).includes(normalizedQuery);
}

function trackerPendingEntries(entries = []) {
  return (entries || []).filter((entry) => !Boolean(entry?.sold));
}

function trackerSoldEntries(entries = []) {
  return (entries || []).filter((entry) => Boolean(entry?.sold));
}

function trackerPendingSaleEntries(entries = []) {
  return trackerPendingEntries(entries).filter((entry) => trackerEntryHasSaleIdentity(entry));
}

function trackerPipelineCount(agent) {
  return Number(agent?.sold_count || 0) + trackerPendingSaleEntries(agent?.entries || []).length;
}

function percentOfTotal(value, total) {
  const safeTotal = Number(total || 0);
  if (!safeTotal) return 0;
  return Math.max(0, Math.min(100, (Number(value || 0) / safeTotal) * 100));
}

function trackerBenchmarkTone(rate, floor) {
  return Number(rate || 0) >= Number(floor || 0) ? "is-good" : "is-bad";
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

function readBdcSalesTrackerPreferences() {
  const defaults = { focusKey: "" };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(BDC_SALES_TRACKER_PREFERENCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      focusKey: String(parsed?.focusKey || "").trim(),
    };
  } catch {
    return defaults;
  }
}

function readAdminToken() {
  if (typeof window === "undefined") return COOKIE_ADMIN_SESSION_MARKER;
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || COOKIE_ADMIN_SESSION_MARKER;
  } catch {
    return COOKIE_ADMIN_SESSION_MARKER;
  }
}

function storeAdminToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token && token !== COOKIE_ADMIN_SESSION_MARKER) {
      window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Session storage is an enhancement; the HttpOnly cookie still carries the session.
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

function freshUpValidationMessage(form, salesperson) {
  if (!salesperson?.id) return "Choose the salesperson first.";
  if (!String(form.customerName || "").trim()) return "Enter the customer name.";
  const phoneDigits = digitsOnly(form.phone);
  if (phoneDigits.length !== 10) return "Enter a 10 digit phone number.";
  return "";
}

function freshUpGiftCustomerStatus(result, customerPhone, salespersonName) {
  const giftCode = String(result?.gift_code || "").trim();
  if (result?.gift_sms_sent) {
    return giftCode ? `Gift text sent. Your code is ${giftCode}.` : `Gift text sent to ${customerPhone}.`;
  }
  if (giftCode) {
    return `Gift request saved. If the text does not arrive, show code ${giftCode} to your salesperson.`;
  }
  return `Gift request saved. ${salespersonName || "Our team"} has your name and phone.`;
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

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function phoneHref(value) {
  const digits = digitsOnly(value);
  return digits ? `tel:${digits}` : "";
}

function normalizedFreshUpActionLabel(kind, value) {
  const text = String(value || "").trim();
  if (kind === "soft_pull") {
    if (!text || /^quick qualify$/i.test(text) || /^quick qualify application$/i.test(text)) {
      return "Quick Qualify Application";
    }
  }
  if (kind === "hard_pull") {
    if (!text || /^quick application$/i.test(text) || /^kia quick application$/i.test(text) || /^hard pull credit submission$/i.test(text)) {
      return "Hard Pull Credit Submission";
    }
  }
  return text;
}

function normalizeFreshUpStore(store) {
  return {
    ...store,
    soft_pull_label: normalizedFreshUpActionLabel("soft_pull", store?.soft_pull_label),
    hard_pull_label: normalizedFreshUpActionLabel("hard_pull", store?.hard_pull_label),
  };
}

function normalizeFreshUpLinksConfig(config) {
  const defaultsByStore = new Map(FRESHUP_LINKS_DEFAULTS.stores.map((store) => [store.dealership, store]));
  const rawStores = Array.isArray(config?.stores) && config.stores.length ? config.stores : FRESHUP_LINKS_DEFAULTS.stores;
  const seen = new Set();
  const stores = rawStores.map((store) => {
    const dealership = String(store?.dealership || "").trim();
    seen.add(dealership);
    return normalizeFreshUpStore({
      ...(defaultsByStore.get(dealership) || {}),
      ...store,
    });
  });
  for (const defaultStore of FRESHUP_LINKS_DEFAULTS.stores) {
    if (!seen.has(defaultStore.dealership)) {
      stores.push(normalizeFreshUpStore(defaultStore));
    }
  }
  return {
    ...FRESHUP_LINKS_DEFAULTS,
    ...(config || {}),
    stores,
  };
}

function escapeVCardValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function downloadFileName(value, fallback = "contact") {
  const cleaned = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-");
  return cleaned || fallback;
}

function freshUpContactCardHref(person, store) {
  const name = String(person?.name || "").trim();
  const digits = digitsOnly(person?.phone_number);
  if (!name || !digits) return "";
  const company = String(store?.display_name || person?.dealership || "Bert Ogden Mission").trim();
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCardValue(name)}`,
    `ORG:${escapeVCardValue(company)}`,
    "TITLE:Sales Specialist",
    `TEL;TYPE=CELL,VOICE:${digits}`,
    "END:VCARD",
  ];
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
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
    soft_pull: "Quick Qualify Application",
    hard_pull: "Hard Pull Credit Submission",
    inventory: "Inventory",
    maps: "Maps",
    call: "Call",
    contact_save: "Save Contact",
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

async function readClipboardText() {
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  throw new Error("Clipboard read is not available in this browser.");
}

function buildImportedSalespersonPayload(row, existing) {
  const dealership = row.dealership || existing?.dealership || "";
  if (!STAFF_ROSTER_DEALERSHIPS.includes(dealership)) {
    throw new Error(`Sales row "${row.name}" must use Kia, Mazda, or Outlet in the dealership column.`);
  }

  return {
    name: row.name,
    dealership,
    weekly_days_off: Array.isArray(existing?.weekly_days_off) ? [...existing.weekly_days_off] : [],
    active: typeof row.active === "boolean" ? row.active : Boolean(existing?.active ?? true),
    phone_number: row.phoneNumber === null ? String(existing?.phone_number || "") : row.phoneNumber,
    email: row.email === null ? String(existing?.email || "") : row.email,
    notify_sms: typeof row.notifySms === "boolean" ? row.notifySms : Boolean(existing?.notify_sms),
    notify_email: typeof row.notifyEmail === "boolean" ? row.notifyEmail : Boolean(existing?.notify_email),
  };
}

function buildImportedBdcAgentPayload(row, existing) {
  return {
    name: row.name,
    active: typeof row.active === "boolean" ? row.active : Boolean(existing?.active ?? true),
  };
}

function salespersonMatchesPayload(existing, payload) {
  return (
    String(existing?.name || "") === payload.name &&
    String(existing?.dealership || "") === payload.dealership &&
    String(existing?.phone_number || "") === payload.phone_number &&
    String(existing?.email || "") === payload.email &&
    Boolean(existing?.notify_sms) === Boolean(payload.notify_sms) &&
    Boolean(existing?.notify_email) === Boolean(payload.notify_email) &&
    Boolean(existing?.active) === Boolean(payload.active)
  );
}

function bdcAgentMatchesPayload(existing, payload) {
  return String(existing?.name || "") === payload.name && Boolean(existing?.active) === Boolean(payload.active);
}

function formatStaffRosterImportSummary(summary) {
  const parts = [
    `${summary.updated} updated`,
    `${summary.created} created`,
    `${summary.unchanged} unchanged`,
  ];
  if (summary.failed) {
    parts.push(`${summary.failed} failed`);
  }
  return parts.join(", ");
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new Error("File download is not available in this environment.");
  }
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function buildSpecialFeedImportScript(sourceKey) {
  return `(async () => {
  const SOURCE_KEY = ${JSON.stringify(sourceKey)};
  const collapse = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const titlePattern = /\\b(?:19|20)\\d{2}\\b/;
  const firstMatch = (text, pattern) => {
    const match = String(text || "").match(pattern);
    return match ? collapse(match[0]) : "";
  };
  const firstLine = (text, predicate) =>
    String(text || "")
      .split(/\\n+/)
      .map(collapse)
      .find((line) => line && predicate(line)) || "";
  const titleFrom = (node, text) => {
    const heading = Array.from(node.querySelectorAll("h1,h2,h3,h4,h5,strong,[class*='title'],[class*='model']"))
      .map((el) => collapse(el.innerText))
      .find((line) => line && (titlePattern.test(line) || line.length >= 12));
    return (
      heading ||
      firstLine(text, (line) => titlePattern.test(line)) ||
      firstLine(text, (line) => line.length >= 12) ||
      ""
    );
  };
  const badgeFrom = (node) =>
    collapse(
      node.querySelector("[class*='badge'], [class*='tag'], [class*='eyebrow'], [class*='label']")?.innerText ||
        (SOURCE_KEY === "used_srp" ? "Used Deal Pick" : SOURCE_KEY === "kia_new" ? "Kia New" : "Mazda New")
    );
  const hrefFrom = (node) => node.querySelector("a[href]")?.href || "";
  const imageFrom = (node) => node.querySelector("img")?.src || "";
  const subtitleFrom = (text, title) =>
    firstLine(
      text,
      (line) =>
        line !== title &&
        !line.startsWith("$") &&
        !/miles?/i.test(line) &&
        !/apr|lease|finance|msrp|stock/i.test(line) &&
        line.length <= 96
    );
  const noteFrom = (text, title, subtitle) =>
    firstLine(
      text,
      (line) =>
        line &&
        line !== title &&
        line !== subtitle &&
        /lease|apr|finance|stock|vin|drive|payment|special|discount|save/i.test(line) &&
        line.length <= 140
    );
  const qualifies = (text, href) => {
    const hasMoney = /\\$\\s?\\d/.test(text);
    const hasMiles = /\\b\\d[\\d,]*\\s*miles?\\b/i.test(text);
    const hasYear = titlePattern.test(text);
    if (SOURCE_KEY === "kia_new") return hasMoney || /lease|apr|finance|signing|payment/i.test(text);
    if (SOURCE_KEY === "mazda_new") return hasYear && (href.includes("/inventory/") || hasMoney || /msrp|sale/i.test(text));
    return hasYear && (hasMiles || hasMoney || href.includes("/inventory/"));
  };
  const anchorCandidates = Array.from(document.querySelectorAll("a[href]"))
    .filter((anchor) => {
      const href = anchor.href || "";
      return SOURCE_KEY === "kia_new" ? /inventory|special/i.test(href) : /\\/inventory\\//i.test(href);
    })
    .map((anchor) => anchor.closest("article, li, section, div") || anchor);
  const genericCandidates = Array.from(
    document.querySelectorAll("article, [class*='vehicle'], [class*='special'], [class*='offer'], [class*='card'], li")
  );
  const nodes = Array.from(new Set([...anchorCandidates, ...genericCandidates]));
  const seen = new Set();
  const entries = [];
  for (const node of nodes) {
    if (!node || typeof node.querySelectorAll !== "function") continue;
    const text = collapse(node.innerText || node.textContent || "");
    if (text.length < 40 || text.length > 1400) continue;
    const href = hrefFrom(node);
    if (!qualifies(text, href)) continue;
    const title = titleFrom(node, text);
    if (!title) continue;
    const subtitle = subtitleFrom(text, title);
    const priceText = firstMatch(text, /\\$\\s?\\d[\\d,]*(?:\\.\\d{2})?(?!\\s*(?:\\/\\s*)?(?:mo|month))/i);
    const paymentText =
      firstMatch(text, /\\$\\s?\\d[\\d,]*(?:\\.\\d{2})?\\s*(?:\\/\\s*)?(?:mo|month)\\b/i) ||
      firstMatch(text, /\\$\\s?\\d[\\d,]*(?:\\.\\d{2})?\\s+due at signing\\b/i);
    const mileageText = firstMatch(text, /\\b\\d[\\d,]*\\s*miles?\\b/i);
    const note = noteFrom(text, title, subtitle);
    const dedupeKey = [title.toLowerCase(), href.toLowerCase(), priceText.toLowerCase(), mileageText.toLowerCase()].join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    entries.push({
      badge: badgeFrom(node),
      title,
      subtitle,
      price_text: priceText,
      payment_text: paymentText,
      mileage_text: mileageText,
      note,
      image_url: imageFrom(node),
      link_url: href,
    });
  }
  const payload = {
    source_key: SOURCE_KEY,
    source_url: location.href,
    entries: entries.slice(0, SOURCE_KEY === "used_srp" ? 24 : 16),
  };
  const output = JSON.stringify(payload);
  try {
    await navigator.clipboard.writeText(output);
    alert(\`Copied \${payload.entries.length} \${SOURCE_KEY} entries to the clipboard.\`);
  } catch (error) {
    console.log(output);
    prompt("Copy specials payload", output);
  }
})();`;
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

function buildTrafficAnalysis(entries, countsByDate, monthKey) {
  const rows = Array.isArray(entries) ? entries : [];
  const analysisYear = Number(String(monthKey || currentMonth()).split("-")[0]) || new Date().getFullYear();
  const brandCounts = { Kia: 0, Mazda: 0 };
  const notesByBrand = { Kia: 0, Mazda: 0 };
  const brandOdometerValues = { Kia: [], Mazda: [] };
  const assigneeCounts = {};
  const statusCounts = {};
  const sourceCounts = {};
  const transportationCounts = {};
  const noteAuthorCounts = {};
  const noteTermCounts = {};
  const modelCounts = {};
  const dayStats = new Map();
  const weekdayStats = new Map();
  const pendingRows = [];
  const odometerValues = [];
  const vehicleAgeValues = [];
  const odometerBandCounts = Object.fromEntries(TRAFFIC_ODOMETER_BANDS.map((item) => [item.key, 0]));
  const vehicleAgeBandCounts = Object.fromEntries(TRAFFIC_VEHICLE_AGE_BANDS.map((item) => [item.key, 0]));
  const timeWindowCounts = Object.fromEntries(TRAFFIC_TIME_WINDOWS.map((item) => [item.key, 0]));
  let rowsWithNotes = 0;
  let highMileageCount = 0;
  let tradeCycleCount = 0;
  let openTradeCycleCount = 0;
  let lateModelEquityCount = 0;
  let olderVehicleCount = 0;

  for (let index = 0; index < 7; index += 1) {
    weekdayStats.set(index, { weekdayIndex: index, label: weekdayLongLabel(index), shortLabel: weekdayShortLabel(index), count: 0, notes: 0 });
  }

  for (const entry of rows) {
    const brand = entry.brand === "Mazda" ? "Mazda" : "Kia";
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    const details = trafficOfferIdeaLookup(entry.offer_idea);
    const assignee = String(details.assignee || details.advisor || details["appointment taker"] || "").trim();
    const status = String(details["deal status"] || details.status || details["overall status"] || details["customer type"] || "").trim();
    const sourceLabel = trafficSourceLabelFromOffer(details);
    const transportationLabel = String(details.transportation || details.outreach || "").trim();
    const hasNotes = Boolean(String(entry.sales_notes || "").trim());
    const trafficDate = String(entry.traffic_date || "");
    const weekdayIndex = trafficDate ? dateParts(trafficDate).weekdayIndex : 0;
    const dayCurrent = dayStats.get(trafficDate) || { date: trafficDate, count: 0, notes: 0 };
    dayCurrent.count += 1;
    if (hasNotes) dayCurrent.notes += 1;
    dayStats.set(trafficDate, dayCurrent);
    const weekdayCurrent = weekdayStats.get(weekdayIndex) || {
      weekdayIndex,
      label: weekdayLongLabel(weekdayIndex),
      shortLabel: weekdayShortLabel(weekdayIndex),
      count: 0,
      notes: 0,
    };
    weekdayCurrent.count += 1;
    if (hasNotes) weekdayCurrent.notes += 1;
    weekdayStats.set(weekdayIndex, weekdayCurrent);

    if (assignee) assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
    sourceCounts[sourceLabel] = (sourceCounts[sourceLabel] || 0) + 1;
    if (transportationLabel) transportationCounts[transportationLabel] = (transportationCounts[transportationLabel] || 0) + 1;

    const timeWindowKey = trafficTimeWindowForEntry(entry);
    if (timeWindowKey) {
      timeWindowCounts[timeWindowKey] = (timeWindowCounts[timeWindowKey] || 0) + 1;
    }

    const odometerValue = numericValue(entry.odometer || details.odometer || details["current mileage"] || "");
    if (odometerValue > 0) {
      odometerValues.push(odometerValue);
      brandOdometerValues[brand].push(odometerValue);
      const odometerBand = TRAFFIC_ODOMETER_BANDS.find((band) => odometerValue >= band.min && odometerValue <= band.max);
      if (odometerBand) odometerBandCounts[odometerBand.key] = (odometerBandCounts[odometerBand.key] || 0) + 1;
      if (odometerValue >= 100000) highMileageCount += 1;
    }

    const vehicleYearValue = parseTrafficYearValue(
      entry.vehicle_year || entry.model_make || details["current vehicle"] || details["replacement vehicle"] || ""
    );
    const vehicleAge = vehicleYearValue && vehicleYearValue <= analysisYear + 1 ? Math.max(0, analysisYear - vehicleYearValue) : null;
    if (vehicleAge !== null) {
      vehicleAgeValues.push(vehicleAge);
      const ageBand = TRAFFIC_VEHICLE_AGE_BANDS.find((band) => vehicleAge >= band.min && vehicleAge <= band.max);
      if (ageBand) vehicleAgeBandCounts[ageBand.key] = (vehicleAgeBandCounts[ageBand.key] || 0) + 1;
      if (vehicleAge >= 9) olderVehicleCount += 1;
    }

    const modelLabel = trafficModelFamilyLabel(entry.model_make, vehicleYearValue || entry.vehicle_year);
    modelCounts[modelLabel] = (modelCounts[modelLabel] || 0) + 1;

    const isTradeCycle = odometerValue >= 60000 || (vehicleAge !== null && vehicleAge >= 5);
    const isLateModelEquity = (vehicleAge !== null && vehicleAge <= 3) && (odometerValue === 0 || odometerValue <= 45000);
    if (isTradeCycle) tradeCycleCount += 1;
    if (isTradeCycle && !hasNotes) openTradeCycleCount += 1;
    if (isLateModelEquity) lateModelEquityCount += 1;

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

  const allDates = Array.from(
    new Set([
      ...Object.keys(countsByDate || {}),
      ...Array.from(dayStats.keys()).filter(Boolean),
    ])
  );
  const dateCountsChronological = allDates
    .map((date) => {
      const count = Number((countsByDate || {})[date] || dayStats.get(date)?.count || 0);
      const notes = Number(dayStats.get(date)?.notes || 0);
      const parts = dateParts(date);
      return {
        date,
        count,
        notes,
        noteCoverage: count ? Math.round((notes / count) * 100) : 0,
        weekdayIndex: parts.weekdayIndex,
        weekdayShort: weekdayShortLabel(parts.weekdayIndex),
        weekdayLong: weekdayLongLabel(parts.weekdayIndex),
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  const dateCountsDescending = [...dateCountsChronological].sort(
    (left, right) => right.count - left.count || left.date.localeCompare(right.date)
  );

  const sortCountMap = (sourceMap) =>
    Object.entries(sourceMap)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  const sortedAssignees = sortCountMap(assigneeCounts);
  const sortedStatuses = sortCountMap(statusCounts);
  const sortedAuthors = sortCountMap(noteAuthorCounts);
  const sortedTerms = sortCountMap(noteTermCounts);
  const sortedSources = sortCountMap(sourceCounts);
  const sortedTransportation = sortCountMap(transportationCounts);
  const sortedModels = sortCountMap(modelCounts);
  const sortedPendingRows = [...pendingRows].sort((left, right) => {
    const leftDate = `${left.traffic_date || ""} ${left.appointment_label || ""}`.trim();
    const rightDate = `${right.traffic_date || ""} ${right.appointment_label || ""}`.trim();
    return leftDate.localeCompare(rightDate) || String(left.customer_name || "").localeCompare(String(right.customer_name || ""));
  });
  const totalRows = rows.length;
  const activeDays = dateCountsChronological.filter((item) => item.count > 0).length;
  const noteCoverage = totalRows ? Math.round((rowsWithNotes / totalRows) * 100) : 0;
  const pendingCount = totalRows - rowsWithNotes;
  const busiestDay = dateCountsDescending[0] || null;
  const kiaRows = brandCounts.Kia || 0;
  const mazdaRows = brandCounts.Mazda || 0;
  const totalBrandRows = kiaRows + mazdaRows || 1;
  const avgOdometer = averageNumber(odometerValues);
  const medianOdometer = medianNumber(odometerValues);
  const avgVehicleAge = averageNumber(vehicleAgeValues);
  const medianVehicleAge = medianNumber(vehicleAgeValues);
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

  return {
    totalRows,
    rowsWithNotes,
    pendingCount,
    noteCoverage,
    activeDays,
    avgPerDay: activeDays ? (totalRows / activeDays).toFixed(1) : "0.0",
    busiestDay,
    avgOdometer,
    medianOdometer,
    avgVehicleAge,
    medianVehicleAge,
    tradeCycleCount,
    openTradeCycleCount,
    highMileageCount,
    lateModelEquityCount,
    olderVehicleCount,
    topDays: dateCountsDescending.slice(0, 5),
    timeline: dateCountsChronological,
    weekdayCards: weekdayOrder.map((index) => {
      const item = weekdayStats.get(index) || { label: weekdayLongLabel(index), shortLabel: weekdayShortLabel(index), count: 0, notes: 0 };
      return {
        ...item,
        noteCoverage: item.count ? Math.round((item.notes / item.count) * 100) : 0,
        share: totalRows ? Math.round((item.count / totalRows) * 100) : 0,
      };
    }),
    timeWindowCards: TRAFFIC_TIME_WINDOWS.map((window) => ({
      key: window.key,
      label: window.label,
      count: Number(timeWindowCounts[window.key] || 0),
      share: totalRows ? Math.round((Number(timeWindowCounts[window.key] || 0) / totalRows) * 100) : 0,
    })),
    brandCards: [
      {
        brand: "Kia",
        rows: kiaRows,
        noteCoverage: kiaRows ? Math.round(((notesByBrand.Kia || 0) / kiaRows) * 100) : 0,
        share: Math.round((kiaRows / totalBrandRows) * 100),
        avgOdometer: averageNumber(brandOdometerValues.Kia),
      },
      {
        brand: "Mazda",
        rows: mazdaRows,
        noteCoverage: mazdaRows ? Math.round(((notesByBrand.Mazda || 0) / mazdaRows) * 100) : 0,
        share: Math.round((mazdaRows / totalBrandRows) * 100),
        avgOdometer: averageNumber(brandOdometerValues.Mazda),
      },
    ],
    odometerBands: TRAFFIC_ODOMETER_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      count: Number(odometerBandCounts[band.key] || 0),
      share: odometerValues.length ? Math.round((Number(odometerBandCounts[band.key] || 0) / odometerValues.length) * 100) : 0,
    })),
    vehicleAgeBands: TRAFFIC_VEHICLE_AGE_BANDS.map((band) => ({
      key: band.key,
      label: band.label,
      count: Number(vehicleAgeBandCounts[band.key] || 0),
      share: vehicleAgeValues.length ? Math.round((Number(vehicleAgeBandCounts[band.key] || 0) / vehicleAgeValues.length) * 100) : 0,
    })),
    opportunityCards: [
      {
        key: "trade-cycle",
        label: "Trade-cycle rows",
        count: tradeCycleCount,
        share: totalRows ? Math.round((tradeCycleCount / totalRows) * 100) : 0,
        tone: "warm",
        description: "60k+ miles or 5+ model years. These are the cleanest service-to-sales upgrade rows.",
      },
      {
        key: "open-trade-cycle",
        label: "Open upgrade rows",
        count: openTradeCycleCount,
        share: tradeCycleCount ? Math.round((openTradeCycleCount / tradeCycleCount) * 100) : 0,
        tone: openTradeCycleCount ? "hot" : "cool",
        description: "Trade-cycle customers still missing salesperson notes or follow-up.",
      },
      {
        key: "high-mileage",
        label: "100k+ mileage",
        count: highMileageCount,
        share: totalRows ? Math.round((highMileageCount / totalRows) * 100) : 0,
        tone: "hot",
        description: "High-mileage visits usually carry stronger replacement urgency and trade conversations.",
      },
      {
        key: "late-model",
        label: "Late-model equity",
        count: lateModelEquityCount,
        share: totalRows ? Math.round((lateModelEquityCount / totalRows) * 100) : 0,
        tone: "cool",
        description: "Newer, lower-mileage vehicles that may still have equity or pull-forward potential.",
      },
    ],
    topAssignees: sortedAssignees.slice(0, 5),
    statuses: sortedStatuses.slice(0, 6),
    topAuthors: sortedAuthors.slice(0, 5),
    topTerms: sortedTerms.slice(0, 8),
    topModels: sortedModels.slice(0, 6),
    sources: sortedSources.slice(0, 4),
    transportationMix: sortedTransportation.slice(0, 5),
    pendingRows: sortedPendingRows.slice(0, 8),
  };
}

function answerTrafficAnalysisQuestion(question, analysis, monthKey) {
  const rawQuestion = String(question || "").trim();
  if (!rawQuestion) {
    return "Ask about busiest days, weekday rhythm, mileage bands, or which service rows look strongest for sales follow-up.";
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

  if (normalized.includes("weekday") || normalized.includes("monday") || normalized.includes("tuesday") || normalized.includes("wednesday") || normalized.includes("thursday") || normalized.includes("friday") || normalized.includes("saturday")) {
    const weekdayLeaders = analysis.weekdayCards
      .filter((item) => item.count > 0)
      .sort((left, right) => right.count - left.count || left.weekdayIndex - right.weekdayIndex)
      .map((item) => `${item.label} (${item.count})`);
    return weekdayLeaders.length
      ? `The busiest weekday pattern in ${monthName} is ${formatAnalysisList(weekdayLeaders.slice(0, 3))}.`
      : "No weekday pattern is available yet because the month has no traffic rows.";
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

  if (
    normalized.includes("mile") ||
    normalized.includes("odometer") ||
    normalized.includes("100k") ||
    normalized.includes("mileage")
  ) {
    return analysis.avgOdometer
      ? `${monthName} is averaging ${formatWholeNumber(analysis.avgOdometer)} miles, with a midpoint around ${formatWholeNumber(
          analysis.medianOdometer
        )} miles. ${analysis.highMileageCount} row${analysis.highMileageCount === 1 ? "" : "s"} are already at 100k+ miles.`
      : "This month does not have enough odometer data yet to summarize mileage patterns.";
  }

  if (
    normalized.includes("upgrade") ||
    normalized.includes("trade") ||
    normalized.includes("opportunity") ||
    normalized.includes("equity")
  ) {
    return `${analysis.tradeCycleCount} row${analysis.tradeCycleCount === 1 ? "" : "s"} already fall into the trade cycle based on miles or vehicle age. ${analysis.openTradeCycleCount} of those still have no salesperson note, and ${analysis.lateModelEquityCount} look like late-model equity conversations.`;
  }

  if (normalized.includes("theme") || normalized.includes("trend") || normalized.includes("talking about")) {
    const terms = analysis.topTerms.map((item) => `${item.label} (${item.count})`);
    return terms.length
      ? `The strongest note themes this month are ${formatAnalysisList(terms.slice(0, 6))}.`
      : "There are not enough saved notes yet to surface consistent themes.";
  }

  const strongestOwner = analysis.topAssignees[0]?.label || "the assigned team";
  return `${monthName} currently shows ${analysis.totalRows} traffic rows across ${analysis.activeDays} active day${analysis.activeDays === 1 ? "" : "s"}, with ${analysis.noteCoverage}% note coverage. The busiest day was ${busiestLabel}, ${analysis.tradeCycleCount} rows are already in the trade cycle, and ${strongestOwner} is carrying the largest appointment load right now.`;
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

function freshUpLogInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "FU";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "FU";
}

function freshUpGiftLogLabel(entry) {
  const giftCode = String(entry?.gift_code || "").trim();
  if (!giftCode) return "";
  return entry?.gift_sms_sent ? `Gift text sent: ${giftCode}` : `Gift code saved: ${giftCode}`;
}

function FreshUpLogList({ entries, empty }) {
  if (!entries.length) return <div className="empty">{empty}</div>;
  return (
    <div className="freshup-log-list">
      {entries.map((entry) => {
        const phoneLink = phoneHref(entry.customer_phone);
        const giftLabel = freshUpGiftLogLabel(entry);
        return (
          <article key={entry.id} className="freshup-log-item">
            <div className="freshup-log-item__avatar" aria-hidden="true">
              {freshUpLogInitials(entry.customer_name)}
            </div>
            <div className="freshup-log-item__body">
              <div className="freshup-log-item__top">
                <div className="freshup-log-item__identity">
                  <span className="eyebrow">Fresh Up</span>
                  <strong>{entry.customer_name || "Unnamed customer"}</strong>
                  {phoneLink ? (
                    <a href={phoneLink}>{entry.customer_phone}</a>
                  ) : (
                    <small>No phone captured</small>
                  )}
                </div>
                <time dateTime={entry.created_at || ""}>{dateTimeLabel(entry.created_at)}</time>
              </div>
              <div className="freshup-log-item__meta">
                <span className="freshup-log-item__chip freshup-log-item__chip--person">
                  {entry.salesperson_name || "Unassigned"}
                </span>
                <span className="freshup-log-item__chip">{entry.salesperson_dealership || "No store"}</span>
                <span className="freshup-log-item__chip">{entry.source || "Desk"}</span>
                {giftLabel ? (
                  <span className={`freshup-log-item__chip ${entry.gift_sms_sent ? "is-success" : "is-warm"}`}>
                    {giftLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
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
      text: "Ask about busiest days, weekday rhythm, odometer buckets, or which service rows look strongest for sales follow-up.",
    },
  ]);
  const [trafficAnalysisLoading, setTrafficAnalysisLoading] = useState(false);
  const [trafficPdfs, setTrafficPdfs] = useState([]);
  const [specials, setSpecials] = useState([]);
  const [specialVehicleSections, setSpecialVehicleSections] = useState([]);
  const [specialsConfig, setSpecialsConfig] = useState({
    kia_new_url: SPECIAL_FEED_SOURCES[0].defaultUrl,
    mazda_new_url: SPECIAL_FEED_SOURCES[1].defaultUrl,
    used_srp_url: SPECIAL_FEED_SOURCES[2].defaultUrl,
  });
  const [specialsConfigDraft, setSpecialsConfigDraft] = useState({ used_srp_url: "" });
  const [specialsImportPayload, setSpecialsImportPayload] = useState("");
  const [specialsImportStatus, setSpecialsImportStatus] = useState("");
  const [staffRosterFeedback, setStaffRosterFeedback] = useState(null);
  const [staffImportKey, setStaffImportKey] = useState(0);
  const [selectedSpecialId, setSelectedSpecialId] = useState(null);
  const [bdcState, setBdcState] = useState(null);
  const [bdcDistribution, setBdcDistribution] = useState({ mode: "franchise" });
  const [bdcUndoSettings, setBdcUndoSettings] = useState({ require_password: true, password_hint: "" });
  const [bdcLeadPushConfig, setBdcLeadPushConfig] = useState(DEFAULT_BDC_LEAD_PUSH_CONFIG);
  const [tabVisibility, setTabVisibility] = useState(() => defaultTabVisibilityState());
  const [bdcUndoPassword, setBdcUndoPassword] = useState("");
  const [bdcLog, setBdcLog] = useState({ total: 0, entries: [] });
  const [bdcReport, setBdcReport] = useState(null);
  const [bdcSalesTrackerMonth, setBdcSalesTrackerMonth] = useState(currentMonth());
  const [bdcSalesTracker, setBdcSalesTracker] = useState(null);
  const [bdcSalesTrackerView, setBdcSalesTrackerView] = useState("tracker");
  const [salesAnalyticsVariant, setSalesAnalyticsVariant] = useState("sales");
  const [salesAnalyticsDashboard, setSalesAnalyticsDashboard] = useState(() => emptySalesAnalyticsDashboard());
  const [salesAnalyticsAdminDashboards, setSalesAnalyticsAdminDashboards] = useState(() => emptySalesAnalyticsDashboardMap());
  const [salesAnalyticsLoading, setSalesAnalyticsLoading] = useState(false);
  const [salesAnalyticsAdminLoading, setSalesAnalyticsAdminLoading] = useState(false);
  const [salesAnalyticsFeedback, setSalesAnalyticsFeedback] = useState("");
  const [salesAnalyticsAdminFeedback, setSalesAnalyticsAdminFeedback] = useState("");
  const [bdcSalesTrackerGoalDraft, setBdcSalesTrackerGoalDraft] = useState("252");
  const [bdcSalesTrackerRulesDraft, setBdcSalesTrackerRulesDraft] = useState(() => defaultBdcSalesTrackerRulesDraft());
  const [bdcSalesTrackerFocusKey, setBdcSalesTrackerFocusKey] = useState(() => readBdcSalesTrackerPreferences().focusKey);
  const [bdcSalesTrackerFocusNoteDraft, setBdcSalesTrackerFocusNoteDraft] = useState("");
  const [bdcSalesTrackerEntryDrafts, setBdcSalesTrackerEntryDrafts] = useState({});
  const [bdcSalesTrackerNoteDrafts, setBdcSalesTrackerNoteDrafts] = useState({});
  const [bdcSalesTrackerDmsLogDraft, setBdcSalesTrackerDmsLogDraft] = useState(() => emptyBdcSalesTrackerDmsLogDraft());
  const [bdcSalesTrackerDmsBulkDraft, setBdcSalesTrackerDmsBulkDraft] = useState(() => emptyBdcSalesTrackerDmsBulkDraft());
  const [bdcSalesTrackerDmsBulkFeedback, setBdcSalesTrackerDmsBulkFeedback] = useState("");
  const [bdcSalesTrackerEntrySearch, setBdcSalesTrackerEntrySearch] = useState({ field: "all", value: "" });
  const [daysOffData, setDaysOffData] = useState({ month: currentMonth(), entries: [] });
  const [selectedDaysOffSalesId, setSelectedDaysOffSalesId] = useState("");
  const [filters, setFilters] = useState({ salespersonId: "", leadStore: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastAssignment, setLastAssignment] = useState(null);
  const [adminToken, setAdminToken] = useState(readAdminToken);
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
  const trackerEntrySearchInputRef = useRef(null);
  const [salesForm, setSalesForm] = useState(() => emptySalesForm());
  const [bdcForm, setBdcForm] = useState({ name: "", active: true });
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
    salesAnalytics: false,
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
  const [freshUpFormError, setFreshUpFormError] = useState("");
  const freshUpCopiedAt = "";
  const [freshUpLinksConfig, setFreshUpLinksConfig] = useState(() => normalizeFreshUpLinksConfig(FRESHUP_LINKS_DEFAULTS));
  const [freshUpAnalytics, setFreshUpAnalytics] = useState(FRESHUP_ANALYTICS_DEFAULTS);
  const freshUpPageViewRef = useRef("");
  const [marketplaceGuideStatus, setMarketplaceGuideStatus] = useState("");
  const [trafficRowUploadFiles, setTrafficRowUploadFiles] = useState({});
  const [trafficRowUploadKeys, setTrafficRowUploadKeys] = useState({});
  const [trafficPdfForm, setTrafficPdfForm] = useState({ title: "", file: null });
  const [specialForm, setSpecialForm] = useState({ editingId: null, title: "", tag: "", file: null });
  const [trafficUploadKey, setTrafficUploadKey] = useState(0);
  const [specialUploadKey, setSpecialUploadKey] = useState(0);
  const staffImportInputRef = useRef(null);

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
  const specialFeedSourceMap = Object.fromEntries(SPECIAL_FEED_SOURCES.map((item) => [item.key, item]));
  const populatedSpecialVehicleSections = specialVehicleSections.filter((section) => (section.entries || []).length);
  const specialSectionsByKey = Object.fromEntries(specialVehicleSections.map((section) => [section.key, section]));
  const latestSpecialImportTs = populatedSpecialVehicleSections.reduce(
    (maxValue, section) => Math.max(maxValue, Number(section.imported_ts || 0)),
    0
  );
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
  const trafficAnalysis = buildTrafficAnalysis(
    trafficAnalysisData.entries,
    trafficAnalysisData.counts_by_date,
    trafficAnalysisData.month || trafficMonth
  );
  const trafficAnalysisMaxDayCount = Math.max(...trafficAnalysis.timeline.map((item) => item.count), 1);
  const trafficAnalysisMaxWeekdayCount = Math.max(...trafficAnalysis.weekdayCards.map((item) => item.count), 1);
  const trafficAnalysisMaxTimeWindowCount = Math.max(...trafficAnalysis.timeWindowCards.map((item) => item.count), 1);
  const trafficAnalysisMaxOdometerBandCount = Math.max(...trafficAnalysis.odometerBands.map((item) => item.count), 1);
  const trafficAnalysisMaxVehicleAgeBandCount = Math.max(...trafficAnalysis.vehicleAgeBands.map((item) => item.count), 1);
  const trafficAnalysisInsights = trafficAnalysis.totalRows
    ? [
        `The board holds ${trafficAnalysis.totalRows} service-drive rows for ${monthLabel(trafficAnalysisData.month || trafficMonth)} across ${trafficAnalysis.activeDays} active days.`,
        trafficAnalysis.busiestDay
          ? `${longDateLabel(trafficAnalysis.busiestDay.date)} is the peak traffic day with ${trafficAnalysis.busiestDay.count} rows and ${trafficAnalysis.busiestDay.noteCoverage}% note coverage.`
          : "No busiest day yet because there is no traffic in the selected month.",
        `${trafficAnalysis.tradeCycleCount} rows already sit in the trade cycle, and ${trafficAnalysis.openTradeCycleCount} of those still need follow-up notes.`,
        trafficAnalysis.avgOdometer
          ? `Average odometer across rows with mileage is ${formatWholeNumber(trafficAnalysis.avgOdometer)} miles.`
          : "Mileage is not imported consistently enough this month to score odometer patterns yet.",
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
  const resolvedFreshUpSalespersonId =
    freshUpForm.salespersonId || (freshUpAssignedSalesperson ? String(freshUpAssignedSalesperson.id) : "");
  const freshUpSummary = freshUpSummaryText(freshUpForm, freshUpAssignedSalesperson?.name || "");
  const freshUpCustomerNameReady = Boolean(String(freshUpForm.customerName || "").trim());
  const freshUpCustomerPhoneReady = digitsOnly(freshUpForm.phone).length === 10;
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
  const freshUpSalespersonPhoneText = formatPhoneInput(freshUpAssignedSalesperson?.phone_number || "");
  const freshUpSalespersonPhoneHref = phoneHref(freshUpAssignedSalesperson?.phone_number || "");
  const freshUpSalespersonContactHref = freshUpContactCardHref(freshUpAssignedSalesperson, freshUpPrimaryStore);
  const freshUpSalespersonContactFileName = freshUpAssignedSalesperson
    ? `${downloadFileName(freshUpAssignedSalesperson.name, "salesperson-contact")}.vcf`
    : "salesperson-contact.vcf";
  const freshUpSalespersonFirstName = freshUpAssignedSalesperson
    ? String(freshUpAssignedSalesperson.name || "").trim().split(/\s+/)[0] || "your salesperson"
    : "your salesperson";
  const freshUpSalespersonContactLabel = freshUpAssignedSalesperson
    ? `Add ${freshUpAssignedSalesperson.name} as Contact`
    : "Add salesperson as contact";
  const freshUpCardIntroHeading = "Get your gift";
  const freshUpCardIntroCopy = freshUpAssignedSalesperson
    ? `Enter your name and mobile number. We will text this month's gift code and attach ${freshUpAssignedSalesperson.name} as your sales contact.`
    : "Enter your name and mobile number. We will text this month's gift code and attach the right salesperson.";
  const freshUpCardSubmitLabel = "Get Your Gift";
  const freshUpStatusTone = /skipped|failed/i.test(freshUpStatus) ? "warning" : "success";
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
  const orderedTabEntries = sortTabVisibilityEntries(tabVisibility.entries || []);
  const orderedTabs = orderedTabEntries
    .map((entry) => TABS.find((item) => item.id === entry.tab_id))
    .filter(Boolean);
  const visibleTabIds = new Set(orderedTabEntries.filter((entry) => entry.visible).map((entry) => entry.tab_id));
  const defaultVisibleTabId =
    (visibleTabIds.has("serviceNotes") && "serviceNotes") ||
    orderedTabs.find((item) => visibleTabIds.has(item.id))?.id ||
    "serviceNotes";
  const tabsToShow = [
    ...orderedTabs.filter((item) => adminSession || visibleTabIds.has(item.id)),
    TABS.find((item) => item.id === "admin"),
  ].filter(Boolean);
  const latestBdcAssignment = lastAssignment || bdcLog.entries?.[0] || null;
  const latestBdcNotifications = [String(latestBdcAssignment?.notification_whatsapp_status || "").trim()].filter(Boolean);
  const agentLoopPresets = agentLoopConfig.presets || [];
  const selectedAgentLoopPreset =
    agentLoopPresets.find((item) => item.key === agentLoopForm.presetKey) || agentLoopPresets[0] || null;
  const selectedAgentLoopIsActive = ["queued", "running"].includes(String(selectedAgentRun?.status || "").toLowerCase());
  const trackerAgents = bdcSalesTracker?.agents || [];
  const trackerDmsLog = bdcSalesTracker?.dms_log || { current_entries: [], log_entries: [] };
  const trackerDmsLogDraftPreview = parseBdcSalesTrackerDmsLogIdentity(bdcSalesTrackerDmsLogDraft.customer_name);
  const trackerDmsBulkDraftNumbers = parseBdcSalesTrackerDraftNumbers(bdcSalesTrackerDmsBulkDraft.dms_numbers_text);
  const trackerBenchmarks = bdcSalesTracker?.benchmarks || {
    appointment_set_rate_floor: 0.2,
    appointment_set_rate_target: 0.3,
    appointment_show_rate_floor: 0.5,
    appointment_show_rate_target: 0.6,
    sold_from_appointments_rate_floor: 0.1,
    sold_from_appointments_rate_target: 0.15,
    sold_from_appointments_rate_ceiling: 0.18,
  };
  const trackerFocusNotes = bdcSalesTracker?.focus_notes || [];
  const trackerAptSetUnderOptions = [
    TRACKER_NO_APT_OPTION,
    ...bdcAgents.map((agent) => ({
      name: String(agent.name || "").trim(),
      source: agent.active ? "BDC" : "BDC inactive",
      sortKey: 0,
    })),
    ...salespeople.map((person) => ({
      name: String(person.name || "").trim(),
      source: person.dealership || (person.active ? "Sales" : "Sales inactive"),
      sortKey: 1,
    })),
  ]
    .filter((entry) => entry.name)
    .reduce((items, entry) => {
      const key = normalizeLookupText(entry.name);
      if (!key) return items;
      if (!items.some((item) => normalizeLookupText(item.name) === key)) {
        items.push(entry);
      }
      return items;
    }, [])
    .sort((left, right) => {
      const leftSort = Number(left.sortKey || 0);
      const rightSort = Number(right.sortKey || 0);
      if (leftSort !== rightSort) return leftSort - rightSort;
      return String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
    });
  const trackerAptSetUnderAutoFillLabels = new Set(
    trackerAptSetUnderOptions.filter((option) => option.name !== TRACKER_NO_APT_OPTION.name).map((option) => option.name)
  );
  const trackerBulkAptSetUnderOptions = activeBdc
    .map((agent) => String(agent.name || "").trim())
    .filter(Boolean)
    .filter((name, index, items) => items.findIndex((candidate) => normalizeLookupText(candidate) === normalizeLookupText(name)) === index);
  const trackerCurrentDmsCount = trackerDmsLog.current_entries.length;
  const trackerLoggedDmsCount = trackerDmsLog.log_entries.length;
  const trackerBehindByValue = Number(bdcSalesTracker?.summary?.behind_by || 0);
  const trackerGoalValue = Number(bdcSalesTracker?.summary?.goal || bdcSalesTracker?.goal || 0);
  const trackerWorkingDays = Number(bdcSalesTracker?.summary?.working_days || 0);
  const trackerDaysWorked = Number(bdcSalesTracker?.summary?.days_worked || 0);
  const trackerDaysLeft = Number(bdcSalesTracker?.summary?.days_left || 0);
  const trackerShouldBeAtSold = Number(bdcSalesTracker?.summary?.should_be_at_sold || 0);
  const trackerProjection = Number(bdcSalesTracker?.summary?.tracking_projection || 0);
  const bdcSalesTrackerTeamTotals = trackerAgents.reduce(
    (totals, agent) => ({
      totalLeads: totals.totalLeads + Number(agent.total_leads || 0),
      appointmentsSet: totals.appointmentsSet + Number(agent.appointments_set || 0),
      appointmentsShown: totals.appointmentsShown + Number(agent.appointments_shown || 0),
      actualSold: totals.actualSold + Number(agent.actual_sold || 0),
      calls: totals.calls + Number(agent.calls_mtd || 0),
      emails: totals.emails + Number(agent.emails_mtd || 0),
      texts: totals.texts + Number(agent.texts_mtd || 0),
      trackerRows:
        totals.trackerRows + Number((agent.entries || []).filter((entry) => !trackerEntryIsNoteOnly(entry)).length || 0),
    }),
    { totalLeads: 0, appointmentsSet: 0, appointmentsShown: 0, actualSold: 0, calls: 0, emails: 0, texts: 0, trackerRows: 0 }
  );
  const trackerConfirmedCount = Number(bdcSalesTracker?.summary?.mtd_tracked || 0);
  const trackerPendingCount = Math.max(0, bdcSalesTrackerTeamTotals.trackerRows - trackerConfirmedCount);
  const trackerRowsTotal = Math.max(0, trackerConfirmedCount + trackerPendingCount);
  const trackerGoalProgressPercent = percentOfTotal(trackerConfirmedCount, trackerGoalValue);
  const trackerShouldBeProgressPercent = percentOfTotal(trackerShouldBeAtSold, trackerGoalValue);
  const trackerConfirmedSharePercent = percentOfTotal(trackerConfirmedCount, trackerRowsTotal);
  const trackerPendingSharePercent = percentOfTotal(trackerPendingCount, trackerRowsTotal);
  const trackerActivityTotal = bdcSalesTrackerTeamTotals.calls + bdcSalesTrackerTeamTotals.emails + bdcSalesTrackerTeamTotals.texts;
  const trackerActivityMix = [
    {
      key: "calls",
      label: "Calls",
      value: bdcSalesTrackerTeamTotals.calls,
      percent: percentOfTotal(bdcSalesTrackerTeamTotals.calls, trackerActivityTotal),
      tone: "var(--accent)",
    },
    {
      key: "emails",
      label: "Emails",
      value: bdcSalesTrackerTeamTotals.emails,
      percent: percentOfTotal(bdcSalesTrackerTeamTotals.emails, trackerActivityTotal),
      tone: "#1f7cf6",
    },
    {
      key: "texts",
      label: "Texts",
      value: bdcSalesTrackerTeamTotals.texts,
      percent: percentOfTotal(bdcSalesTrackerTeamTotals.texts, trackerActivityTotal),
      tone: "#209774",
    },
  ];
  const trackerTopAgents = [...trackerAgents]
    .sort((left, right) => {
      const soldDelta = Number(right.sold_count || 0) - Number(left.sold_count || 0);
      if (soldDelta) return soldDelta;
      const pendingDelta = trackerPendingSaleEntries(right.entries || []).length - trackerPendingSaleEntries(left.entries || []).length;
      if (pendingDelta) return pendingDelta;
      return String(left.agent_name || "").localeCompare(String(right.agent_name || ""));
    })
    .slice(0, 3);
  const trackerTopAgentMax = trackerTopAgents.reduce(
    (maxValue, agent) => Math.max(maxValue, trackerPipelineCount(agent)),
    0
  );
  const trackerLeaderboardAgents = [...trackerAgents].sort((left, right) => {
    const actualSoldDelta = Number(right.actual_sold || 0) - Number(left.actual_sold || 0);
    if (actualSoldDelta) return actualSoldDelta;
    const confirmedDelta = Number(right.sold_count || 0) - Number(left.sold_count || 0);
    if (confirmedDelta) return confirmedDelta;
    const shownDelta = Number(right.appointments_shown || 0) - Number(left.appointments_shown || 0);
    if (shownDelta) return shownDelta;
    const pendingDelta = trackerPendingSaleEntries(right.entries || []).length - trackerPendingSaleEntries(left.entries || []).length;
    if (pendingDelta) return pendingDelta;
    return String(left.agent_name || "").localeCompare(String(right.agent_name || ""), undefined, { sensitivity: "base" });
  });
  const trackerLeaderboardMaxActualSold = trackerLeaderboardAgents.reduce(
    (maxValue, agent) => Math.max(maxValue, Number(agent.actual_sold || 0)),
    0
  );
  const trackerLeaderboardMaxPipeline = trackerLeaderboardAgents.reduce(
    (maxValue, agent) => Math.max(maxValue, trackerPipelineCount(agent)),
    0
  );
  const trackerAgentsMeetingFloor = trackerLeaderboardAgents.filter((agent) => {
    const setGood = Number(agent.appointment_set_rate || 0) >= Number(trackerBenchmarks.appointment_set_rate_floor || 0);
    const showGood = Number(agent.appointment_show_rate || 0) >= Number(trackerBenchmarks.appointment_show_rate_floor || 0);
    const soldGood = Number(agent.actual_sold_rate || 0) >= Number(trackerBenchmarks.sold_from_appointments_rate_floor || 0);
    return setGood && showGood && soldGood;
  }).length;
  const trackerTopCloser = trackerLeaderboardAgents[0] || null;
  const trackerAppointmentSetRate = bdcSalesTrackerTeamTotals.totalLeads
    ? bdcSalesTrackerTeamTotals.appointmentsSet / bdcSalesTrackerTeamTotals.totalLeads
    : 0;
  const trackerAppointmentShowRate = bdcSalesTrackerTeamTotals.appointmentsSet
    ? bdcSalesTrackerTeamTotals.appointmentsShown / bdcSalesTrackerTeamTotals.appointmentsSet
    : 0;
  const trackerSoldFromShownRate = bdcSalesTrackerTeamTotals.appointmentsShown
    ? bdcSalesTrackerTeamTotals.actualSold / bdcSalesTrackerTeamTotals.appointmentsShown
    : 0;
  const trackerFunnelScoreboard = [
    {
      key: "set",
      label: "Leads to Set",
      numerator: bdcSalesTrackerTeamTotals.appointmentsSet,
      denominator: bdcSalesTrackerTeamTotals.totalLeads,
      rate: trackerAppointmentSetRate,
      floor: trackerBenchmarks.appointment_set_rate_floor,
      target: trackerBenchmarks.appointment_set_rate_target,
      tone: trackerBenchmarkTone(trackerAppointmentSetRate, trackerBenchmarks.appointment_set_rate_floor),
    },
    {
      key: "shown",
      label: "Set to Shown",
      numerator: bdcSalesTrackerTeamTotals.appointmentsShown,
      denominator: bdcSalesTrackerTeamTotals.appointmentsSet,
      rate: trackerAppointmentShowRate,
      floor: trackerBenchmarks.appointment_show_rate_floor,
      target: trackerBenchmarks.appointment_show_rate_target,
      tone: trackerBenchmarkTone(trackerAppointmentShowRate, trackerBenchmarks.appointment_show_rate_floor),
    },
    {
      key: "sold",
      label: "Shown to Sold",
      numerator: bdcSalesTrackerTeamTotals.actualSold,
      denominator: bdcSalesTrackerTeamTotals.appointmentsShown,
      rate: trackerSoldFromShownRate,
      floor: trackerBenchmarks.sold_from_appointments_rate_floor,
      target: trackerBenchmarks.sold_from_appointments_rate_target,
      tone: trackerBenchmarkTone(trackerSoldFromShownRate, trackerBenchmarks.sold_from_appointments_rate_floor),
    },
  ];
  const trackerFunnelNeedsAttention = trackerFunnelScoreboard.some(
    (stage) => Number(stage.rate || 0) < Number(stage.floor || 0)
  );
  const trackerFocusOptions = trackerAgents
    .filter((agent) => agent.active)
    .map((agent) => ({ key: `agent:${agent.agent_id}`, label: agent.agent_name }));
  const selectedTrackerFocus = trackerFocusOptions.find((option) => option.key === bdcSalesTrackerFocusKey) || null;
  const selectedTrackerFocusNote =
    trackerFocusNotes.find((entry) => entry.focus_key === (selectedTrackerFocus?.key || "")) || null;
  const canEditTrackerAdmin = Boolean(adminSession && adminToken);
  const selectedTrackerAgentId =
    selectedTrackerFocus?.key && String(selectedTrackerFocus.key).startsWith("agent:")
      ? Number(String(selectedTrackerFocus.key).split(":")[1] || 0)
      : null;
  const selectedTrackerAgent = selectedTrackerAgentId
    ? trackerAgents.find((agent) => Number(agent.agent_id) === Number(selectedTrackerAgentId)) || null
    : null;
  const trackerKaiFocusSelected = normalizeLookupText(selectedTrackerFocus?.label || "") === "kai";
  const trackerCanViewDmsLog = canEditTrackerAdmin && trackerKaiFocusSelected;
  const trackerShowHistoricalBulkUpload = trackerCanViewDmsLog && trackerKaiFocusSelected && bdcSalesTrackerView === "dmsLog";
  const selectedTrackerAgentDraft = selectedTrackerAgent
    ? bdcSalesTrackerEntryDrafts[selectedTrackerAgent.agent_id] || emptyBdcSalesTrackerEntryDraft()
    : emptyBdcSalesTrackerEntryDraft();
  const selectedTrackerNoteDraft = selectedTrackerAgent
    ? bdcSalesTrackerNoteDrafts[selectedTrackerAgent.agent_id] || emptyBdcSalesTrackerNoteDraft()
    : emptyBdcSalesTrackerNoteDraft();
  const selectedTrackerDraftIdentityPreview = parseBdcSalesTrackerDmsLogIdentity(selectedTrackerAgentDraft.profile_name);
  const selectedTrackerDraftDealCount = selectedTrackerAgent
    ? parseBdcSalesTrackerDraftNumbers(selectedTrackerAgentDraft.dms_numbers_text).length
    : 0;
  const selectedTrackerEntries = selectedTrackerAgent?.entries || [];
  const selectedTrackerPendingEntries = trackerPendingEntries(selectedTrackerEntries);
  const selectedTrackerSoldEntries = trackerSoldEntries(selectedTrackerEntries);
  const selectedTrackerNoteEntries = selectedTrackerPendingEntries.filter((entry) => trackerEntryIsNoteOnly(entry));
  const selectedTrackerSaleEntries = selectedTrackerEntries.filter((entry) => trackerEntryHasSaleIdentity(entry));
  const selectedTrackerPendingSaleEntries = trackerPendingSaleEntries(selectedTrackerEntries);
  const trackerEntrySearchFields = [
    { key: "all", label: "All" },
    { key: "profile_name", label: "Customer" },
    { key: "opportunity_id", label: "Opp ID" },
    { key: "dms_number", label: "DMS #" },
    { key: "notes", label: "Note" },
  ];
  const selectedTrackerFilteredSaleEntries = selectedTrackerSaleEntries.filter((entry) =>
    trackerEntryMatchesSearch(entry, bdcSalesTrackerEntrySearch.field, bdcSalesTrackerEntrySearch.value)
  );
  const selectedTrackerSearchField =
    trackerEntrySearchFields.find((field) => field.key === bdcSalesTrackerEntrySearch.field) || trackerEntrySearchFields[0];
  const selectedTrackerExpectedCount = Number(selectedTrackerSaleEntries.length || 0);
  const selectedTrackerTrackingCount = Number(selectedTrackerPendingEntries.length || 0);
  const selectedTrackerNoteCount = Number(selectedTrackerNoteEntries.length || 0);
  const selectedTrackerConfirmedCount = Number(selectedTrackerSoldEntries.length || 0);
  const selectedTrackerPendingCount = Number(selectedTrackerPendingSaleEntries.length || 0);
  const selectedTrackerActualSold = Number(selectedTrackerAgent?.actual_sold || 0);
  const selectedTrackerAppointmentsSet = Number(selectedTrackerAgent?.appointments_set || 0);
  const selectedTrackerAppointmentsShown = Number(selectedTrackerAgent?.appointments_shown || 0);
  const selectedTrackerTotalLeads = Number(selectedTrackerAgent?.total_leads || 0);
  const selectedTrackerProjection = Number(selectedTrackerAgent?.tracking_projection || 0);

  function applyBdcSalesTrackerData(data) {
    setBdcSalesTracker(data);
    setBdcSalesTrackerGoalDraft(String(data?.goal ?? ""));
    setBdcSalesTrackerRulesDraft({
      appointment_set_rate_floor: String(Math.round(Number(data?.benchmarks?.appointment_set_rate_floor || 0.2) * 100)),
      appointment_set_rate_target: String(Math.round(Number(data?.benchmarks?.appointment_set_rate_target || 0.3) * 100)),
      appointment_show_rate_floor: String(Math.round(Number(data?.benchmarks?.appointment_show_rate_floor || 0.5) * 100)),
      appointment_show_rate_target: String(Math.round(Number(data?.benchmarks?.appointment_show_rate_target || 0.6) * 100)),
      sold_from_appointments_rate_floor: String(
        Math.round(Number(data?.benchmarks?.sold_from_appointments_rate_floor || 0.1) * 100)
      ),
      sold_from_appointments_rate_target: String(
        Math.round(Number(data?.benchmarks?.sold_from_appointments_rate_target || 0.15) * 100)
      ),
      sold_from_appointments_rate_ceiling: String(
        Math.round(Number(data?.benchmarks?.sold_from_appointments_rate_ceiling || 0.18) * 100)
      ),
    });
  }

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
    setTabVisibility({ entries: sortTabVisibilityEntries(tabs.entries || []) });
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

  async function refreshSalesAnalyticsDashboard({ quiet = false, variant = salesAnalyticsVariant } = {}) {
    if (!quiet) {
      setSalesAnalyticsLoading(true);
    }
    try {
      const data = await getSalesAnalyticsDashboard({ limit: 18, variant, token: adminToken });
      setSalesAnalyticsDashboard(data);
      setResourceLoadState((current) => ({ ...current, salesAnalytics: true }));
      return data;
    } finally {
      if (!quiet) {
        setSalesAnalyticsLoading(false);
      }
    }
  }

  async function triggerSalesAnalyticsDashboardRun(variant = salesAnalyticsVariant) {
    setBusy(`sales-analytics-run:${variant}`);
    setError("");
    setSalesAnalyticsFeedback("");
    try {
      const response = await runSalesAnalyticsReport({ variant, token: adminToken });
      if (response?.status) {
        setSalesAnalyticsDashboard((current) => applySalesAnalyticsStatusToDashboard(current, response.status));
      }
      setSalesAnalyticsFeedback(response?.message || "Sales activity scrape started.");
      await refreshSalesAnalyticsDashboard({ quiet: true, variant });
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function refreshAdminSalesAnalyticsOverview() {
    if (!adminToken) return;
    setSalesAnalyticsAdminLoading(true);
    try {
      const [dashboards, leadPush] = await Promise.all([
        Promise.all(
          SALES_ANALYTICS_VARIANTS.map((variant) =>
            getSalesAnalyticsDashboard({ limit: 6, variant: variant.key, token: adminToken })
          )
        ),
        getBdcLeadPushConfig(adminToken),
      ]);
      setSalesAnalyticsAdminDashboards(
        Object.fromEntries(dashboards.map((dashboard) => [dashboard?.config?.variant_key || "sales", dashboard]))
      );
      setBdcLeadPushConfig(leadPush || DEFAULT_BDC_LEAD_PUSH_CONFIG);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setSalesAnalyticsAdminLoading(false);
    }
  }

  async function triggerAdminSalesAnalyticsRun(variant) {
    setBusy(`admin-sales-analytics-run:${variant}`);
    setError("");
    setSalesAnalyticsAdminFeedback("");
    try {
      const response = await runSalesAnalyticsReport({ variant, token: adminToken });
      if (response?.status) {
        setSalesAnalyticsAdminDashboards((current) => ({
          ...current,
          [variant]: applySalesAnalyticsStatusToDashboard(current?.[variant], response.status),
        }));
        if (variant === salesAnalyticsVariant) {
          setSalesAnalyticsDashboard((current) => applySalesAnalyticsStatusToDashboard(current, response.status));
        }
      }
      setSalesAnalyticsAdminFeedback(response?.message || "Sales activity scrape started.");
      await refreshAdminSalesAnalyticsOverview();
      if (variant === salesAnalyticsVariant) {
        await refreshSalesAnalyticsDashboard({ quiet: true, variant });
      }
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcLeadPushEnabled(enabled) {
    setBusy("bdc-lead-push");
    setError("");
    setSalesAnalyticsAdminFeedback("");
    try {
      const updated = await updateBdcLeadPushConfig(adminToken, { enabled });
      setBdcLeadPushConfig(updated);
      setSalesAnalyticsAdminFeedback(
        updated?.enabled
          ? `Lead notifications will be pushed to ${updated.chat_name || "your self chat"}.`
          : "Lead notifications are paused."
      );
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function refreshBdcLeadPushConfig({ quiet = false } = {}) {
    if (!adminToken) {
      setBdcLeadPushConfig(DEFAULT_BDC_LEAD_PUSH_CONFIG);
      return;
    }
    if (!quiet) {
      setBusy("bdc-lead-push-refresh");
    }
    try {
      const data = await getBdcLeadPushConfig(adminToken);
      setBdcLeadPushConfig(data || DEFAULT_BDC_LEAD_PUSH_CONFIG);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      if (!quiet) {
        setBusy("");
      }
    }
  }

  function syncSpecialsState(data) {
    setSpecials(data.entries || []);
    setSpecialVehicleSections(data.vehicle_sections || []);
    const nextConfig = data.config || {
      kia_new_url: SPECIAL_FEED_SOURCES[0].defaultUrl,
      mazda_new_url: SPECIAL_FEED_SOURCES[1].defaultUrl,
      used_srp_url: SPECIAL_FEED_SOURCES[2].defaultUrl,
    };
    setSpecialsConfig(nextConfig);
    setSpecialsConfigDraft({ used_srp_url: nextConfig.used_srp_url || "" });
    setResourceLoadState((current) => ({ ...current, specials: true }));
  }

  async function refreshSpecials() {
    const data = await getSpecials();
    syncSpecialsState(data);
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
    setFreshUpLinksConfig(normalizeFreshUpLinksConfig(data));
    setResourceLoadState((current) => ({ ...current, freshUpLinks: true }));
  }

  async function refreshFreshUpAnalytics() {
    const data = await getFreshUpAnalytics(adminToken, { days: 30 });
    setFreshUpAnalytics(data);
    setResourceLoadState((current) => ({ ...current, freshUpAnalytics: true }));
  }

  async function refreshBdcSalesTracker(nextMonth = bdcSalesTrackerMonth) {
    const data = await getBdcSalesTracker({ month: nextMonth });
    applyBdcSalesTrackerData(data);
  }

  function patchBdcSalesTrackerAgent(agentId, field, value) {
    setBdcSalesTracker((current) => {
      if (!current) return current;
      return {
        ...current,
        agents: (current.agents || []).map((agent) =>
          agent.agent_id === agentId
            ? {
                ...agent,
                [field]: value,
              }
            : agent
        ),
      };
    });
  }

  function patchBdcSalesTrackerEntry(entryId, field, value) {
    setBdcSalesTracker((current) => {
      if (!current) return current;
      return {
        ...current,
        agents: (current.agents || []).map((agent) => ({
          ...agent,
          entries: (agent.entries || []).map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry)),
        })),
      };
    });
  }

  function patchBdcSalesTrackerEntryDraft(agentId, field, value) {
    setBdcSalesTrackerEntryDrafts((current) => ({
      ...current,
      [agentId]: {
        ...(current[agentId] || emptyBdcSalesTrackerEntryDraft()),
        [field]: value,
      },
    }));
  }

  function patchBdcSalesTrackerNoteDraft(agentId, value) {
    setBdcSalesTrackerNoteDrafts((current) => ({
      ...current,
      [agentId]: value,
    }));
  }

  function applyBdcSalesTrackerFocusSelection(nextValue) {
    const resolved = trackerFocusOptions.find((option) => option.key === nextValue) || null;
    setBdcSalesTrackerFocusKey(resolved?.key || "");
    setBdcSalesTrackerDmsBulkFeedback("");
    const existingNote = resolved ? trackerFocusNotes.find((entry) => entry.focus_key === resolved.key) : null;
    setBdcSalesTrackerFocusNoteDraft(existingNote?.notes || "");
    setBdcSalesTrackerDmsLogDraft((current) => ({
      ...current,
      apt_set_under: resolved?.label || "",
    }));
    setBdcSalesTrackerDmsBulkDraft((current) => ({
      ...current,
      apt_set_under: current.apt_set_under || resolved?.label || "",
    }));
  }

  async function saveBdcSalesTrackerGoal() {
    setBusy("bdc-sales-goal");
    setError("");
    try {
      const data = await updateBdcSalesTrackerMonth(adminToken, {
        month: bdcSalesTrackerMonth,
        goal: numericValue(bdcSalesTrackerGoalDraft),
      });
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcSalesTrackerMetrics(agent) {
    setBusy(`bdc-sales-metrics-${agent.agent_id}`);
    setError("");
    try {
      const data = await updateBdcSalesTrackerAgentMetrics(adminToken, agent.agent_id, {
        month: bdcSalesTrackerMonth,
        total_leads: Math.round(numericValue(agent.total_leads)),
        appointments_set: Math.round(numericValue(agent.appointments_set)),
        appointments_shown: Math.round(numericValue(agent.appointments_shown)),
        actual_sold: Math.round(numericValue(agent.actual_sold)),
        calls_mtd: Math.round(numericValue(agent.calls_mtd)),
        emails_mtd: Math.round(numericValue(agent.emails_mtd)),
        texts_mtd: Math.round(numericValue(agent.texts_mtd)),
        days_off: Math.round(numericValue(agent.days_off)),
      });
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcSalesTrackerRules() {
    setBusy("bdc-sales-rules");
    setError("");
    try {
      const data = await updateBdcSalesTrackerRules(adminToken, {
        month: bdcSalesTrackerMonth,
        appointment_set_rate_floor: numericValue(bdcSalesTrackerRulesDraft.appointment_set_rate_floor) / 100,
        appointment_set_rate_target: numericValue(bdcSalesTrackerRulesDraft.appointment_set_rate_target) / 100,
        appointment_show_rate_floor: numericValue(bdcSalesTrackerRulesDraft.appointment_show_rate_floor) / 100,
        appointment_show_rate_target: numericValue(bdcSalesTrackerRulesDraft.appointment_show_rate_target) / 100,
        sold_from_appointments_rate_floor: numericValue(bdcSalesTrackerRulesDraft.sold_from_appointments_rate_floor) / 100,
        sold_from_appointments_rate_target: numericValue(bdcSalesTrackerRulesDraft.sold_from_appointments_rate_target) / 100,
        sold_from_appointments_rate_ceiling: numericValue(bdcSalesTrackerRulesDraft.sold_from_appointments_rate_ceiling) / 100,
      });
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcSalesTrackerFocusNotes() {
    if (!selectedTrackerFocus) return;
    setBusy("bdc-sales-focus-note");
    setError("");
    try {
      const data = await updateBdcSalesTrackerFocusNote({
        month: bdcSalesTrackerMonth,
        focus_key: selectedTrackerFocus.key,
        focus_label: selectedTrackerFocus.label,
        notes: bdcSalesTrackerFocusNoteDraft,
      });
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addBdcSalesTrackerEntry(agent) {
    const draft = bdcSalesTrackerEntryDrafts[agent.agent_id] || emptyBdcSalesTrackerEntryDraft();
    setBusy(`bdc-sales-create-${agent.agent_id}`);
    setError("");
    try {
      const data = await createBdcSalesTrackerEntry({
        month: bdcSalesTrackerMonth,
        agent_id: agent.agent_id,
        dms_number: selectedTrackerDraftIdentityPreview.dms_number || draft.dms_number,
        opportunity_id: selectedTrackerDraftIdentityPreview.opportunity_id || "",
        dms_numbers_text: draft.dms_numbers_text,
        profile_name: draft.profile_name,
        customer_phone: draft.customer_phone,
        notes: draft.notes,
        sold: false,
      }, adminToken);
      applyBdcSalesTrackerData(data);
      setBdcSalesTrackerEntryDrafts((current) => ({
        ...current,
        [agent.agent_id]: emptyBdcSalesTrackerEntryDraft(),
      }));
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addBdcSalesTrackerNote(agent) {
    const draft = String(bdcSalesTrackerNoteDrafts[agent.agent_id] || "").trim();
    if (!draft) {
      setError("Enter a note before saving it.");
      return;
    }
    setBusy(`bdc-sales-note-create-${agent.agent_id}`);
    setError("");
    try {
      const data = await createBdcSalesTrackerEntry({
        month: bdcSalesTrackerMonth,
        agent_id: agent.agent_id,
        notes: draft,
        sold: false,
      }, adminToken);
      applyBdcSalesTrackerData(data);
      setBdcSalesTrackerNoteDrafts((current) => ({
        ...current,
        [agent.agent_id]: emptyBdcSalesTrackerNoteDraft(),
      }));
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveBdcSalesTrackerEntry(entry) {
    setBusy(`bdc-sales-entry-${entry.id}`);
    setError("");
    try {
      const data = await updateBdcSalesTrackerEntry(entry.id, {
        dms_number: entry.dms_number,
        profile_name: entry.profile_name,
        opportunity_id: entry.opportunity_id || "",
        customer_phone: entry.customer_phone,
        notes: entry.notes,
        sold: Boolean(entry.sold),
      }, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function toggleBdcSalesTrackerEntrySold(entry) {
    setBusy(`bdc-sales-sold-${entry.id}`);
    setError("");
    try {
      const data = await updateBdcSalesTrackerEntry(entry.id, {
        dms_number: entry.dms_number,
        profile_name: entry.profile_name,
        opportunity_id: entry.opportunity_id || "",
        customer_phone: entry.customer_phone,
        notes: entry.notes,
        sold: !entry.sold,
      }, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function removeBdcSalesTrackerEntry(entryId) {
    setBusy(`bdc-sales-delete-${entryId}`);
    setError("");
    try {
      const data = await deleteBdcSalesTrackerEntry(entryId, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addBdcSalesTrackerDmsLogEntry() {
    setBusy("bdc-dms-create");
    setError("");
    try {
      const data = await createBdcSalesTrackerDmsLogEntry({
        month: bdcSalesTrackerMonth,
        customer_name: bdcSalesTrackerDmsLogDraft.customer_name,
        apt_set_under: bdcSalesTrackerDmsLogDraft.apt_set_under || selectedTrackerFocus?.label || "",
        notes: bdcSalesTrackerDmsLogDraft.notes,
      }, adminToken);
      applyBdcSalesTrackerData(data);
      setBdcSalesTrackerDmsLogDraft({
        ...emptyBdcSalesTrackerDmsLogDraft(),
        apt_set_under: selectedTrackerFocus?.label || "",
      });
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function addBdcSalesTrackerDmsLogBulkEntries() {
    const targetDmsNumbers = trackerDmsBulkDraftNumbers;
    if (!trackerCanViewDmsLog) {
      setBdcSalesTrackerDmsBulkFeedback("");
      setError("Select Kai before opening the DMS Log bulk upload.");
      return;
    }
    if (!targetDmsNumbers.length) {
      setBdcSalesTrackerDmsBulkFeedback("");
      setError("Paste at least one DMS number before uploading.");
      return;
    }
    setBusy("bdc-dms-bulk-create");
    setError("");
    setBdcSalesTrackerDmsBulkFeedback("");
    try {
      const resolvedAptSetUnder = bdcSalesTrackerDmsBulkDraft.apt_set_under || selectedTrackerFocus?.label || "";
      const existingDmsNumbers = new Set(
        [
          ...(trackerDmsLog.current_entries || []),
          ...(trackerDmsLog.log_entries || []),
        ].map((entry) => normalizeLookupText(entry.dms_number))
      );
      const data = await createBdcSalesTrackerDmsLogBulkEntries(
        {
          month: bdcSalesTrackerMonth,
          dms_numbers_text: bdcSalesTrackerDmsBulkDraft.dms_numbers_text,
          apt_set_under: resolvedAptSetUnder,
          notes: bdcSalesTrackerDmsBulkDraft.notes,
        },
        adminToken
      );
      applyBdcSalesTrackerData(data);
      const savedDmsNumbers = new Set(
        (data?.dms_log?.log_entries || []).map((entry) => normalizeLookupText(entry.dms_number))
      );
      const savedCount = targetDmsNumbers.filter((dmsNumber) => {
        const normalizedDms = normalizeLookupText(dmsNumber);
        return savedDmsNumbers.has(normalizedDms) && !existingDmsNumbers.has(normalizedDms);
      }).length;
      setBdcSalesTrackerDmsBulkFeedback(
        savedCount === targetDmsNumbers.length
          ? `Saved ${savedCount} historical DMS ${savedCount === 1 ? "row" : "rows"} under ${resolvedAptSetUnder}.`
          : `Saved ${savedCount} of ${targetDmsNumbers.length} DMS numbers under ${resolvedAptSetUnder}. Already logged or tracked numbers were skipped.`
      );
      setBdcSalesTrackerDmsBulkDraft({
        ...emptyBdcSalesTrackerDmsBulkDraft(),
        apt_set_under: resolvedAptSetUnder,
      });
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function patchBdcSalesTrackerDmsLogEntry(entryId, field, value) {
    setBdcSalesTracker((current) => {
      if (!current) return current;
      const patchCollection = (items) => items.map((entry) => (entry.id === entryId ? { ...entry, [field]: value } : entry));
      return {
        ...current,
        dms_log: {
          current_entries: patchCollection(current.dms_log?.current_entries || []),
          log_entries: patchCollection(current.dms_log?.log_entries || []),
        },
      };
    });
  }

  async function saveBdcSalesTrackerDmsLogEntry(entry, logged = entry.logged, loggedAt = entry.logged_at || "") {
    setBusy(`bdc-dms-save-${entry.id}`);
    setError("");
    try {
      const data = await updateBdcSalesTrackerDmsLogEntry(entry.id, {
        customer_name: entry.customer_name,
        opportunity_id: entry.opportunity_id || "",
        dms_number: entry.dms_number || "",
        apt_set_under: entry.apt_set_under,
        notes: entry.notes || "",
        logged,
        logged_at: loggedAt,
      }, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function markBdcSalesTrackerDmsLogAsSold(entryId) {
    setBusy(`bdc-dms-sold-${entryId}`);
    setError("");
    try {
      const data = await markBdcSalesTrackerDmsLogEntrySold(entryId, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function removeBdcSalesTrackerDmsLogEntry(entryId) {
    setBusy(`bdc-dms-delete-${entryId}`);
    setError("");
    try {
      const data = await deleteBdcSalesTrackerDmsLogEntry(entryId, adminToken);
      applyBdcSalesTrackerData(data);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
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
      entries: sortTabVisibilityEntries(
        (current.entries || []).map((entry) => (entry.tab_id === tabId ? { ...entry, visible } : entry))
      ),
    }));
  }

  function moveTabVisibility(tabId, direction) {
    setTabVisibility((current) => {
      const ordered = sortTabVisibilityEntries(current.entries || []);
      const currentIndex = ordered.findIndex((entry) => entry.tab_id === tabId);
      if (currentIndex < 0) return current;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= ordered.length) return current;
      const nextEntries = [...ordered];
      const [movedEntry] = nextEntries.splice(currentIndex, 1);
      nextEntries.splice(targetIndex, 0, movedEntry);
      return {
        entries: nextEntries.map((entry, index) => ({ ...entry, position: index })),
      };
    });
  }

  function resetTabVisibilityOrder() {
    setTabVisibility((current) => {
      const visibilityMap = new Map((current.entries || []).map((entry) => [entry.tab_id, Boolean(entry.visible)]));
      return {
        entries: NON_ADMIN_TABS.map((item, index) => ({
          tab_id: item.id,
          visible: visibilityMap.get(item.id) ?? true,
          position: index,
        })),
      };
    });
  }

  async function saveTabVisibilitySettings() {
    setBusy("tab-visibility");
    setError("");
    try {
      const updated = await updateTabVisibility(adminToken, {
        entries: sortTabVisibilityEntries(tabVisibility.entries || []),
      });
      setTabVisibility({
        entries: sortTabVisibilityEntries(updated.entries || []),
      });
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
        const data = await getBdcSalesTracker({ month: bdcSalesTrackerMonth });
        if (active) applyBdcSalesTrackerData(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [bdcSalesTrackerMonth]);

  useEffect(() => {
    const hasCurrent =
      bdcSalesTrackerFocusKey && trackerFocusOptions.some((option) => option.key === bdcSalesTrackerFocusKey);
    const nextSelection = hasCurrent ? bdcSalesTrackerFocusKey : "";
    const nextOption = trackerFocusOptions.find((option) => option.key === nextSelection) || null;
    const nextNote = nextSelection ? trackerFocusNotes.find((entry) => entry.focus_key === nextSelection) : null;
    if (bdcSalesTrackerFocusKey && !hasCurrent) {
      setBdcSalesTrackerFocusKey("");
    }
    setBdcSalesTrackerFocusNoteDraft(nextNote?.notes || "");
    setBdcSalesTrackerDmsLogDraft((current) => {
      const currentApt = String(current.apt_set_under || "").trim();
      const resolvedApt = !currentApt || trackerAptSetUnderAutoFillLabels.has(currentApt) ? nextOption?.label || "" : currentApt;
      if (current.apt_set_under === resolvedApt) {
        return current;
      }
      return {
        ...current,
        apt_set_under: resolvedApt,
      };
    });
    setBdcSalesTrackerDmsBulkDraft((current) => {
      if (String(current.apt_set_under || "").trim()) {
        return current;
      }
      return {
        ...current,
        apt_set_under: nextOption?.label || "",
      };
    });
  }, [bdcSalesTracker?.month, trackerFocusNotes, trackerFocusOptions, trackerAptSetUnderAutoFillLabels]);

  useEffect(() => {
    setBdcSalesTrackerEntrySearch({ field: "all", value: "" });
  }, [selectedTrackerAgentId]);

  useEffect(() => {
    setBdcSalesTrackerDmsBulkFeedback("");
  }, [bdcSalesTrackerMonth, selectedTrackerAgentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      BDC_SALES_TRACKER_PREFERENCES_KEY,
      JSON.stringify({
        focusKey: bdcSalesTrackerFocusKey,
      })
    );
  }, [bdcSalesTrackerFocusKey]);

  useEffect(() => {
    if (bdcSalesTrackerView === "dmsLog" && !trackerCanViewDmsLog) {
      setBdcSalesTrackerView("tracker");
    }
  }, [bdcSalesTrackerView, trackerCanViewDmsLog]);

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
        text: `Loaded ${monthLabel(trafficAnalysisData.month || trafficMonth)}. Ask about busiest days, weekday rhythm, odometer buckets, or where the best service-to-sales opportunities sit.`,
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
        setFreshUpLinksConfig(normalizeFreshUpLinksConfig(data));
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
    if (tab !== "salesAnalytics") return;
    let active = true;
    const run = async () => {
      try {
        const data = await getSalesAnalyticsDashboard({ limit: 18, variant: salesAnalyticsVariant, token: adminToken });
        if (!active) return;
        setSalesAnalyticsDashboard(data);
        setResourceLoadState((current) => ({ ...current, salesAnalytics: true }));
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      } finally {
        if (active) setSalesAnalyticsLoading(false);
      }
    };
    setSalesAnalyticsLoading(true);
    run();
    return () => {
      active = false;
    };
  }, [adminToken, salesAnalyticsVariant, tab]);

  useEffect(() => {
    if (tab !== "salesAnalytics") return undefined;
    const statusState = String(salesAnalyticsDashboard?.status?.state || "").trim().toLowerCase();
    if (!["queued", "running"].includes(statusState)) return undefined;
    const intervalId = window.setInterval(() => {
      refreshSalesAnalyticsDashboard({ quiet: true, variant: salesAnalyticsVariant }).catch(() => {});
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [salesAnalyticsDashboard?.status?.state, salesAnalyticsVariant, tab]);

  useEffect(() => {
    if (!(tab === "admin" && adminSection === "salesAnalytics" && adminSession && adminToken)) {
      return undefined;
    }
    let active = true;
    const run = async () => {
      try {
        const [dashboards, leadPush] = await Promise.all([
          Promise.all(
            SALES_ANALYTICS_VARIANTS.map((variant) =>
              getSalesAnalyticsDashboard({ limit: 6, variant: variant.key, token: adminToken })
            )
          ),
          getBdcLeadPushConfig(adminToken),
        ]);
        if (!active) return;
        setSalesAnalyticsAdminDashboards(
          Object.fromEntries(dashboards.map((dashboard) => [dashboard?.config?.variant_key || "sales", dashboard]))
        );
        setBdcLeadPushConfig(leadPush);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      } finally {
        if (active) setSalesAnalyticsAdminLoading(false);
      }
    };
    setSalesAnalyticsAdminLoading(true);
    run();
    return () => {
      active = false;
    };
  }, [adminSection, adminSession, adminToken, tab]);

  useEffect(() => {
    if (!(tab === "admin" && adminSection === "salesAnalytics" && adminSession && adminToken)) {
      return undefined;
    }
    const anyRunning = SALES_ANALYTICS_VARIANTS.some(
      (variant) =>
        ["queued", "running"].includes(
          String(salesAnalyticsAdminDashboards?.[variant.key]?.status?.state || "")
            .trim()
            .toLowerCase()
        )
    );
    if (!anyRunning) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshAdminSalesAnalyticsOverview().catch(() => {});
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [adminSection, adminSession, adminToken, salesAnalyticsAdminDashboards, tab]);

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
        if (!active) return;
        setAdminSession(session);
        if (session?.token && session.token !== adminToken) {
          storeAdminToken(session.token);
          setAdminToken(session.token);
        }
      } catch {
        if (!active) return;
        storeAdminToken("");
        setAdminToken("");
        setAdminSession(null);
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
        setBdcLeadPushConfig(DEFAULT_BDC_LEAD_PUSH_CONFIG);
        return;
      }
      try {
        const data = await getBdcLeadPushConfig(adminToken);
        if (active) setBdcLeadPushConfig(data || DEFAULT_BDC_LEAD_PUSH_CONFIG);
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
      if (adminSession && adminToken) tasks.push(refreshBdcLeadPushConfig({ quiet: true }));
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
      const nextToken = session?.token || COOKIE_ADMIN_SESSION_MARKER;
      storeAdminToken(nextToken);
      setAdminToken(nextToken);
      setAdminSession(session);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    try {
      await adminLogout(adminToken);
    } catch {
      // Ignore logout transport failures and clear local admin state either way.
    } finally {
      storeAdminToken("");
      setAdminToken("");
      setAdminSession(null);
    }
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

  function specialsSourceUrl(sourceKey) {
    if (sourceKey === "kia_new") return specialsConfig.kia_new_url || specialFeedSourceMap.kia_new?.defaultUrl || "";
    if (sourceKey === "mazda_new") return specialsConfig.mazda_new_url || specialFeedSourceMap.mazda_new?.defaultUrl || "";
    return specialsConfig.used_srp_url || specialFeedSourceMap.used_srp?.defaultUrl || "";
  }

  async function persistUsedSpecialsUrl() {
    const draftUrl = String(specialsConfigDraft.used_srp_url || "").trim();
    const savedUrl = String(specialsConfig.used_srp_url || "").trim();
    if (!draftUrl || draftUrl === savedUrl) return specialsConfig;
    const nextConfig = await updateSpecialsConfig(adminToken, { used_srp_url: draftUrl });
    setSpecialsConfig(nextConfig);
    setSpecialsConfigDraft({ used_srp_url: nextConfig.used_srp_url || "" });
    return nextConfig;
  }

  async function refreshSpecialFeedSource(sourceKey) {
    setBusy(`specials-auto-${sourceKey}`);
    setError("");
    try {
      const saved = await importSpecialFeedSource(adminToken, sourceKey);
      syncSpecialsState(saved);
      const refreshedSection = (saved.vehicle_sections || []).find((section) => section.key === sourceKey);
      const refreshedCount = refreshedSection?.entries?.length || 0;
      setSpecialsImportStatus(`Refreshed ${specialFeedSourceMap[sourceKey]?.label || "website specials"} with ${refreshedCount} live tile${refreshedCount === 1 ? "" : "s"}.`);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function refreshAutomaticSpecials() {
    setBusy("specials-auto-all");
    setError("");
    try {
      const kiaSaved = await importSpecialFeedSource(adminToken, "kia_new");
      syncSpecialsState(kiaSaved);
      const mazdaSaved = await importSpecialFeedSource(adminToken, "mazda_new");
      syncSpecialsState(mazdaSaved);
      const usedSaved = await importSpecialFeedSource(adminToken, "used_srp");
      syncSpecialsState(usedSaved);
      const sections = usedSaved.vehicle_sections || [];
      const kiaCount = sections.find((section) => section.key === "kia_new")?.entries?.length || 0;
      const mazdaCount = sections.find((section) => section.key === "mazda_new")?.entries?.length || 0;
      const usedCount = sections.find((section) => section.key === "used_srp")?.entries?.length || 0;
      setSpecialsImportStatus(`Refreshed Kia (${kiaCount}), Mazda (${mazdaCount}), and Auto Outlet (${usedCount}) from the live feeds.`);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function startSpecialImportFlow(sourceKey) {
    setBusy(`specials-prepare-${sourceKey}`);
    setError("");
    try {
      let nextConfig = specialsConfig;
      if (sourceKey === "used_srp") {
        const draftUrl = String(specialsConfigDraft.used_srp_url || "").trim();
        const savedUrl = String(specialsConfig.used_srp_url || "").trim();
        if (draftUrl && draftUrl !== savedUrl) {
          nextConfig = await updateSpecialsConfig(adminToken, { used_srp_url: draftUrl });
          setSpecialsConfig(nextConfig);
          setSpecialsConfigDraft({ used_srp_url: nextConfig.used_srp_url || "" });
        }
      }
      const sourceUrl =
        sourceKey === "kia_new"
          ? nextConfig.kia_new_url || specialFeedSourceMap.kia_new?.defaultUrl || ""
          : sourceKey === "mazda_new"
            ? nextConfig.mazda_new_url || specialFeedSourceMap.mazda_new?.defaultUrl || ""
            : nextConfig.used_srp_url || specialFeedSourceMap.used_srp?.defaultUrl || "";
      if (!sourceUrl) {
        throw new Error("Add the used SRP URL first.");
      }
      await copyTextValue(buildSpecialFeedImportScript(sourceKey));
      if (typeof window !== "undefined") {
        window.open(sourceUrl, "_blank", "noopener,noreferrer");
      }
      setSpecialsImportStatus(
        `Opened ${specialFeedSourceMap[sourceKey]?.label || "the source page"} and copied the import script. Paste it into the page console, then come back and click Import Clipboard.`
      );
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function importSpecialFeedPayload(rawPayload, fallbackSourceKey = "") {
    const rawText = String(rawPayload || "").trim();
    if (!rawText) {
      setError("Paste a specials payload first.");
      return;
    }
    setBusy(`specials-import-${fallbackSourceKey || "payload"}`);
    setError("");
    try {
      const parsed = JSON.parse(rawText);
      const sourceKey = parsed.source_key || fallbackSourceKey;
      if (!sourceKey) {
        throw new Error("Payload is missing a source key.");
      }
      const saved = await importSpecialFeed(adminToken, {
        source_key: sourceKey,
        source_url: parsed.source_url || specialsSourceUrl(sourceKey),
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      });
      syncSpecialsState(saved);
      setSpecialsImportPayload("");
      setSpecialsImportStatus(`Imported ${(parsed.entries || []).length} ${specialFeedSourceMap[sourceKey]?.label || "special"} entries.`);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function importSpecialFeedFromClipboard(sourceKey) {
    try {
      const clipboardValue = await readClipboardText();
      await importSpecialFeedPayload(clipboardValue, sourceKey);
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  function exportStaffRosterCsv() {
    try {
      const csv = buildStaffRosterCsv({ salespeople, bdcAgents });
      const totalRows = salespeople.length + bdcAgents.length;
      downloadTextFile(`staff-roster-${todayDateValue()}.csv`, csv, "text/csv;charset=utf-8");
      setStaffRosterFeedback({
        kind: "success",
        message: `Downloaded ${totalRows} staff rows. Edit the same CSV in Excel and upload it here to bulk sync the roster.`,
      });
      setError("");
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  function openStaffRosterImportPicker() {
    if (busy === "staff-import") return;
    staffImportInputRef.current?.click();
  }

  async function importStaffRosterCsvFile(file) {
    if (!adminToken) {
      setStaffRosterFeedback({ kind: "error", message: "Sign in as admin first." });
      return;
    }

    setBusy("staff-import");
    setError("");
    setStaffRosterFeedback(null);

    try {
      const text = await file.text();
      const rows = parseStaffRosterCsv(text);
      if (!rows.length) {
        throw new Error("No staff rows were found in the CSV.");
      }

      const salesById = new Map(salespeople.map((person) => [Number(person.id), person]));
      const salesByName = new Map(salespeople.map((person) => [normalizeStaffRosterLookupKey(person.name), person]));
      const bdcById = new Map(bdcAgents.map((agent) => [Number(agent.id), agent]));
      const bdcByName = new Map(bdcAgents.map((agent) => [normalizeStaffRosterLookupKey(agent.name), agent]));
      const seenTargets = new Set();
      const summary = { updated: 0, created: 0, unchanged: 0, failed: 0 };
      const failures = [];

      for (const row of rows) {
        const lookupKey = `${row.staffType}:${row.recordId || normalizeStaffRosterLookupKey(row.name)}`;
        if (seenTargets.has(lookupKey)) {
          throw new Error(`CSV includes "${row.name}" more than once for ${row.staffType}. Keep one row per staff record.`);
        }
        seenTargets.add(lookupKey);
      }

      for (const row of rows) {
        try {
          if (row.staffType === "Sales") {
            const existing =
              (row.recordId ? salesById.get(Number(row.recordId)) : null) || salesByName.get(normalizeStaffRosterLookupKey(row.name));
            const payload = buildImportedSalespersonPayload(row, existing);

            if (existing && salespersonMatchesPayload(existing, payload)) {
              summary.unchanged += 1;
              continue;
            }

            const saved = existing
              ? await updateSalesperson(adminToken, existing.id, payload)
              : await createSalesperson(adminToken, payload);
            const priorNameKey = existing ? normalizeStaffRosterLookupKey(existing.name) : "";
            if (priorNameKey) {
              salesByName.delete(priorNameKey);
            }
            salesById.set(Number(saved.id), saved);
            salesByName.set(normalizeStaffRosterLookupKey(saved.name), saved);
            summary[existing ? "updated" : "created"] += 1;
            continue;
          }

          const existing =
            (row.recordId ? bdcById.get(Number(row.recordId)) : null) || bdcByName.get(normalizeStaffRosterLookupKey(row.name));
          const payload = buildImportedBdcAgentPayload(row, existing);

          if (existing && bdcAgentMatchesPayload(existing, payload)) {
            summary.unchanged += 1;
            continue;
          }

          const saved = existing ? await updateBdcAgent(adminToken, existing.id, payload) : await createBdcAgent(adminToken, payload);
          const priorNameKey = existing ? normalizeStaffRosterLookupKey(existing.name) : "";
          if (priorNameKey) {
            bdcByName.delete(priorNameKey);
          }
          bdcById.set(Number(saved.id), saved);
          bdcByName.set(normalizeStaffRosterLookupKey(saved.name), saved);
          summary[existing ? "updated" : "created"] += 1;
        } catch (errorValue) {
          summary.failed += 1;
          if (failures.length < 5) {
            failures.push(`Row ${row.rowNumber} (${row.staffType} ${row.name}): ${errText(errorValue)}`);
          }
        }
      }

      await refresh();

      const baseMessage = `${file.name}: ${formatStaffRosterImportSummary(summary)}.`;
      if (summary.failed) {
        setStaffRosterFeedback({
          kind: "error",
          message: failures.length ? `${baseMessage} ${failures.join(" ")}` : baseMessage,
        });
      } else {
        setStaffRosterFeedback({
          kind: "success",
          message: `${baseMessage} The live roster now matches the uploaded CSV.`,
        });
      }
    } catch (errorValue) {
      setStaffRosterFeedback({ kind: "error", message: errText(errorValue) });
    } finally {
      setBusy("");
      setStaffImportKey((current) => current + 1);
    }
  }

  async function handleStaffRosterImportChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    await importStaffRosterCsvFile(file);
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

  function applyFreshUpSalespersonSelection(value) {
    const selectedId = String(value || "").trim();
    const match = activeSales.find((person) => String(person.id) === selectedId) || null;
    setFreshUpForm((current) => ({
      ...current,
      salespersonId: match ? String(match.id) : "",
      salespersonQuery: match ? match.name : "",
    }));
    setFreshUpStatus("");
    setFreshUpFormError("");
  }

  function updateFreshUpFormField(field, value) {
    setFreshUpForm((current) => ({ ...current, [field]: value }));
    setFreshUpFormError("");
    if (freshUpCardMode) {
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
    setFreshUpFormError("");
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
    setError("");
    setFreshUpFormError("");
    const validationMessage = freshUpValidationMessage(freshUpForm, freshUpAssignedSalesperson);
    if (validationMessage) {
      setFreshUpFormError(validationMessage);
      return;
    }
    setBusy("freshup-submit");
    try {
      const salespersonId =
        freshUpAssignedSalesperson?.id || (freshUpForm.salespersonId ? Number(freshUpForm.salespersonId) : undefined);
      if (!salespersonId) {
        throw new Error("Pick the salesperson first.");
      }
      const customerName = String(freshUpForm.customerName || "").trim();
      const customerPhone = formatPhoneInput(digitsOnly(freshUpForm.phone));
      const freshUpResult = await createFreshUpLog({
        customer_name: customerName,
        customer_phone: customerPhone,
        salesperson_id: salespersonId,
        source: freshUpCardMode ? "NFC Card" : "Desk",
        send_gift_text: freshUpCardMode,
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
          ? freshUpGiftCustomerStatus(freshUpResult, customerPhone, freshUpAssignedSalesperson?.name || "")
          : "Freshup logged."
      );
      if (freshUpCardMode && typeof document !== "undefined") {
        window.setTimeout(() => {
          document.getElementById("freshup-links")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } catch (errorValue) {
      setFreshUpFormError(errText(errorValue));
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
      const nextConfig = normalizeFreshUpLinksConfig(freshUpLinksConfig);
      const updated = await updateFreshUpLinks(adminToken, nextConfig);
      setFreshUpLinksConfig(normalizeFreshUpLinksConfig(updated));
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

  const runningAdminSalesAnalytics = SALES_ANALYTICS_VARIANTS.map((variant) => {
    const dashboard = salesAnalyticsAdminDashboards[variant.key] || emptySalesAnalyticsDashboard();
    const status = dashboard?.status || {};
    const state = String(status.state || "").trim().toLowerCase();
    if (!["queued", "running"].includes(state)) return null;
    return {
      key: variant.key,
      label: variant.label,
      state,
      startedAt: status.started_at,
      message: status.message,
    };
  }).filter(Boolean);

  function renderTrackerPendingEntryRow(entry, index) {
    return (
      <div
        key={`tracker-entry-${entry.id}`}
        className="bdc-sales-entry bdc-sales-entry-grid bdc-sales-entry-grid--tracker-pending is-pending"
      >
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--number" data-label="Row">
          #{index + 1}
        </div>
        <label className="bdc-sales-entry-cell bdc-sales-entry-cell--customer" data-label="Customer / phone">
          <input
            value={entry.profile_name}
            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "profile_name", event.target.value)}
            placeholder="Optional customer"
            aria-label={`Customer row ${entry.id}`}
          />
          <input
            value={entry.customer_phone || ""}
            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "customer_phone", event.target.value)}
            placeholder="Optional phone"
            aria-label={`Phone row ${entry.id}`}
            inputMode="tel"
          />
        </label>
        <label className="bdc-sales-entry-cell" data-label="Opp ID">
          <input
            value={entry.opportunity_id || ""}
            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "opportunity_id", event.target.value)}
            placeholder="Opp ID"
            aria-label={`Opp ID row ${entry.id}`}
          />
        </label>
        <label className="bdc-sales-entry-cell" data-label="DMS #">
          <input
            value={entry.dms_number}
            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "dms_number", event.target.value)}
            placeholder="DMS No."
            aria-label={`DMS number row ${entry.id}`}
          />
        </label>
        <label className="bdc-sales-entry-cell" data-label="Note">
          <input
            value={entry.notes}
            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "notes", event.target.value)}
            placeholder="Tracking note"
            aria-label={`Tracking note row ${entry.id}`}
          />
        </label>
        <div className="bdc-sales-entry__actions bdc-sales-entry__actions--compact" data-label="Actions">
          <button
            type="button"
            className="secondary"
            onClick={() => saveBdcSalesTrackerEntry(entry)}
            disabled={busy === `bdc-sales-entry-${entry.id}`}
          >
            {busy === `bdc-sales-entry-${entry.id}` ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="button-danger"
            onClick={() => removeBdcSalesTrackerEntry(entry.id)}
            disabled={busy === `bdc-sales-delete-${entry.id}`}
          >
            {busy === `bdc-sales-delete-${entry.id}` ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  }

  function renderTrackerSoldEntryRow(entry, index) {
    return (
      <article
        key={`tracker-sold-${entry.id}`}
        className="bdc-sales-entry bdc-sales-entry-grid bdc-sales-entry-grid--tracker-sold is-sold"
      >
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--number" data-label="Row">
          #{index + 1}
        </div>
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--readonly" data-label="Sold at">
          <strong>{entry.sold_at ? dateTimeLabel(entry.sold_at) : "Marked sold"}</strong>
          <small>Admin Reynolds match</small>
        </div>
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--readonly" data-label="Customer / phone">
          <strong>{entry.profile_name || "No customer saved"}</strong>
          {entry.customer_phone ? <small>{entry.customer_phone}</small> : <small>No phone saved</small>}
        </div>
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--readonly" data-label="Opp ID">
          <strong>{entry.opportunity_id || "-"}</strong>
        </div>
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--readonly" data-label="DMS #">
          <strong>{entry.dms_number || "-"}</strong>
        </div>
        <div className="bdc-sales-entry-cell bdc-sales-entry-cell--readonly" data-label="Note">
          <strong>{entry.notes || "No note saved"}</strong>
        </div>
      </article>
    );
  }

  function renderSelectedTrackerAgentWorkspace() {
    if (!selectedTrackerAgent) return null;
    const draftHasIdentity = trackerEntryHasSaleIdentity({
      profile_name: selectedTrackerDraftIdentityPreview.customer_name || selectedTrackerAgentDraft.profile_name,
      opportunity_id: selectedTrackerDraftIdentityPreview.opportunity_id || "",
      dms_number: selectedTrackerDraftIdentityPreview.dms_number || selectedTrackerAgentDraft.dms_number,
      customer_phone: selectedTrackerAgentDraft.customer_phone,
    });
    const draftHasNotes = Boolean(String(selectedTrackerAgentDraft.notes || "").trim());
    const draftButtonLabel =
      busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}`
        ? "Saving..."
        : draftHasIdentity
          ? "Save Tracking Row"
          : draftHasNotes
            ? "Save Note"
            : "Save Row";

    return (
      <div className="panel bdc-sales-selected-sheet">
        <div className="bdc-sales-agent-card__header">
          <div>
            <span className="eyebrow">Tracker worksheet</span>
            <h3>{selectedTrackerAgent.agent_name}'s agent workspace</h3>
            <p className="admin-note">
              One order only: the BDC agent saves a simple row at the top, works the live tracking rows in the middle,
              and reads the Reynolds sold rows at the bottom.
            </p>
          </div>
          <div className={`bdc-sales-agent-card__status ${selectedTrackerAgent.active ? "is-active" : "is-inactive"}`}>
            {selectedTrackerAgent.active ? "Active" : "Historical"}
          </div>
        </div>

        <div className="bdc-sales-agent-card__summary-grid">
          <div className="bdc-sales-agent-card__summary-stat">
            <span>Tracking rows</span>
            <strong>{selectedTrackerTrackingCount}</strong>
          </div>
          <div className="bdc-sales-agent-card__summary-stat">
            <span>Pending deals</span>
            <strong>{selectedTrackerPendingCount}</strong>
          </div>
          <div className="bdc-sales-agent-card__summary-stat">
            <span>DMS sold</span>
            <strong>{selectedTrackerConfirmedCount}</strong>
          </div>
          <div className="bdc-sales-agent-card__summary-stat">
            <span>Manual sold report</span>
            <strong>{selectedTrackerActualSold}</strong>
          </div>
        </div>

        <div className="bdc-sales-agent-card__summary-rates">
          <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
            Set {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)}
          </span>
          <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
            Show {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)}
          </span>
          <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
            Sold {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)}
          </span>
          <span className="bdc-sales-rate-pill is-neutral">Projected {formatTrackerNumber(selectedTrackerProjection)}</span>
        </div>

        {canEditTrackerAdmin ? (
          <>
            <div className="bdc-sales-metrics-grid">
              <label>
                <span>Total Leads</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.total_leads ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "total_leads", event.target.value)}
                />
              </label>
              <label>
                <span>Appts Created</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.appointments_set ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "appointments_set", event.target.value)}
                />
              </label>
              <label>
                <span>Appts Shown</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.appointments_shown ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "appointments_shown", event.target.value)}
                />
              </label>
              <label>
                <span>Manual sold report</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.actual_sold ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "actual_sold", event.target.value)}
                />
              </label>
              <label>
                <span>MTD Calls</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.calls_mtd ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "calls_mtd", event.target.value)}
                />
              </label>
              <label>
                <span>MTD Email</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.emails_mtd ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "emails_mtd", event.target.value)}
                />
              </label>
              <label>
                <span>MTD Text</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.texts_mtd ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "texts_mtd", event.target.value)}
                />
              </label>
              <label>
                <span>Days Off</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={selectedTrackerAgent.days_off ?? ""}
                  onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "days_off", event.target.value)}
                />
              </label>
              <div className="bdc-sales-metrics-card">
                <span>Set / shown / sold</span>
                <strong>
                  {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)} /{" "}
                  {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)} /{" "}
                  {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)}
                </strong>
                <small>{selectedTrackerAgent.average_activity_label || "0 / 0 / 0"} calls / email / text</small>
              </div>
            </div>

            <div className="bdc-sales-agent-card__actions">
              <button
                type="button"
                onClick={() => saveBdcSalesTrackerMetrics(selectedTrackerAgent)}
                disabled={busy === `bdc-sales-metrics-${selectedTrackerAgent.agent_id}`}
              >
                {busy === `bdc-sales-metrics-${selectedTrackerAgent.agent_id}` ? "Saving..." : "Save Admin Metrics"}
              </button>
            </div>
          </>
        ) : (
          <div className="bdc-sales-metrics-grid bdc-sales-metrics-grid--static">
            <div className="bdc-sales-metrics-card">
              <span>Total Leads</span>
              <strong>{selectedTrackerTotalLeads}</strong>
              <small>Manual admin report input</small>
            </div>
            <div className="bdc-sales-metrics-card">
              <span>Appts Created</span>
              <strong>{selectedTrackerAppointmentsSet}</strong>
              <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)} of leads
              </small>
            </div>
            <div className="bdc-sales-metrics-card">
              <span>Appts Shown</span>
              <strong>{selectedTrackerAppointmentsShown}</strong>
              <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)} of set appointments
              </small>
            </div>
            <div className="bdc-sales-metrics-card">
              <span>Manual sold report</span>
              <strong>{selectedTrackerActualSold}</strong>
              <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)} sold from appointments set
              </small>
            </div>
            <div className="bdc-sales-metrics-card">
              <span>MTD Activity</span>
              <strong>{selectedTrackerAgent.average_activity_label || "0 / 0 / 0"}</strong>
              <small>Calls / email / text with {Number(selectedTrackerAgent.days_off || 0)} day(s) off</small>
            </div>
          </div>
        )}

        <section className="bdc-sales-entry-sheet bdc-sales-entry-sheet--workspace">
          <div className="bdc-sales-entry-sheet__intro">
            <strong>Agent input</strong>
            <small>
              Paste the CRM opportunity line or leave it blank and save just a note. Every save creates one simple row.
            </small>
          </div>
          <div className="bdc-sales-entry-create-panel bdc-sales-entry-create-panel--workspace">
            <label className="bdc-sales-entry-create-panel__field bdc-sales-entry-create-panel__field--identity">
              <span>CRM opportunity line</span>
              <textarea
                rows={2}
                value={selectedTrackerAgentDraft.profile_name}
                onChange={(event) => patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "profile_name", event.target.value)}
                placeholder="Jose Escobedo / Opp ID 5749299 / DMS No. 125020"
                aria-label={`CRM opportunity line for ${selectedTrackerAgent.agent_name}`}
              />
            </label>
            <label className="bdc-sales-entry-create-panel__field">
              <span>Phone</span>
              <input
                value={selectedTrackerAgentDraft.customer_phone}
                onChange={(event) => patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "customer_phone", event.target.value)}
                placeholder="Optional phone"
                inputMode="tel"
              />
            </label>
            <label className="bdc-sales-entry-create-panel__field">
              <span>Note</span>
              <input
                value={selectedTrackerAgentDraft.notes}
                onChange={(event) => patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "notes", event.target.value)}
                placeholder="Optional note"
              />
            </label>
            <button
              type="button"
              className="bdc-sales-entry-create-panel__submit"
              onClick={() => addBdcSalesTrackerEntry(selectedTrackerAgent)}
              disabled={busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}`}
            >
              {draftButtonLabel}
            </button>
            <div className="bdc-sales-entry-create-panel__parsed">
              <span>{selectedTrackerDraftIdentityPreview.customer_name || "Customer name fills from the pasted line"}</span>
              <span>{selectedTrackerDraftIdentityPreview.opportunity_id || "Opp ID fills from the pasted line"}</span>
              <span>{selectedTrackerDraftIdentityPreview.dms_number || "DMS number fills from the pasted line"}</span>
            </div>
          </div>
        </section>

        <section className="bdc-sales-entry-sheet bdc-sales-entry-sheet--workspace">
          <div className="bdc-sales-entry-sheet__intro">
            <strong>Tracking notes</strong>
            <small>
              Everything still being traced stacks here. Rows can be a note only or a pending deal the agent is working.
            </small>
          </div>
          {selectedTrackerPendingEntries.length ? (
            <>
              <div className="bdc-sales-entry-grid bdc-sales-entry-grid--header bdc-sales-entry-grid--tracker-pending">
                <span>#</span>
                <span>Customer / phone</span>
                <span>Opp ID</span>
                <span>DMS #</span>
                <span>Note</span>
                <span>Actions</span>
              </div>
              <div className="bdc-sales-entry-list">
                {selectedTrackerPendingEntries.map((entry, index) => renderTrackerPendingEntryRow(entry, index))}
              </div>
            </>
          ) : (
            <div className="empty">No tracking rows for {selectedTrackerAgent.agent_name} yet.</div>
          )}
        </section>

        <section className="bdc-sales-entry-sheet bdc-sales-entry-sheet--workspace">
          <div className="bdc-sales-entry-sheet__intro">
            <strong>DMS sold from Reynolds</strong>
            <small>
              These are the sure sold deals pushed in from the admin DMS log. They stay read only on the agent tracker.
            </small>
          </div>
          {selectedTrackerSoldEntries.length ? (
            <>
              <div className="bdc-sales-entry-grid bdc-sales-entry-grid--header bdc-sales-entry-grid--tracker-sold">
                <span>#</span>
                <span>Sold at</span>
                <span>Customer / phone</span>
                <span>Opp ID</span>
                <span>DMS #</span>
                <span>Note</span>
              </div>
              <div className="bdc-sales-entry-list">
                {selectedTrackerSoldEntries.map((entry, index) => renderTrackerSoldEntryRow(entry, index))}
              </div>
            </>
          ) : (
            <div className="empty">No Reynolds sold rows for {selectedTrackerAgent.agent_name} yet.</div>
          )}
        </section>
      </div>
    );
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
          <div className={`hero-card ${adminSession ? "" : "hero-card--quote"}`}>
            <span>{adminSession ? "Admin" : SIGNED_OUT_HERO_QUOTE.label}</span>
            <strong>{adminSession ? adminSession.username : SIGNED_OUT_HERO_QUOTE.text}</strong>
            <small>{adminSession ? "Management actions unlocked" : SIGNED_OUT_HERO_QUOTE.author}</small>
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
                aria-current={tab === item.id ? "page" : undefined}
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
                      aria-pressed={selectedTrafficBrandFilter === brand}
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
                      <span key={item} className={`bdc-last-assigned__notification ${bdcNotificationToneClass(item)}`}>
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

        {tab === "bdcSalesTracker" ? (
          <section className="stack">
            <div className="panel bdc-sales-selector-panel">
              <div className="bdc-sales-selector-panel__copy">
                <span className="eyebrow">Start here</span>
                <h2>
                  {selectedTrackerAgent
                    ? `${selectedTrackerAgent.agent_name}'s BDC sales tracker`
                    : "Choose your name to open your BDC sales tracker"}
                </h2>
                <p className="admin-note">
                  Pick the BDC agent first. The selected view stays in one order: simple input at the top, tracking rows in
                  the middle, and read-only Reynolds sold rows at the bottom.
                </p>
                <div className="bdc-sales-tracker-hero__meta">
                  <span className="bdc-sales-meta-chip">{monthLabel(bdcSalesTrackerMonth)}</span>
                  <span className="bdc-sales-meta-chip">
                    {selectedTrackerAgent ? `${selectedTrackerTrackingCount} live tracking rows` : "Choose a BDC agent"}
                  </span>
                  <span className="bdc-sales-meta-chip">
                    {selectedTrackerAgent
                      ? `${selectedTrackerPendingCount} pending deals / ${selectedTrackerConfirmedCount} DMS sold`
                      : "Tracker narrows to one agent at a time"}
                  </span>
                  <span className="bdc-sales-meta-chip">
                    {selectedTrackerAgent ? `${selectedTrackerNoteCount} note-only rows` : "Notes and deals stack together"}
                  </span>
                  <span className="bdc-sales-meta-chip">
                    {trackerDaysWorked} worked / {trackerDaysLeft} left
                  </span>
                  <span className="bdc-sales-meta-chip">
                    {trackerCanViewDmsLog
                      ? "Kai DMS log unlocked"
                      : canEditTrackerAdmin
                        ? "DMS log hidden unless Kai is selected"
                        : "DMS log is admin only"}
                  </span>
                </div>
              </div>
              <div className="bdc-sales-selector-panel__controls">
                <label className="bdc-sales-selector-panel__field bdc-sales-selector-panel__field--primary">
                  <span>BDC agent</span>
                  <select
                    className="bdc-sales-selector-panel__select"
                    value={selectedTrackerFocus?.key || ""}
                    autoFocus
                    onChange={(event) => applyBdcSalesTrackerFocusSelection(event.target.value)}
                  >
                    <option value="">Choose your name</option>
                    {trackerFocusOptions.map((option) => (
                      <option key={`tracker-focus-${option.key}`} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="bdc-sales-selector-panel__support">
                  <div className="bdc-sales-view-toggle">
                    <button
                      type="button"
                      className={`secondary ${bdcSalesTrackerView === "tracker" ? "is-active" : ""}`}
                      onClick={() => setBdcSalesTrackerView("tracker")}
                      aria-pressed={bdcSalesTrackerView === "tracker"}
                    >
                      Tracker
                    </button>
                    {trackerCanViewDmsLog ? (
                      <button
                        type="button"
                        className={`secondary ${bdcSalesTrackerView === "dmsLog" ? "is-active" : ""}`}
                        onClick={() => setBdcSalesTrackerView("dmsLog")}
                        aria-pressed={bdcSalesTrackerView === "dmsLog"}
                      >
                        DMS Log
                      </button>
                    ) : null}
                  </div>
                  <div className="bdc-sales-tracker-hero__controls">
                    <label>
                      <span>Month</span>
                      <input type="month" value={bdcSalesTrackerMonth} onChange={(event) => setBdcSalesTrackerMonth(event.target.value)} />
                    </label>
                    {canEditTrackerAdmin ? (
                      <>
                        <label>
                          <span>Monthly sold goal</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            value={bdcSalesTrackerGoalDraft}
                            onChange={(event) => setBdcSalesTrackerGoalDraft(event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={saveBdcSalesTrackerGoal}
                          disabled={busy === "bdc-sales-goal"}
                        >
                          {busy === "bdc-sales-goal" ? "Saving..." : "Save Goal"}
                        </button>
                      </>
                    ) : (
                      <div className="bdc-sales-selector-panel__goal-readout">
                        <span>Monthly sold goal</span>
                        <strong>{Math.round(trackerGoalValue || 0)}</strong>
                      </div>
                    )}
                  </div>
                </div>
                {selectedTrackerAgent ? (
                  <div className="bdc-sales-workspace-panel__stats">
                    <span>
                      <b>{selectedTrackerTrackingCount}</b>
                      Tracking
                    </span>
                    <span>
                      <b>{selectedTrackerPendingCount}</b>
                      Pending deals
                    </span>
                    <span>
                      <b>{selectedTrackerConfirmedCount}</b>
                      DMS sold
                    </span>
                    <span>
                      <b>{selectedTrackerActualSold}</b>
                      Manual sold
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {bdcSalesTrackerView === "tracker" ? (
              <>
                {selectedTrackerAgent ? (
                  renderSelectedTrackerAgentWorkspace()
                ) : (
                  <div className="panel">
                    <span className="eyebrow">Waiting on agent selection</span>
                    <h3>Pick a BDC agent in the first tile</h3>
                    <p className="admin-note">
                      Once an agent is selected, this page narrows to one simple input row, live tracking rows, and
                      read-only Reynolds sold records.
                    </p>
                  </div>
                )}

                {false ? (
                  <>
                <details className="panel bdc-sales-workspace-panel bdc-sales-note-stack-panel bdc-sales-collapsible" open>
                  <summary className="bdc-sales-collapsible__summary bdc-sales-note-stack-panel__summary">
                    <div className="bdc-sales-collapsible__copy">
                      <span className="eyebrow">Agent notes</span>
                      <h3>{selectedTrackerAgent.agent_name}'s tracing note stack</h3>
                      <p className="admin-note">
                        Keep this simple. Each note saves as its own row so the rep can keep an unlimited running list of anything
                        still being traced.
                      </p>
                    </div>
                    <div className="bdc-sales-insights-panel__summary-chips">
                      <span>{selectedTrackerNoteCount} notes</span>
                      <span>{selectedTrackerExpectedCount} sale rows</span>
                      <span>{monthLabel(bdcSalesTrackerMonth)}</span>
                    </div>
                    <span className="bdc-sales-collapsible__toggle">Toggle notes</span>
                  </summary>

                  <div className="bdc-sales-collapsible__body bdc-sales-workspace-panel__layout">
                    <div className="bdc-sales-workspace-panel__notes bdc-sales-note-stack__composer">
                      <label className="bdc-sales-note-stack__field">
                        <span>New tracing note</span>
                        <textarea
                          rows={3}
                          value={selectedTrackerNoteDraft}
                          onChange={(event) => patchBdcSalesTrackerNoteDraft(selectedTrackerAgent.agent_id, event.target.value)}
                          placeholder="Type anything this rep needs to keep eyes on."
                        />
                      </label>
                      <div className="bdc-sales-workspace-panel__actions">
                        <button
                          type="button"
                          onClick={() => addBdcSalesTrackerNote(selectedTrackerAgent)}
                          disabled={busy === `bdc-sales-note-create-${selectedTrackerAgent.agent_id}`}
                        >
                          {busy === `bdc-sales-note-create-${selectedTrackerAgent.agent_id}` ? "Saving..." : "Add Note"}
                        </button>
                      </div>
                    </div>

                    <div className="bdc-sales-workspace-panel__quick-add">
                      <div className="bdc-sales-workspace-panel__quick-head">
                        <div>
                          <span className="eyebrow">Saved notes</span>
                          <h4>{selectedTrackerNoteCount ? "Review and edit the saved tracing notes" : "Notes will stack here as they are added"}</h4>
                        </div>
                        {selectedTrackerAgent ? (
                          <div className="bdc-sales-workspace-panel__stats">
                            <span>
                              <b>{selectedTrackerNoteCount}</b>
                              Notes
                            </span>
                            <span>
                              <b>{selectedTrackerExpectedCount}</b>
                              Sale rows
                            </span>
                            <span>
                              <b>{monthLabel(bdcSalesTrackerMonth)}</b>
                              Month
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {selectedTrackerAgent ? (
                        <div className="bdc-sales-note-stack__list">
                          {selectedTrackerNoteEntries.length ? (
                            selectedTrackerNoteEntries.map((entry) => (
                              <article key={`tracker-note-${entry.id}`} className="bdc-sales-note-stack__entry">
                                <div className="bdc-sales-note-stack__entry-meta">
                                  <span>{entry.updated_at ? `Updated ${dateTimeLabel(entry.updated_at)}` : "Unsaved"}</span>
                                  <span>{selectedTrackerAgent.agent_name}</span>
                                </div>
                                <textarea
                                  rows={3}
                                  value={entry.notes}
                                  onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "notes", event.target.value)}
                                  aria-label={`Tracing note row ${entry.id}`}
                                />
                                <div className="bdc-sales-note-stack__entry-actions">
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => saveBdcSalesTrackerEntry(entry)}
                                    disabled={busy === `bdc-sales-entry-${entry.id}`}
                                  >
                                    {busy === `bdc-sales-entry-${entry.id}` ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className="button-danger"
                                    onClick={() => removeBdcSalesTrackerEntry(entry.id)}
                                    disabled={busy === `bdc-sales-delete-${entry.id}`}
                                  >
                                    {busy === `bdc-sales-delete-${entry.id}` ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </article>
                            ))
                          ) : (
                            <div className="empty">No tracing notes for {selectedTrackerAgent.agent_name} yet.</div>
                          )}
                        </div>
                      ) : (
                        <div className="bdc-sales-workspace-panel__empty">
                          Choose Cindy, Joanna, or Kai in the first tile, then this page will narrow down to that agent’s note,
                          expected sale count, and tracked DMS rows.
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {selectedTrackerAgent ? (
                  <div className="panel bdc-sales-selected-sheet">
                    <div className="bdc-sales-agent-card__header">
                      <div>
                        <span className="eyebrow">Tracker worksheet</span>
                        <h3>{selectedTrackerAgent.agent_name}'s expected sales sheet</h3>
                        <p className="admin-note">
                          Grey rows are what the agent believes should turn into a sale. Green rows are the apt sold rows already matched
                          in Reynolds by admin for payroll.
                        </p>
                      </div>
                      <div className={`bdc-sales-agent-card__status ${selectedTrackerAgent.active ? "is-active" : "is-inactive"}`}>
                        {selectedTrackerAgent.active ? "Active" : "Historical"}
                      </div>
                    </div>

                    <div className="bdc-sales-agent-card__summary-grid">
                      <div className="bdc-sales-agent-card__summary-stat">
                        <span>Expected sales</span>
                        <strong>{selectedTrackerExpectedCount}</strong>
                      </div>
                      <div className="bdc-sales-agent-card__summary-stat">
                        <span>Still pending</span>
                        <strong>{selectedTrackerPendingCount}</strong>
                      </div>
                      <div className="bdc-sales-agent-card__summary-stat">
                        <span>Apt sold (green)</span>
                        <strong>{selectedTrackerConfirmedCount}</strong>
                      </div>
                      <div className="bdc-sales-agent-card__summary-stat">
                        <span>Apt sold</span>
                        <strong>{selectedTrackerActualSold}</strong>
                      </div>
                    </div>

                    <div className="bdc-sales-agent-card__summary-rates">
                      <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                        Set {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)}
                      </span>
                      <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                        Show {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)}
                      </span>
                      <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(selectedTrackerAgent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                        Sold {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)}
                      </span>
                      <span className="bdc-sales-rate-pill is-neutral">
                        Projected {formatTrackerNumber(selectedTrackerProjection)}
                      </span>
                    </div>

                    {canEditTrackerAdmin ? (
                      <>
                        <div className="bdc-sales-metrics-grid">
                          <label>
                            <span>Total Leads</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.total_leads ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "total_leads", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Appts Created</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.appointments_set ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "appointments_set", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Appts Shown</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.appointments_shown ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "appointments_shown", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Apt Sold</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.actual_sold ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "actual_sold", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>MTD Calls</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.calls_mtd ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "calls_mtd", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>MTD Email</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.emails_mtd ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "emails_mtd", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>MTD Text</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.texts_mtd ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "texts_mtd", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Days Off</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={selectedTrackerAgent.days_off ?? ""}
                              onChange={(event) => patchBdcSalesTrackerAgent(selectedTrackerAgent.agent_id, "days_off", event.target.value)}
                            />
                          </label>
                          <div className="bdc-sales-metrics-card">
                            <span>Set / shown / sold</span>
                            <strong>
                              {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)} /{" "}
                              {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)} /{" "}
                              {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)}
                            </strong>
                            <small>{selectedTrackerAgent.average_activity_label || "0 / 0 / 0"} calls / email / text</small>
                          </div>
                        </div>

                        <div className="bdc-sales-agent-card__actions">
                          <button
                            type="button"
                            onClick={() => saveBdcSalesTrackerMetrics(selectedTrackerAgent)}
                            disabled={busy === `bdc-sales-metrics-${selectedTrackerAgent.agent_id}`}
                          >
                            {busy === `bdc-sales-metrics-${selectedTrackerAgent.agent_id}` ? "Saving..." : "Save Admin Metrics"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="bdc-sales-metrics-grid bdc-sales-metrics-grid--static">
                        <div className="bdc-sales-metrics-card">
                          <span>Total Leads</span>
                          <strong>{selectedTrackerTotalLeads}</strong>
                          <small>Manual admin report input</small>
                        </div>
                        <div className="bdc-sales-metrics-card">
                          <span>Appts Created</span>
                          <strong>{selectedTrackerAppointmentsSet}</strong>
                          <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                            {formatPercent(selectedTrackerAgent.appointment_set_rate || 0)} of leads
                          </small>
                        </div>
                        <div className="bdc-sales-metrics-card">
                          <span>Appts Shown</span>
                          <strong>{selectedTrackerAppointmentsShown}</strong>
                          <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                            {formatPercent(selectedTrackerAgent.appointment_show_rate || 0)} of set appointments
                          </small>
                        </div>
                        <div className="bdc-sales-metrics-card">
                          <span>Apt sold</span>
                          <strong>{selectedTrackerActualSold}</strong>
                          <small className={`bdc-sales-rate ${trackerBenchmarkTone(selectedTrackerAgent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                            {formatPercent(selectedTrackerAgent.actual_sold_rate || 0)} sold from appointments set
                          </small>
                        </div>
                        <div className="bdc-sales-metrics-card">
                          <span>MTD Activity</span>
                          <strong>{selectedTrackerAgent.average_activity_label || "0 / 0 / 0"}</strong>
                          <small>Calls / email / text with {Number(selectedTrackerAgent.days_off || 0)} day(s) off</small>
                        </div>
                      </div>
                    )}

                    <div className="bdc-sales-entry-sheet">
                      <div className="bdc-sales-entry-sheet__intro">
                        <strong>Expected sale rows</strong>
                        <small>
                          Paste the CRM opportunity line here. Grey means expected. Green means admin already matched it in
                          Reynolds for payroll.
                        </small>
                      </div>

                      <div className="bdc-sales-entry-create-panel">
                        <label className="bdc-sales-entry-create-panel__field bdc-sales-entry-create-panel__field--identity">
                          <span>Paste CRM opportunity line</span>
                          <textarea
                            rows={2}
                            value={selectedTrackerAgentDraft.profile_name}
                            onChange={(event) =>
                              patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "profile_name", event.target.value)
                            }
                            placeholder="Jose Escobedo / Opp ID 5749299 / DMS No. 125020"
                            aria-label={`CRM opportunity line for ${selectedTrackerAgent.agent_name}`}
                          />
                        </label>
                        <label className="bdc-sales-entry-create-panel__field">
                          <span>Phone</span>
                          <input
                            value={selectedTrackerAgentDraft.customer_phone}
                            onChange={(event) =>
                              patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "customer_phone", event.target.value)
                            }
                            placeholder="Optional phone"
                            inputMode="tel"
                          />
                        </label>
                        <label className="bdc-sales-entry-create-panel__field">
                          <span>Working note</span>
                          <input
                            value={selectedTrackerAgentDraft.notes}
                            onChange={(event) => patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "notes", event.target.value)}
                            placeholder="Optional working note"
                          />
                        </label>
                        <button
                          type="button"
                          className="bdc-sales-entry-create-panel__submit"
                          onClick={() => addBdcSalesTrackerEntry(selectedTrackerAgent)}
                          disabled={busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}`}
                        >
                          {busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}` ? "Saving..." : "Save Expected Sale"}
                        </button>
                        <div className="bdc-sales-entry-create-panel__parsed">
                          <span>{selectedTrackerDraftIdentityPreview.customer_name || "Customer name will fill from the pasted line"}</span>
                          <span>{selectedTrackerDraftIdentityPreview.opportunity_id || "Opp ID will fill from the pasted line"}</span>
                          <span>{selectedTrackerDraftIdentityPreview.dms_number || "DMS No. will fill from the pasted line"}</span>
                        </div>
                      </div>

                      {selectedTrackerSaleEntries.length ? (
                        <>
                          <div className="bdc-sales-entry-toolbar">
                            <div className="bdc-sales-entry-toolbar__chips">
                              {trackerEntrySearchFields.map((field) => (
                                <button
                                  key={`tracker-search-field-${field.key}`}
                                  type="button"
                                  className={`secondary ${selectedTrackerSearchField.key === field.key ? "is-active" : ""}`}
                                  onClick={() => {
                                    setBdcSalesTrackerEntrySearch((current) => ({ ...current, field: field.key }));
                                    trackerEntrySearchInputRef.current?.focus();
                                  }}
                                >
                                  {field.label}
                                </button>
                              ))}
                            </div>
                            <div className="bdc-sales-entry-toolbar__search">
                              <input
                                ref={trackerEntrySearchInputRef}
                                value={bdcSalesTrackerEntrySearch.value}
                                onChange={(event) =>
                                  setBdcSalesTrackerEntrySearch((current) => ({ ...current, value: event.target.value }))
                                }
                                placeholder={`Search ${selectedTrackerSearchField.label.toLowerCase()}`}
                                aria-label={`Search ${selectedTrackerSearchField.label}`}
                              />
                              {bdcSalesTrackerEntrySearch.value ? (
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => setBdcSalesTrackerEntrySearch((current) => ({ ...current, value: "" }))}
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="bdc-sales-entry-grid bdc-sales-entry-grid--header">
                            <button
                              type="button"
                              className={`bdc-sales-entry-grid__header-button ${bdcSalesTrackerEntrySearch.field === "profile_name" ? "is-active" : ""}`}
                              onClick={() => {
                                setBdcSalesTrackerEntrySearch((current) => ({ ...current, field: "profile_name" }));
                                trackerEntrySearchInputRef.current?.focus();
                              }}
                            >
                              Customer
                            </button>
                            <button
                              type="button"
                              className={`bdc-sales-entry-grid__header-button ${bdcSalesTrackerEntrySearch.field === "opportunity_id" ? "is-active" : ""}`}
                              onClick={() => {
                                setBdcSalesTrackerEntrySearch((current) => ({ ...current, field: "opportunity_id" }));
                                trackerEntrySearchInputRef.current?.focus();
                              }}
                            >
                              Opp ID
                            </button>
                            <button
                              type="button"
                              className={`bdc-sales-entry-grid__header-button ${bdcSalesTrackerEntrySearch.field === "dms_number" ? "is-active" : ""}`}
                              onClick={() => {
                                setBdcSalesTrackerEntrySearch((current) => ({ ...current, field: "dms_number" }));
                                trackerEntrySearchInputRef.current?.focus();
                              }}
                            >
                              DMS #
                            </button>
                            <button
                              type="button"
                              className={`bdc-sales-entry-grid__header-button ${bdcSalesTrackerEntrySearch.field === "notes" ? "is-active" : ""}`}
                              onClick={() => {
                                setBdcSalesTrackerEntrySearch((current) => ({ ...current, field: "notes" }));
                                trackerEntrySearchInputRef.current?.focus();
                              }}
                            >
                              Working note
                            </button>
                            <span>Status</span>
                            <span>Actions</span>
                          </div>
                          <div className="bdc-sales-entry-list">
                            {selectedTrackerFilteredSaleEntries.length ? (
                              selectedTrackerFilteredSaleEntries.map((entry) => (
                                <div
                                  key={`tracker-entry-${entry.id}`}
                                  className={`bdc-sales-entry bdc-sales-entry-grid ${entry.sold ? "is-sold" : "is-pending"}`}
                                >
                                  <label className="bdc-sales-entry-cell bdc-sales-entry-cell--customer">
                                    <input
                                      value={entry.profile_name}
                                      onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "profile_name", event.target.value)}
                                      placeholder="Customer name"
                                      aria-label={`Customer row ${entry.id}`}
                                    />
                                    {entry.customer_phone ? <small>{entry.customer_phone}</small> : null}
                                  </label>
                                  <label className="bdc-sales-entry-cell">
                                    <input
                                      value={entry.opportunity_id || ""}
                                      onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "opportunity_id", event.target.value)}
                                      placeholder="Opp ID"
                                      aria-label={`Opp ID row ${entry.id}`}
                                    />
                                  </label>
                                  <label className="bdc-sales-entry-cell">
                                    <input
                                      value={entry.dms_number}
                                      onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "dms_number", event.target.value)}
                                      placeholder="DMS No."
                                      aria-label={`DMS number row ${entry.id}`}
                                    />
                                  </label>
                                  <label className="bdc-sales-entry-cell">
                                    <input
                                      value={entry.notes}
                                      onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "notes", event.target.value)}
                                      placeholder="Working note"
                                      aria-label={`Working note row ${entry.id}`}
                                    />
                                  </label>
                                  <div className={`bdc-sales-entry__state ${entry.sold ? "is-sold" : "is-pending"}`}>
                                    <span className={`bdc-sales-entry__badge ${entry.sold ? "is-sold" : ""}`}>
                                      {entry.sold ? "Sold" : "Pending"}
                                    </span>
                                    <small>
                                      {entry.sold && entry.sold_at ? `Reynolds ${dateTimeLabel(entry.sold_at)}` : "Still pending Reynolds"}
                                    </small>
                                  </div>
                                  <div className="bdc-sales-entry__actions">
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() => saveBdcSalesTrackerEntry(entry)}
                                      disabled={busy === `bdc-sales-entry-${entry.id}`}
                                    >
                                      {busy === `bdc-sales-entry-${entry.id}` ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleBdcSalesTrackerEntrySold(entry)}
                                      disabled={busy === `bdc-sales-sold-${entry.id}`}
                                    >
                                      {busy === `bdc-sales-sold-${entry.id}`
                                        ? "Updating..."
                                        : entry.sold
                                          ? "Mark Pending"
                                          : "Mark Sold"}
                                    </button>
                                    <button
                                      type="button"
                                      className="button-danger"
                                      onClick={() => removeBdcSalesTrackerEntry(entry.id)}
                                      disabled={busy === `bdc-sales-delete-${entry.id}`}
                                    >
                                      {busy === `bdc-sales-delete-${entry.id}` ? "Deleting..." : "Delete"}
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="empty">No sale rows match that search yet.</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="empty">No tracked sales rows for {selectedTrackerAgent.agent_name} yet.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="panel">
                    <span className="eyebrow">Waiting on agent selection</span>
                    <h3>Pick a BDC agent in the first tile</h3>
                    <p className="admin-note">
                      Once an agent is selected, this page will narrow to that person’s tracker note, expected sale rows, and
                      actual-sold comparison.
                    </p>
                  </div>
                )}

                {canEditTrackerAdmin ? (
                  <details className="panel bdc-sales-rules-panel bdc-sales-collapsible">
                    <summary className="bdc-sales-collapsible__summary">
                      <div className="bdc-sales-collapsible__copy">
                        <span className="eyebrow">Admin month settings</span>
                        <h3>Goal, benchmarks, and pace rules</h3>
                        <p className="admin-note">
                          Keep this collapsed for agents. Open it when you need to edit the team goal or adjust the benchmark
                          thresholds behind the rate colors.
                        </p>
                      </div>
                      <div className="bdc-sales-insights-panel__summary-chips">
                        <span>{monthLabel(bdcSalesTrackerMonth)}</span>
                        <span>Goal {Math.round(trackerGoalValue || 0)}</span>
                        <span>{trackerDaysWorked} worked / {trackerDaysLeft} left</span>
                        <span>Projected {formatTrackerNumber(trackerProjection)}</span>
                      </div>
                      <span className="bdc-sales-collapsible__toggle">Open settings</span>
                    </summary>
                    <div className="bdc-sales-collapsible__body">
                      <p className="admin-note">
                        Benchmark logic uses the funnel you asked for: leads to appointments set, appointments shown, and
                        appointments sold. Update these thresholds when you want to tighten or loosen the passing range.
                      </p>
                      <div className="bdc-sales-rules-grid">
                        <label>
                          <span>Appt Set Floor %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.appointment_set_rate_floor}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                appointment_set_rate_floor: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Appt Set Target %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.appointment_set_rate_target}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                appointment_set_rate_target: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Show Floor %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.appointment_show_rate_floor}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                appointment_show_rate_floor: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Show Target %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.appointment_show_rate_target}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                appointment_show_rate_target: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Sold from Appts Floor %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_floor}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                sold_from_appointments_rate_floor: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Sold from Appts Target %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_target}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                sold_from_appointments_rate_target: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Sold from Appts Ceiling %</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_ceiling}
                            onChange={(event) =>
                              setBdcSalesTrackerRulesDraft((current) => ({
                                ...current,
                                sold_from_appointments_rate_ceiling: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={saveBdcSalesTrackerRules}
                          disabled={busy === "bdc-sales-rules"}
                        >
                          {busy === "bdc-sales-rules" ? "Saving..." : "Save Rules"}
                        </button>
                      </div>
                    </div>
                  </details>
                ) : null}
                  </>
                ) : null}

                <div className="panel bdc-sales-leaderboard-panel">
                  <div className="bdc-sales-summary-panel__header">
                    <div>
                      <span className="eyebrow">Performance board</span>
                      <h3>Team comparison stays at the bottom</h3>
                      <p className="admin-note">
                        This is the only team-wide section on the page. Everything above stays focused on the selected BDC
                        agent.
                      </p>
                    </div>
                    <div className="bdc-sales-inline-summary">
                      <span>{trackerLeaderboardAgents.length} agents ranked</span>
                      <span>{trackerAgentsMeetingFloor} above all floors</span>
                      <span>{trackerTopCloser ? `${trackerTopCloser.agent_name} leads the month` : "No leader yet"}</span>
                    </div>
                  </div>
                  <div className="bdc-sales-leaderboard">
                    {trackerLeaderboardAgents.length ? (
                      trackerLeaderboardAgents.map((agent, index) => {
                        const pendingCount = trackerPendingSaleEntries(agent.entries || []).length;
                        const pipelineCount = trackerPipelineCount(agent);
                        return (
                          <article key={`tracker-leaderboard-${agent.agent_id}`} className="bdc-sales-leaderboard__row">
                            <div className="bdc-sales-leaderboard__identity">
                              <span className="bdc-sales-leaderboard__rank">#{index + 1}</span>
                              <div>
                                <strong>{agent.agent_name}</strong>
                                <small>
                                  {agent.active ? "Active agent" : "Historical agent"} | {Number(agent.total_leads || 0)} leads |{" "}
                                  {Number(agent.appointments_set || 0)} set | {Number(agent.appointments_shown || 0)} shown
                                </small>
                              </div>
                            </div>
                            <div className="bdc-sales-leaderboard__totals">
                              <span>
                                <b>{Number(agent.actual_sold || 0)}</b>
                                Manual sold
                              </span>
                              <span>
                                <b>{Number(agent.sold_count || 0)}</b>
                                DMS sold
                              </span>
                              <span>
                                <b>{pendingCount}</b>
                                Pending deals
                              </span>
                              <span>
                                <b>{formatPercent(agent.sold_from_shown_rate || 0)}</b>
                                Close
                              </span>
                            </div>
                            <div className="bdc-sales-leaderboard__visuals">
                              <div className="bdc-sales-leaderboard__rail">
                                <div className="bdc-sales-leaderboard__rail-top">
                                  <span>Apt sold vs leader</span>
                                  <strong>{Number(agent.actual_sold || 0)}</strong>
                                </div>
                                <div className="bdc-sales-progress-rail__track">
                                  <div
                                    className="bdc-sales-progress-rail__fill"
                                    style={{
                                      width: `${percentOfTotal(Number(agent.actual_sold || 0), trackerLeaderboardMaxActualSold || 1)}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="bdc-sales-leaderboard__rail">
                                <div className="bdc-sales-leaderboard__rail-top">
                                  <span>DMS pipeline</span>
                                  <strong>{pipelineCount}</strong>
                                </div>
                                <div className="bdc-sales-progress-rail__track">
                                  <div
                                    className="bdc-sales-progress-rail__fill"
                                    style={{
                                      width: `${percentOfTotal(pipelineCount, trackerLeaderboardMaxPipeline || 1)}%`,
                                    }}
                                  />
                                </div>
                                <small>
                                  {Number(agent.sold_count || 0)} DMS sold / {pendingCount} pending deals
                                </small>
                              </div>
                            </div>
                            <div className="bdc-sales-leaderboard__rates">
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                                Set {formatPercent(agent.appointment_set_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                                Show {formatPercent(agent.appointment_show_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                                Sold {formatPercent(agent.actual_sold_rate || 0)}
                              </span>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="empty">No BDC agents are configured yet.</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {false ? (
              <>
                <div className={`panel bdc-sales-workspace-panel ${selectedTrackerAgent ? "is-agent-selected" : "is-team-view"}`}>
                  <div className="bdc-sales-workspace-panel__header">
                    <div>
                      <span className="eyebrow">Agent input workspace</span>
                      <h3>
                        {selectedTrackerAgent
                          ? `${selectedTrackerAgent.agent_name} input first`
                          : "Choose an agent first, then enter notes and DMS tracking"}
                      </h3>
                      <p className="admin-note">
                        This is the clean entry area the BDC agent should live in. Pick the roster view, save the month note,
                        and drop in DMS numbers here before touching the reporting sections below.
                      </p>
                    </div>
                    <div className="bdc-sales-inline-summary">
                      <span>{selectedTrackerFocus?.label || "All Sales People"}</span>
                      <span>{monthLabel(bdcSalesTrackerMonth)}</span>
                      <span>
                        {selectedTrackerFocusNote?.updated_at
                          ? `Saved ${dateTimeLabel(selectedTrackerFocusNote.updated_at)}`
                          : "No saved note yet"}
                      </span>
                    </div>
                  </div>

                  <div className="bdc-sales-workspace-panel__layout">
                    <div className="bdc-sales-workspace-panel__notes">
                      <label>
                        <span>Roster focus</span>
                        <select
                          value={selectedTrackerFocus?.key || "all_sales_people"}
                          onChange={(event) => applyBdcSalesTrackerFocusSelection(event.target.value)}
                        >
                          {trackerFocusOptions.map((option) => (
                            <option key={`tracker-workspace-focus-${option.key}`} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="bdc-sales-workspace-panel__notes-field">
                        <span>Monthly tracking note</span>
                        <textarea
                          value={bdcSalesTrackerFocusNoteDraft}
                          onChange={(event) => setBdcSalesTrackerFocusNoteDraft(event.target.value)}
                          placeholder="Expected sold, active opportunities, and anything still in motion for this month."
                        />
                      </label>
                      <div className="bdc-sales-workspace-panel__actions">
                        <button
                          type="button"
                          onClick={saveBdcSalesTrackerFocusNotes}
                          disabled={busy === "bdc-sales-focus-note"}
                        >
                          {busy === "bdc-sales-focus-note" ? "Saving..." : "Save Tracking Note"}
                        </button>
                      </div>
                    </div>

                    <div className="bdc-sales-workspace-panel__quick-add">
                      <div className="bdc-sales-workspace-panel__quick-head">
                        <div>
                          <span className="eyebrow">Batch DMS entry</span>
                          <h4>{selectedTrackerAgent ? "Add separate tracked deal rows" : "Select an agent to enable DMS entry"}</h4>
                        </div>
                        {selectedTrackerAgent ? (
                          <div className="bdc-sales-workspace-panel__stats">
                            <span>
                              <b>{Number(selectedTrackerAgent.actual_sold || 0)}</b>
                              Apt sold
                            </span>
                            <span>
                              <b>{Number(selectedTrackerAgent.sold_count || 0)}</b>
                              Green
                            </span>
                            <span>
                              <b>{Number(selectedTrackerAgent.entries?.length || 0)}</b>
                              Pending
                            </span>
                            <span>
                              <b>{Number(selectedTrackerAgent.appointments_shown || 0)}</b>
                              Shown
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {selectedTrackerAgent ? (
                        <>
                          <div className="bdc-sales-entry-sheet__chips">
                            <span className={`bdc-sales-entry-sheet__chip ${selectedTrackerDraftDealCount ? "is-ready" : ""}`}>
                              {selectedTrackerDraftDealCount
                                ? `${selectedTrackerDraftDealCount} ${selectedTrackerDraftDealCount === 1 ? "deal" : "deals"} ready`
                                : "Paste one or more DMS numbers"}
                            </span>
                            <span className="bdc-sales-entry-sheet__chip is-pending">
                              New rows start grey until Reynolds confirms them green
                            </span>
                          </div>
                          <div className="bdc-sales-workspace-panel__quick-grid">
                            <label className="bdc-sales-workspace-panel__field bdc-sales-workspace-panel__field--batch">
                              <span>DMS numbers</span>
                              <textarea
                                rows={4}
                                value={selectedTrackerAgentDraft.dms_numbers_text}
                                onChange={(event) =>
                                  patchBdcSalesTrackerEntryDraft(
                                    selectedTrackerAgent.agent_id,
                                    "dms_numbers_text",
                                    event.target.value
                                  )
                                }
                                placeholder={"124913\n124914\n124915"}
                                aria-label={`DMS numbers for ${selectedTrackerAgent.agent_name}`}
                              />
                            </label>
                            <label className="bdc-sales-workspace-panel__field">
                              <span>Profile / customer</span>
                              <input
                                value={selectedTrackerAgentDraft.profile_name}
                                onChange={(event) =>
                                  patchBdcSalesTrackerEntryDraft(
                                    selectedTrackerAgent.agent_id,
                                    "profile_name",
                                    event.target.value
                                  )
                                }
                                placeholder="Optional profile / customer"
                              />
                            </label>
                            <label className="bdc-sales-workspace-panel__field">
                              <span>Working note</span>
                              <input
                                value={selectedTrackerAgentDraft.notes}
                                onChange={(event) =>
                                  patchBdcSalesTrackerEntryDraft(selectedTrackerAgent.agent_id, "notes", event.target.value)
                                }
                                placeholder="Optional working note"
                              />
                            </label>
                            <button
                              type="button"
                              className="bdc-sales-workspace-panel__submit"
                              onClick={() => addBdcSalesTrackerEntry(selectedTrackerAgent)}
                              disabled={busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}`}
                            >
                              {busy === `bdc-sales-create-${selectedTrackerAgent.agent_id}`
                                ? "Adding..."
                                : selectedTrackerDraftDealCount > 1
                                  ? `Add ${selectedTrackerDraftDealCount} Deals`
                                  : selectedTrackerDraftDealCount === 1
                                    ? "Add Deal"
                                    : "Add Row"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="bdc-sales-workspace-panel__empty">
                          Choose Cindy, Kai, or Joanna from roster focus to turn on the agent entry area. All Sales People
                          works best for a shared month note, not for batch DMS input.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <details className="panel bdc-sales-collapsible">
                  <summary className="bdc-sales-collapsible__summary">
                    <div className="bdc-sales-collapsible__copy">
                      <span className="eyebrow">Month analytics</span>
                      <h3>Goal pacing, funnel health, and DMS pipeline</h3>
                      <p className="admin-note">
                        These are supporting analytics. Keep them collapsed when the team is entering data and open them when
                        you want to review the month.
                      </p>
                    </div>
                    <div className="bdc-sales-insights-panel__summary-chips">
                      <span>Goal {Math.round(trackerGoalValue || 0)}</span>
                      <span>Green {trackerConfirmedCount}</span>
                      <span>Projected {formatTrackerNumber(trackerProjection)}</span>
                      <span>{trackerDaysLeft} days left</span>
                    </div>
                    <span className="bdc-sales-collapsible__toggle">Open analytics</span>
                  </summary>
                  <div className="bdc-sales-collapsible__body">
                    <div className="bdc-sales-kpi-grid">
                  <article className="bdc-sales-kpi bdc-sales-kpi--primary bdc-sales-kpi--goal">
                    <div className="bdc-sales-kpi__label">
                      <span>Sold goal widget</span>
                      <small>Goal vs green sold vs projected finish</small>
                    </div>
                    <strong>{Math.round(trackerGoalValue || 0)}</strong>
                    <div className="bdc-sales-goal-bars">
                      <div className="bdc-sales-goal-bars__row">
                        <span>Goal</span>
                        <div className="bdc-sales-goal-bars__track">
                          <div className="bdc-sales-goal-bars__fill is-goal" style={{ width: "100%" }} />
                        </div>
                        <strong>{Math.round(trackerGoalValue || 0)}</strong>
                      </div>
                      <div className="bdc-sales-goal-bars__row">
                        <span>At now</span>
                        <div className="bdc-sales-goal-bars__track">
                          <div
                            className="bdc-sales-goal-bars__fill is-current"
                            style={{ width: `${percentOfTotal(trackerConfirmedCount, trackerGoalValue)}%` }}
                          />
                        </div>
                        <strong>{trackerConfirmedCount}</strong>
                      </div>
                      <div className="bdc-sales-goal-bars__row">
                        <span>Projected</span>
                        <div className="bdc-sales-goal-bars__track">
                          <div
                            className="bdc-sales-goal-bars__fill is-projection"
                            style={{ width: `${percentOfTotal(trackerProjection, trackerGoalValue)}%` }}
                          />
                        </div>
                        <strong>{formatTrackerNumber(trackerProjection)}</strong>
                      </div>
                    </div>
                    <small>
                      Sold apt goal pace is {formatTrackerNumber(bdcSalesTracker?.summary?.daily_goal || 0)} per working day to hit{" "}
                      {Math.round(trackerGoalValue || 0)} sold.
                    </small>
                  </article>
                  <article className="bdc-sales-kpi">
                    <div className="bdc-sales-kpi__label">
                      <span>Month clock</span>
                      <small>How much of this worksheet month is still left</small>
                    </div>
                    <strong>{trackerWorkingDays}</strong>
                    <div className="bdc-sales-kpi__triples">
                      <span>
                        <b>{trackerDaysWorked}</b>
                        Days worked
                      </span>
                      <span>
                        <b>{trackerDaysLeft}</b>
                        Days left
                      </span>
                      <span>
                        <b>{trackerWorkingDays}</b>
                        Working days
                      </span>
                    </div>
                    <small>{monthLabel(bdcSalesTrackerMonth)} resets into a fresh tracker sheet next month.</small>
                  </article>
                  <article className={`bdc-sales-kpi bdc-sales-kpi--funnel ${trackerFunnelNeedsAttention ? "is-warning" : "is-positive"}`}>
                    <div className="bdc-sales-kpi__label">
                      <span>Appointment funnel</span>
                      <small>Leads to set to shown to sold against benchmarks</small>
                    </div>
                    <div className="bdc-sales-funnel-board">
                      <div className="bdc-sales-funnel-board__counts">
                        <span>
                          <b>{bdcSalesTrackerTeamTotals.totalLeads}</b>
                          Leads
                        </span>
                        <span>
                          <b>{bdcSalesTrackerTeamTotals.appointmentsSet}</b>
                          Set
                        </span>
                        <span>
                          <b>{bdcSalesTrackerTeamTotals.appointmentsShown}</b>
                          Shown
                        </span>
                        <span>
                          <b>{bdcSalesTrackerTeamTotals.actualSold}</b>
                          Sold
                        </span>
                      </div>
                      <div className="bdc-sales-funnel-stage-grid">
                        {trackerFunnelScoreboard.map((stage) => (
                          <article
                            key={stage.key}
                            className={`bdc-sales-funnel-stage ${stage.tone}`}
                          >
                            <div className="bdc-sales-funnel-stage__top">
                              <span>{stage.label}</span>
                              <div className="bdc-sales-funnel-stage__percent">{formatPercent(stage.rate || 0)}</div>
                            </div>
                            <div className="bdc-sales-funnel-stage__meta">
                              <span>
                                {stage.numerator} of {stage.denominator || 0}
                              </span>
                              <span>
                                Pass line {formatPercent(stage.floor)} | target {formatPercent(stage.target)}
                              </span>
                            </div>
                            <div className="bdc-sales-funnel-stage__track">
                              <div
                                className={`bdc-sales-funnel-stage__fill ${stage.tone}`}
                                style={{ width: `${percentOfTotal(stage.rate, stage.target || stage.floor || 1)}%` }}
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                    <small>Read this as one scoreboard: leads created, appointments shown, and sold conversion against your benchmark floor.</small>
                  </article>
                  <article className={`bdc-sales-kpi ${trackerBehindByValue >= 0 ? "is-warning" : "is-positive"}`}>
                    <div className="bdc-sales-kpi__label">
                      <span>DMS pipeline</span>
                      <small>Grey means pending. Green means Reynolds confirmed.</small>
                    </div>
                    <strong>{trackerRowsTotal}</strong>
                    <div className="bdc-sales-kpi__stats">
                      <span>Green sold rows {trackerConfirmedCount}</span>
                      <span>Grey pending rows {trackerPendingCount}</span>
                      <span>
                        {trackerBehindByValue >= 0
                          ? `Need ${formatTrackerNumber(trackerBehindByValue)} more green sold to reach today's line`
                          : `Running ${formatTrackerNumber(Math.abs(trackerBehindByValue))} ahead of today's line`}
                      </span>
                    </div>
                  </article>
                    </div>
                  </div>
                </details>

                <div className="panel bdc-sales-leaderboard-panel">
                  <div className="bdc-sales-summary-panel__header">
                    <div>
                      <span className="eyebrow">Performance board</span>
                      <h3>Team leaderboard first, detailed worksheets second</h3>
                      <p className="admin-note">
                        This is the fast read for the month. Open the per-agent worksheet only when you need to update metrics,
                        add DMS rows, or edit notes.
                      </p>
                    </div>
                    <div className="bdc-sales-inline-summary">
                      <span>{trackerLeaderboardAgents.length} agents ranked</span>
                      <span>{trackerAgentsMeetingFloor} above all floors</span>
                      <span>{trackerTopCloser ? `${trackerTopCloser.agent_name} leads the month` : "No leader yet"}</span>
                    </div>
                  </div>
                  <div className="bdc-sales-leaderboard">
                    {trackerLeaderboardAgents.length ? (
                      trackerLeaderboardAgents.map((agent, index) => {
                        const pendingCount = Number(agent.entries?.length || 0);
                        const pipelineCount = Number(agent.sold_count || 0) + pendingCount;
                        return (
                          <article key={`tracker-leaderboard-${agent.agent_id}`} className="bdc-sales-leaderboard__row">
                            <div className="bdc-sales-leaderboard__identity">
                              <span className="bdc-sales-leaderboard__rank">#{index + 1}</span>
                              <div>
                                <strong>{agent.agent_name}</strong>
                                <small>
                                  {agent.active ? "Active agent" : "Historical agent"} | {Number(agent.total_leads || 0)} leads |{" "}
                                  {Number(agent.appointments_set || 0)} set | {Number(agent.appointments_shown || 0)} shown
                                </small>
                              </div>
                            </div>
                            <div className="bdc-sales-leaderboard__totals">
                              <span>
                                <b>{Number(agent.actual_sold || 0)}</b>
                                Apt sold
                              </span>
                              <span>
                                <b>{pendingCount}</b>
                                Pending
                              </span>
                              <span>
                                <b>{formatPercent(agent.sold_from_shown_rate || 0)}</b>
                                Close
                              </span>
                            </div>
                            <div className="bdc-sales-leaderboard__visuals">
                              <div className="bdc-sales-leaderboard__rail">
                                <div className="bdc-sales-leaderboard__rail-top">
                                  <span>Apt sold vs leader</span>
                                  <strong>{Number(agent.actual_sold || 0)}</strong>
                                </div>
                                <div className="bdc-sales-progress-rail__track">
                                  <div
                                    className="bdc-sales-progress-rail__fill"
                                    style={{
                                      width: `${percentOfTotal(
                                        Number(agent.actual_sold || 0),
                                        trackerLeaderboardMaxActualSold || 1
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="bdc-sales-leaderboard__rail">
                                <div className="bdc-sales-leaderboard__rail-top">
                                  <span>DMS pipeline</span>
                                  <strong>{pipelineCount}</strong>
                                </div>
                                <div className="bdc-sales-progress-rail__track">
                                  <div
                                    className="bdc-sales-progress-rail__fill"
                                    style={{
                                      width: `${percentOfTotal(pipelineCount, trackerLeaderboardMaxPipeline || 1)}%`,
                                    }}
                                  />
                                </div>
                                <small>
                                  {Number(agent.sold_count || 0)} green / {pendingCount} pending
                                </small>
                              </div>
                            </div>
                            <div className="bdc-sales-leaderboard__rates">
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                                Set {formatPercent(agent.appointment_set_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                                Show {formatPercent(agent.appointment_show_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                                Sold {formatPercent(agent.actual_sold_rate || 0)}
                              </span>
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="empty">No BDC agents are configured yet.</div>
                    )}
                  </div>
                </div>

                <details className="panel bdc-sales-insights-panel">
                  <summary className="bdc-sales-insights-panel__summary">
                    <div className="bdc-sales-insights-panel__summary-copy">
                      <span className="eyebrow">Collapsible insights</span>
                      <h3>Goal line, raw DMS pipeline, and agent pace</h3>
                      <p className="admin-note">
                        Keep this open when you want context. Collapse it when the team just needs a fast payroll-entry sheet.
                      </p>
                    </div>
                    <div className="bdc-sales-insights-panel__summary-chips">
                      <span>{trackerDaysWorked} worked</span>
                      <span>{trackerDaysLeft} left</span>
                      <span>{formatTrackerNumber(trackerProjection)} projected</span>
                      <span>{formatTrackerNumber(trackerShouldBeAtSold)} should be at</span>
                    </div>
                    <span className="bdc-sales-insights-panel__toggle">More context</span>
                  </summary>
                  <div className="bdc-sales-insights-grid">
                    <article className="bdc-sales-insight-card">
                      <div className="bdc-sales-insight-card__header">
                        <div>
                          <span>Goal line</span>
                          <h4>Confirmed sold vs month target</h4>
                        </div>
                        <strong>{formatTrackerNumber(trackerGoalProgressPercent, 0)}%</strong>
                      </div>
                      <div className="bdc-sales-progress-rail">
                        <div className="bdc-sales-progress-rail__track">
                          <div
                            className="bdc-sales-progress-rail__fill"
                            style={{ width: `${trackerGoalProgressPercent}%` }}
                          />
                          <div
                            className="bdc-sales-progress-rail__marker"
                            style={{ left: `${trackerShouldBeProgressPercent}%` }}
                          />
                        </div>
                        <div className="bdc-sales-progress-rail__meta">
                          <span>Green sold {trackerConfirmedCount}</span>
                          <span>Should be {formatTrackerNumber(trackerShouldBeAtSold)}</span>
                          <span>Goal {Math.round(trackerGoalValue)}</span>
                        </div>
                      </div>
                    </article>

                    <article className="bdc-sales-insight-card">
                      <div className="bdc-sales-insight-card__header">
                        <div>
                          <span>DMS pipeline</span>
                          <h4>Open worksheet rows by status</h4>
                        </div>
                        <strong>{trackerRowsTotal}</strong>
                      </div>
                      <div className="bdc-sales-status-bar">
                        <div
                          className="bdc-sales-status-bar__segment is-sold"
                          style={{ width: `${trackerConfirmedSharePercent}%` }}
                        />
                        <div
                          className="bdc-sales-status-bar__segment is-pending"
                          style={{ width: `${trackerPendingSharePercent}%` }}
                        />
                      </div>
                      <div className="bdc-sales-progress-rail__meta">
                        <span>Green {trackerConfirmedCount}</span>
                        <span>Grey {trackerPendingCount}</span>
                        <span>{bdcSalesTrackerTeamTotals.trackerRows} total rows</span>
                      </div>
                    </article>

                    <article className="bdc-sales-insight-card">
                      <div className="bdc-sales-insight-card__header">
                        <div>
                          <span>Activity mix</span>
                          <h4>Calls, emails, and texts entered this month</h4>
                        </div>
                        <strong>{trackerActivityTotal}</strong>
                      </div>
                      <div className="bdc-sales-insight-bars">
                        {trackerActivityMix.map((item) => (
                          <div key={`tracker-activity-${item.key}`} className="bdc-sales-insight-bars__row">
                            <span>{item.label}</span>
                            <div className="bdc-sales-insight-bars__track">
                              <div
                                className="bdc-sales-insight-bars__fill"
                                style={{ width: `${item.percent}%`, background: item.tone }}
                              />
                            </div>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="bdc-sales-insight-card">
                      <div className="bdc-sales-insight-card__header">
                        <div>
                          <span>Agent pace</span>
                          <h4>Who has the most tracked DMS rows in play</h4>
                        </div>
                        <strong>{trackerTopAgents.length}</strong>
                      </div>
                      <div className="bdc-sales-agent-rankings">
                        {trackerTopAgents.length ? (
                          trackerTopAgents.map((agent) => {
                            const totalTracked = Number(agent.sold_count || 0) + Number(agent.entries?.length || 0);
                            const width = trackerTopAgentMax ? Math.max(10, (totalTracked / trackerTopAgentMax) * 100) : 0;
                            return (
                              <div key={`tracker-top-agent-${agent.agent_id}`} className="bdc-sales-agent-rankings__item">
                                <div className="bdc-sales-agent-rankings__copy">
                                  <strong>{agent.agent_name}</strong>
                                  <small>
                                    {Number(agent.sold_count || 0)} green / {Number(agent.entries?.length || 0)} open /{" "}
                                    {Number(agent.actual_sold || 0)} apt sold
                                  </small>
                                </div>
                                <div className="bdc-sales-agent-rankings__bar">
                                  <div style={{ width: `${width}%` }} />
                                </div>
                                <span>{totalTracked}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="empty">No tracker activity is in the worksheet yet.</div>
                        )}
                      </div>
                    </article>
                  </div>
                </details>

                <details className="panel bdc-sales-summary-panel bdc-sales-collapsible">
                  <summary className="bdc-sales-collapsible__summary">
                    <div className="bdc-sales-collapsible__copy">
                      <span className="eyebrow">Worksheet table</span>
                      <h3>Manual month inputs by BDC agent</h3>
                      <p className="admin-note">
                        Open this only when you need the spreadsheet-style table. The leaderboard above is the default reading
                        surface now.
                      </p>
                    </div>
                    <div className="bdc-sales-insights-panel__summary-chips">
                      <span>Leads {bdcSalesTrackerTeamTotals.totalLeads}</span>
                      <span>Set {bdcSalesTrackerTeamTotals.appointmentsSet}</span>
                      <span>Shown {bdcSalesTrackerTeamTotals.appointmentsShown}</span>
                      <span>Sold {bdcSalesTrackerTeamTotals.actualSold}</span>
                    </div>
                    <span className="bdc-sales-collapsible__toggle">Open table</span>
                  </summary>
                  <div className="bdc-sales-collapsible__body">
                    <div className="table-wrap bdc-sales-summary-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Agent</th>
                            <th>Tracked Sold</th>
                            <th>Tracking</th>
                            <th>Leads</th>
                            <th>Appts Created</th>
                            <th>Appt Set %</th>
                            <th>Appts Shown</th>
                            <th>Show %</th>
                            <th>Apt Sold</th>
                            <th>Sold from Appts %</th>
                            <th>Close from Show %</th>
                            <th>Avg Appts / Day</th>
                            <th>Avg Shown / Day</th>
                            <th>Avg Sold / Day</th>
                            <th>Calls</th>
                            <th>Email</th>
                            <th>Text</th>
                            <th>Avg C / E / T</th>
                            <th>Days Off</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackerAgents.length ? (
                            trackerLeaderboardAgents.map((agent) => (
                              <tr key={`tracker-summary-${agent.agent_id}`}>
                                <td>
                                  <strong>{agent.agent_name}</strong>
                                  <div className="table-subline">{agent.active ? "Active" : "Inactive / historical"}</div>
                                </td>
                                <td>{agent.sold_count}</td>
                                <td>{formatTrackerNumber(agent.tracking_projection)}</td>
                                <td>{Number(agent.total_leads || 0)}</td>
                                <td>{Number(agent.appointments_set || 0)}</td>
                                <td className={`bdc-sales-rate ${trackerBenchmarkTone(agent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                                  {formatPercent(agent.appointment_set_rate || 0)}
                                </td>
                                <td>{Number(agent.appointments_shown || 0)}</td>
                                <td className={`bdc-sales-rate ${trackerBenchmarkTone(agent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                                  {formatPercent(agent.appointment_show_rate || 0)}
                                </td>
                                <td>{Number(agent.actual_sold || 0)}</td>
                                <td className={`bdc-sales-rate ${trackerBenchmarkTone(agent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                                  {formatPercent(agent.actual_sold_rate || 0)}
                                </td>
                                <td>{formatPercent(agent.sold_from_shown_rate || 0)}</td>
                                <td>{formatTrackerNumber(agent.avg_appointments_per_day)}</td>
                                <td>{formatTrackerNumber(agent.avg_shown_per_day)}</td>
                                <td>{formatTrackerNumber(agent.avg_sold_per_day)}</td>
                                <td>{Number(agent.calls_mtd || 0)}</td>
                                <td>{Number(agent.emails_mtd || 0)}</td>
                                <td>{Number(agent.texts_mtd || 0)}</td>
                                <td>{agent.average_activity_label || "0 / 0 / 0"}</td>
                                <td>{Number(agent.days_off || 0)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={19}>No BDC agents are configured yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <small className="admin-note">
                      Green rows are finalized in Reynolds. Neutral rows are still pending or just being tracked.
                    </small>
                  </div>
                </details>

                <div className="bdc-sales-agent-grid">
                  {trackerAgents.length ? (
                    trackerLeaderboardAgents.map((agent) => {
                      const draft = bdcSalesTrackerEntryDrafts[agent.agent_id] || emptyBdcSalesTrackerEntryDraft();
                      const draftDealCount = parseBdcSalesTrackerDraftNumbers(draft.dms_numbers_text).length;
                      const pendingCount = Number(agent.entries?.length || 0);
                      return (
                        <details key={bdcSalesTrackerAgentKey(agent)} className="bdc-sales-agent-card">
                          <summary className="bdc-sales-agent-card__summary">
                            <div className="bdc-sales-agent-card__header">
                              <div>
                                <span className="eyebrow">Agent worksheet</span>
                                <h3>{agent.agent_name}</h3>
                                <p>
                                  {Number(agent.actual_sold || 0)} apt sold / {agent.sold_count} green Reynolds / {pendingCount} grey pending
                                </p>
                              </div>
                              <div className={`bdc-sales-agent-card__status ${agent.active ? "is-active" : "is-inactive"}`}>
                                {agent.active ? "Active" : "Historical"}
                              </div>
                            </div>
                            <div className="bdc-sales-agent-card__summary-grid">
                              <div className="bdc-sales-agent-card__summary-stat">
                                <span>Apt sold</span>
                                <strong>{Number(agent.actual_sold || 0)}</strong>
                              </div>
                              <div className="bdc-sales-agent-card__summary-stat">
                                <span>Green sold</span>
                                <strong>{Number(agent.sold_count || 0)}</strong>
                              </div>
                              <div className="bdc-sales-agent-card__summary-stat">
                                <span>Grey pending</span>
                                <strong>{pendingCount}</strong>
                              </div>
                              <div className="bdc-sales-agent-card__summary-stat">
                                <span>Shown</span>
                                <strong>{Number(agent.appointments_shown || 0)}</strong>
                              </div>
                            </div>
                            <div className="bdc-sales-agent-card__summary-rates">
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                                Set {formatPercent(agent.appointment_set_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                                Show {formatPercent(agent.appointment_show_rate || 0)}
                              </span>
                              <span className={`bdc-sales-rate-pill ${trackerBenchmarkTone(agent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                                Sold {formatPercent(agent.actual_sold_rate || 0)}
                              </span>
                              <span className="bdc-sales-rate-pill is-neutral">
                                Close {formatPercent(agent.sold_from_shown_rate || 0)}
                              </span>
                            </div>
                            <span className="bdc-sales-agent-card__toggle">Open worksheet</span>
                          </summary>

                          <div className="bdc-sales-agent-card__body">
                            {canEditTrackerAdmin ? (
                              <>
                                <div className="bdc-sales-metrics-grid">
                                  <label>
                                    <span>Total Leads</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.total_leads ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "total_leads", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>Appts Created</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.appointments_set ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "appointments_set", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>Appts Shown</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.appointments_shown ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "appointments_shown", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>Apt Sold</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.actual_sold ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "actual_sold", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>MTD Calls</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.calls_mtd ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "calls_mtd", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>MTD Email</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.emails_mtd ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "emails_mtd", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>MTD Text</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.texts_mtd ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "texts_mtd", event.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>Days Off</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="0"
                                      value={agent.days_off ?? ""}
                                      onChange={(event) => patchBdcSalesTrackerAgent(agent.agent_id, "days_off", event.target.value)}
                                    />
                                  </label>
                                  <div className="bdc-sales-metrics-card">
                                    <span>Set / shown / sold</span>
                                    <strong>
                                      {formatPercent(agent.appointment_set_rate || 0)} / {formatPercent(agent.appointment_show_rate || 0)} /{" "}
                                      {formatPercent(agent.actual_sold_rate || 0)}
                                    </strong>
                                    <small>{agent.average_activity_label || "0 / 0 / 0"} calls / email / text</small>
                                  </div>
                                </div>

                                <div className="bdc-sales-agent-card__actions">
                                  <button
                                    type="button"
                                    onClick={() => saveBdcSalesTrackerMetrics(agent)}
                                    disabled={busy === `bdc-sales-metrics-${agent.agent_id}`}
                                  >
                                    {busy === `bdc-sales-metrics-${agent.agent_id}` ? "Saving..." : "Save Admin Metrics"}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="bdc-sales-metrics-grid bdc-sales-metrics-grid--static">
                                <div className="bdc-sales-metrics-card">
                                  <span>Total Leads</span>
                                  <strong>{Number(agent.total_leads || 0)}</strong>
                                  <small>Manual admin report input</small>
                                </div>
                                <div className="bdc-sales-metrics-card">
                                  <span>Appts Created</span>
                                  <strong>{Number(agent.appointments_set || 0)}</strong>
                                  <small className={`bdc-sales-rate ${trackerBenchmarkTone(agent.appointment_set_rate, trackerBenchmarks.appointment_set_rate_floor)}`}>
                                    {formatPercent(agent.appointment_set_rate || 0)} of leads
                                  </small>
                                </div>
                                <div className="bdc-sales-metrics-card">
                                  <span>Appts Shown</span>
                                  <strong>{Number(agent.appointments_shown || 0)}</strong>
                                  <small className={`bdc-sales-rate ${trackerBenchmarkTone(agent.appointment_show_rate, trackerBenchmarks.appointment_show_rate_floor)}`}>
                                    {formatPercent(agent.appointment_show_rate || 0)} of set appointments
                                  </small>
                                </div>
                                <div className="bdc-sales-metrics-card">
                                  <span>Apt Sold</span>
                                  <strong>{Number(agent.actual_sold || 0)}</strong>
                                  <small className={`bdc-sales-rate ${trackerBenchmarkTone(agent.actual_sold_rate, trackerBenchmarks.sold_from_appointments_rate_floor)}`}>
                                    {formatPercent(agent.actual_sold_rate || 0)} sold from appointments set
                                  </small>
                                </div>
                                <div className="bdc-sales-metrics-card">
                                  <span>MTD Activity</span>
                                  <strong>{agent.average_activity_label || "0 / 0 / 0"}</strong>
                                  <small>Calls / email / text with {Number(agent.days_off || 0)} day(s) off</small>
                                </div>
                              </div>
                            )}

                            <div className="bdc-sales-entry-sheet">
                              <div className="bdc-sales-entry-sheet__intro">
                                <strong>DMS sales tracker</strong>
                                <small>
                                  Paste one or many DMS numbers. Every DMS number becomes its own tracked deal row. Optional
                                  profile and note will stamp onto each row you create.
                                </small>
                                <div className="bdc-sales-entry-sheet__chips">
                                  <span className={`bdc-sales-entry-sheet__chip ${draftDealCount ? "is-ready" : ""}`}>
                                    {draftDealCount
                                      ? `${draftDealCount} separate ${draftDealCount === 1 ? "deal" : "deals"} ready`
                                      : "Paste DMS numbers to stage separate deal rows"}
                                  </span>
                                  <span className="bdc-sales-entry-sheet__chip is-pending">
                                    New rows start grey until Reynolds confirms them green
                                  </span>
                                </div>
                              </div>
                              <div className="bdc-sales-entry-grid bdc-sales-entry-grid--header bdc-sales-entry-grid--create">
                                <span>DMS numbers</span>
                                <span>Profile / customer</span>
                                <span>Working note</span>
                                <span>Action</span>
                              </div>
                              <div className="bdc-sales-entry-create bdc-sales-entry-grid bdc-sales-entry-grid--create">
                                <label className="bdc-sales-entry-cell bdc-sales-entry-cell--batch">
                                  <textarea
                                    rows={2}
                                    value={draft.dms_numbers_text}
                                    onChange={(event) =>
                                      patchBdcSalesTrackerEntryDraft(agent.agent_id, "dms_numbers_text", event.target.value)
                                    }
                                    placeholder={"124913\n124914\n124915"}
                                    aria-label={`DMS numbers for ${agent.agent_name}`}
                                  />
                                </label>
                                <label className="bdc-sales-entry-cell">
                                  <input
                                    value={draft.profile_name}
                                    onChange={(event) => patchBdcSalesTrackerEntryDraft(agent.agent_id, "profile_name", event.target.value)}
                                    placeholder="Optional profile / customer"
                                    aria-label={`Profile name for ${agent.agent_name}`}
                                  />
                                </label>
                                <label className="bdc-sales-entry-cell">
                                  <input
                                    value={draft.notes}
                                    onChange={(event) => patchBdcSalesTrackerEntryDraft(agent.agent_id, "notes", event.target.value)}
                                    placeholder="Optional working note"
                                    aria-label={`Working note for ${agent.agent_name}`}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => addBdcSalesTrackerEntry(agent)}
                                  disabled={busy === `bdc-sales-create-${agent.agent_id}`}
                                >
                                  {busy === `bdc-sales-create-${agent.agent_id}`
                                    ? "Adding..."
                                    : draftDealCount > 1
                                      ? `Add ${draftDealCount} Deals`
                                      : draftDealCount === 1
                                        ? "Add Deal"
                                        : "Add Row"}
                                </button>
                              </div>

                              {agent.entries.length ? (
                                <>
                                  <div className="bdc-sales-entry-grid bdc-sales-entry-grid--header">
                                    <span>DMS #</span>
                                    <span>Profile / customer</span>
                                    <span>Working note</span>
                                    <span>Status</span>
                                    <span>Actions</span>
                                  </div>
                                  <div className="bdc-sales-entry-list">
                                    {agent.entries.map((entry) => (
                                      <div
                                        key={`tracker-entry-${entry.id}`}
                                        className={`bdc-sales-entry bdc-sales-entry-grid ${entry.sold ? "is-sold" : "is-pending"}`}
                                      >
                                        <label className="bdc-sales-entry-cell">
                                          <input
                                            value={entry.dms_number}
                                            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "dms_number", event.target.value)}
                                            placeholder="DMS number"
                                            aria-label={`DMS number row ${entry.id}`}
                                          />
                                        </label>
                                        <label className="bdc-sales-entry-cell">
                                          <input
                                            value={entry.profile_name}
                                            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "profile_name", event.target.value)}
                                            placeholder="Optional profile / customer"
                                            aria-label={`Profile name row ${entry.id}`}
                                          />
                                        </label>
                                        <label className="bdc-sales-entry-cell">
                                          <input
                                            value={entry.notes}
                                            onChange={(event) => patchBdcSalesTrackerEntry(entry.id, "notes", event.target.value)}
                                            placeholder="Working note"
                                            aria-label={`Working note row ${entry.id}`}
                                          />
                                        </label>
                                        <div className={`bdc-sales-entry__state ${entry.sold ? "is-sold" : "is-pending"}`}>
                                          <span className={`bdc-sales-entry__badge ${entry.sold ? "is-sold" : ""}`}>
                                            {entry.sold ? "Sold" : "Pending"}
                                          </span>
                                          <small>
                                            {entry.sold && entry.sold_at ? `Reynolds ${dateTimeLabel(entry.sold_at)}` : "Still pending Reynolds"}
                                          </small>
                                        </div>
                                        <div className="bdc-sales-entry__actions">
                                          <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => saveBdcSalesTrackerEntry(entry)}
                                            disabled={busy === `bdc-sales-entry-${entry.id}`}
                                          >
                                            {busy === `bdc-sales-entry-${entry.id}` ? "Saving..." : "Save"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => toggleBdcSalesTrackerEntrySold(entry)}
                                            disabled={busy === `bdc-sales-sold-${entry.id}`}
                                          >
                                            {busy === `bdc-sales-sold-${entry.id}`
                                              ? "Updating..."
                                              : entry.sold
                                                ? "Mark Pending"
                                                : "Mark Sold"}
                                          </button>
                                          <button
                                            type="button"
                                            className="button-danger"
                                            onClick={() => removeBdcSalesTrackerEntry(entry.id)}
                                            disabled={busy === `bdc-sales-delete-${entry.id}`}
                                          >
                                            {busy === `bdc-sales-delete-${entry.id}` ? "Deleting..." : "Delete"}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="empty">No tracked sales rows for {agent.agent_name} yet.</div>
                              )}
                            </div>
                          </div>
                        </details>
                      );
                    })
                  ) : (
                    <div className="panel">
                      <span className="eyebrow">No BDC agents</span>
                      <h3>Add your BDC roster first</h3>
                      <p className="admin-note">The tracker uses the BDC agents list from the existing BDC setup.</p>
                    </div>
                  )}
                </div>

                <details className="panel bdc-sales-rules-panel bdc-sales-collapsible">
                  <summary className="bdc-sales-collapsible__summary">
                    <div className="bdc-sales-collapsible__copy">
                      <span className="eyebrow">Pinned rules</span>
                      <h3>Admin benchmark rules for appointment pacing</h3>
                      <p className="admin-note">
                        Collapse this most of the time. Open it when you need to tune the floors and targets that color the
                        tracker.
                      </p>
                    </div>
                    <div className="bdc-sales-insights-panel__summary-chips">
                      <span>{monthLabel(bdcSalesTrackerMonth)}</span>
                      <span>{canEditTrackerAdmin ? "Admin editing unlocked" : "View only"}</span>
                      <span>Set floor {bdcSalesTrackerRulesDraft.appointment_set_rate_floor || 0}%</span>
                      <span>Show floor {bdcSalesTrackerRulesDraft.appointment_show_rate_floor || 0}%</span>
                    </div>
                    <span className="bdc-sales-collapsible__toggle">Open rules</span>
                  </summary>
                  <div className="bdc-sales-collapsible__body">
                    <p className="admin-note">
                      Benchmark logic uses the funnel you asked for: leads to appointments set, appointments shown, and
                      appointments sold. Update these thresholds any time you want to tighten or loosen the passing range.
                    </p>
                    <div className="bdc-sales-rules-grid">
                    <label>
                      <span>Appt Set Floor %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.appointment_set_rate_floor}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            appointment_set_rate_floor: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Appt Set Target %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.appointment_set_rate_target}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            appointment_set_rate_target: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Show Floor %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.appointment_show_rate_floor}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            appointment_show_rate_floor: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Show Target %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.appointment_show_rate_target}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            appointment_show_rate_target: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Sold from Appts Floor %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_floor}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            sold_from_appointments_rate_floor: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Sold from Appts Target %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_target}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            sold_from_appointments_rate_target: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                    <label>
                      <span>Sold from Appts Ceiling %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        value={bdcSalesTrackerRulesDraft.sold_from_appointments_rate_ceiling}
                        onChange={(event) =>
                          setBdcSalesTrackerRulesDraft((current) => ({
                            ...current,
                            sold_from_appointments_rate_ceiling: event.target.value,
                          }))
                        }
                        disabled={!canEditTrackerAdmin}
                      />
                    </label>
                      <button
                        type="button"
                        onClick={saveBdcSalesTrackerRules}
                        disabled={!canEditTrackerAdmin || busy === "bdc-sales-rules"}
                      >
                        {busy === "bdc-sales-rules" ? "Saving..." : canEditTrackerAdmin ? "Save Rules" : "Admin Only"}
                      </button>
                    </div>
                  </div>
                </details>
              </>
            ) : null}

            {bdcSalesTrackerView === "dmsLog" ? (
              <>
                <div className="panel bdc-sales-summary-panel">
                  <div className="bdc-sales-summary-panel__header">
                    <div>
                      <span className="eyebrow">Admin Reynolds log</span>
                      <h3>DMS sold entry and dated history</h3>
                    </div>
                    <div className="bdc-sales-inline-summary bdc-sales-inline-summary--soft">
                      <span>Current {trackerDmsLog.current_entries.length}</span>
                      <span>Logged {trackerDmsLog.log_entries.length}</span>
                      <span>{monthLabel(bdcSalesTrackerMonth)}</span>
                    </div>
                  </div>
                  <p className="admin-note">
                    Use this admin-only log for Reynolds-confirmed deals. Marking a row sold pushes it into the selected
                    agent's read-only DMS sold section on the tracker.
                  </p>
                </div>

                <div className="bdc-dms-log-layout">
                  {trackerShowHistoricalBulkUpload ? (
                    <article className="panel bdc-dms-log-panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Historical input</span>
                          <h3>Bulk upload DMS sold rows</h3>
                        </div>
                        <div className="bdc-sales-inline-summary bdc-sales-inline-summary--soft">
                          <span>{trackerDmsBulkDraftNumbers.length} ready</span>
                          <span>{bdcSalesTrackerDmsBulkDraft.apt_set_under || "Pick agent"}</span>
                        </div>
                      </div>
                      <p className="admin-note">
                        Paste raw DMS numbers from older payroll review. These rows will save with
                        {" "}
                        <strong>{TRACKER_HISTORICAL_INPUT_LABEL}</strong>
                        {" "}
                        for the customer name and Opp ID, then stay assigned to the BDC agent you pick here.
                      </p>
                      <div className="bdc-dms-log-bulk">
                        <label className="bdc-dms-log-bulk__field bdc-dms-log-bulk__field--wide">
                          <span>DMS numbers</span>
                          <textarea
                            rows={5}
                            value={bdcSalesTrackerDmsBulkDraft.dms_numbers_text}
                            onChange={(event) =>
                              setBdcSalesTrackerDmsBulkDraft((current) => ({
                                ...current,
                                dms_numbers_text: event.target.value,
                              }))
                            }
                            placeholder={"125062\n125063\n125064"}
                          />
                        </label>
                        <div className="bdc-dms-log-bulk__field">
                          <span>Apt Set Under</span>
                          <div className="bdc-dms-log-bulk__toggle" role="group" aria-label="Bulk historical input agent">
                            {trackerBulkAptSetUnderOptions.map((optionName) => {
                              const isActive =
                                normalizeLookupText(optionName) === normalizeLookupText(bdcSalesTrackerDmsBulkDraft.apt_set_under);
                              return (
                                <button
                                  key={`tracker-bulk-apt-${normalizeLookupText(optionName)}`}
                                  type="button"
                                  className={isActive ? "is-active" : ""}
                                  onClick={() =>
                                    setBdcSalesTrackerDmsBulkDraft((current) => ({
                                      ...current,
                                      apt_set_under: optionName,
                                    }))
                                  }
                                  aria-pressed={isActive}
                                >
                                  {optionName}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <label className="bdc-dms-log-bulk__field">
                          <span>Optional note</span>
                          <input
                            value={bdcSalesTrackerDmsBulkDraft.notes}
                            onChange={(event) =>
                              setBdcSalesTrackerDmsBulkDraft((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            placeholder="Month-end cleanup, backfilled after Reynolds review, etc."
                          />
                        </label>
                        <button
                          type="button"
                          onClick={addBdcSalesTrackerDmsLogBulkEntries}
                          disabled={busy === "bdc-dms-bulk-create" || !trackerDmsBulkDraftNumbers.length || !trackerCanViewDmsLog}
                        >
                          {busy === "bdc-dms-bulk-create"
                            ? "Uploading..."
                            : trackerDmsBulkDraftNumbers.length
                              ? `Add ${trackerDmsBulkDraftNumbers.length} Historical ${trackerDmsBulkDraftNumbers.length === 1 ? "Row" : "Rows"}`
                              : "Add Historical Rows"}
                        </button>
                        <div className="bdc-dms-log-bulk__summary" aria-live="polite">
                          <div className="bdc-dms-log-create__parsed-field">
                            <span>Customer name</span>
                            <strong>{TRACKER_HISTORICAL_INPUT_LABEL}</strong>
                          </div>
                          <div className="bdc-dms-log-create__parsed-field">
                            <span>Opp ID</span>
                            <strong>{TRACKER_HISTORICAL_INPUT_LABEL}</strong>
                          </div>
                          <div className="bdc-dms-log-create__parsed-field">
                            <span>DMS ready</span>
                            <strong>
                              {trackerDmsBulkDraftNumbers.length
                                ? `${trackerDmsBulkDraftNumbers.length} unique DMS numbers`
                                : "Paste one or many DMS numbers"}
                            </strong>
                          </div>
                        </div>
                        {bdcSalesTrackerDmsBulkFeedback ? (
                          <p className="admin-note bdc-dms-log-bulk__feedback">{bdcSalesTrackerDmsBulkFeedback}</p>
                        ) : null}
                      </div>
                    </article>
                  ) : null}
                  <article className="panel bdc-dms-log-panel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Quick add</span>
                        <h3>Log customer / opp id / DMS no</h3>
                      </div>
                    </div>
                    <div className="bdc-dms-log-create">
                      <label>
                        <span>Paste full line</span>
                        <textarea
                          rows={2}
                          value={bdcSalesTrackerDmsLogDraft.customer_name}
                          onChange={(event) =>
                            setBdcSalesTrackerDmsLogDraft((current) => ({ ...current, customer_name: event.target.value }))
                          }
                          placeholder="Valentina Alvarado / Opp ID 5595489 / DMS No. 125062"
                        />
                      </label>
                      <label>
                        <span>Apt Set Under</span>
                        <input
                          list="tracker-apt-set-under"
                          value={bdcSalesTrackerDmsLogDraft.apt_set_under}
                          onChange={(event) =>
                            setBdcSalesTrackerDmsLogDraft((current) => ({ ...current, apt_set_under: event.target.value }))
                          }
                          placeholder="Start typing a roster name"
                          autoComplete="off"
                        />
                      </label>
                      <label className="bdc-dms-log-create__notes">
                        <span>Optional note</span>
                        <input
                          value={bdcSalesTrackerDmsLogDraft.notes}
                          onChange={(event) =>
                            setBdcSalesTrackerDmsLogDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          placeholder=""
                        />
                      </label>
                      <button type="button" onClick={addBdcSalesTrackerDmsLogEntry} disabled={busy === "bdc-dms-create"}>
                        {busy === "bdc-dms-create" ? "Logging..." : "Add To Log"}
                      </button>
                      <div className="bdc-dms-log-create__parsed" aria-live="polite">
                        <div className="bdc-dms-log-create__parsed-field">
                          <span>Customer name</span>
                          <strong>{trackerDmsLogDraftPreview.customer_name || "Will fill from the pasted line"}</strong>
                        </div>
                        <div className="bdc-dms-log-create__parsed-field">
                          <span>Opp ID</span>
                          <strong>{trackerDmsLogDraftPreview.opportunity_id || "Will fill from the pasted line"}</strong>
                        </div>
                        <div className="bdc-dms-log-create__parsed-field">
                          <span>DMS No</span>
                          <strong>{trackerDmsLogDraftPreview.dms_number || "Will fill from the pasted line"}</strong>
                        </div>
                      </div>
                    </div>
                    <datalist id="tracker-apt-set-under">
                      {trackerAptSetUnderOptions.map((option) => (
                        <option key={`tracker-apt-option-${normalizeLookupText(option.name)}-${option.source}`} value={option.name}>
                          {option.source}
                        </option>
                      ))}
                    </datalist>

                    <div className="bdc-dms-log-list">
                      {trackerDmsLog.current_entries.length ? (
                        trackerDmsLog.current_entries.map((entry) => (
                          <div key={`dms-current-${entry.id}`} className="bdc-dms-log-entry">
                            <label>
                              <span>Customer Name</span>
                              <input
                                value={entry.customer_name}
                                onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "customer_name", event.target.value)}
                              />
                            </label>
                            <label>
                              <span>Opp ID</span>
                              <input
                                value={entry.opportunity_id || ""}
                                onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "opportunity_id", event.target.value)}
                              />
                            </label>
                            <label>
                              <span>DMS No</span>
                              <input
                                value={entry.dms_number || ""}
                                onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "dms_number", event.target.value)}
                              />
                            </label>
                            <label>
                              <span>Apt Set Under</span>
                              <input
                                list="tracker-apt-set-under"
                                value={entry.apt_set_under}
                                onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "apt_set_under", event.target.value)}
                                autoComplete="off"
                              />
                            </label>
                            <label className="bdc-dms-log-entry__notes">
                              <span>Notes</span>
                              <input
                                value={entry.notes || ""}
                                onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "notes", event.target.value)}
                              />
                            </label>
                            <div className="bdc-dms-log-entry__actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => saveBdcSalesTrackerDmsLogEntry(entry, false, "")}
                                disabled={busy === `bdc-dms-save-${entry.id}`}
                              >
                                {busy === `bdc-dms-save-${entry.id}` ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => saveBdcSalesTrackerDmsLogEntry(entry, true, "")}
                                disabled={busy === `bdc-dms-save-${entry.id}`}
                              >
                                {busy === `bdc-dms-save-${entry.id}` ? "Moving..." : "Log It"}
                              </button>
                              <button
                                type="button"
                                className="button-danger"
                                onClick={() => removeBdcSalesTrackerDmsLogEntry(entry.id)}
                                disabled={busy === `bdc-dms-delete-${entry.id}`}
                              >
                                {busy === `bdc-dms-delete-${entry.id}` ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty">No current queue rows. New entries now log immediately.</div>
                      )}
                    </div>
                  </article>

                  <article className="panel bdc-dms-log-panel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Dated history</span>
                        <h3>Logged DMS history for {monthLabel(bdcSalesTrackerMonth)}</h3>
                      </div>
                    </div>
                    <div className="bdc-dms-log-list">
                      {trackerDmsLog.log_entries.length ? (
                        <>
                          <div className="bdc-dms-log-history-row bdc-dms-log-history-row--header">
                            <span>Timestamp</span>
                            <span>Customer</span>
                            <span>Opp ID</span>
                            <span>DMS No</span>
                            <span>Apt Set Under</span>
                            <span>Notes</span>
                            <span>Actions</span>
                          </div>
                          {trackerDmsLog.log_entries.map((entry) => (
                            <div key={`dms-log-${entry.id}`} className={`bdc-dms-log-history-row${entry.sold ? " is-sold" : ""}`}>
                              <div className="bdc-dms-log-history-row__cell bdc-dms-log-history-row__timestamp" data-label="Timestamp">
                                <strong>{dateTimeLabel(entry.logged_at)}</strong>
                                <span className={`bdc-dms-log-history-row__status${entry.sold ? " is-sold" : ""}`}>
                                  {entry.sold ? `Sold to tracker${entry.sold_at ? ` ${dateTimeLabel(entry.sold_at)}` : ""}` : "Logged only"}
                                </span>
                              </div>
                              <label className="bdc-dms-log-history-row__cell" data-label="Customer">
                                <input
                                  value={entry.customer_name}
                                  onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "customer_name", event.target.value)}
                                  placeholder="Customer"
                                  aria-label={`Customer name row ${entry.id}`}
                                />
                              </label>
                              <label className="bdc-dms-log-history-row__cell" data-label="Opp ID">
                                <input
                                  value={entry.opportunity_id || ""}
                                  onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "opportunity_id", event.target.value)}
                                  placeholder="Opp ID"
                                  aria-label={`Opportunity row ${entry.id}`}
                                />
                              </label>
                              <label className="bdc-dms-log-history-row__cell" data-label="DMS No">
                                <input
                                  value={entry.dms_number || ""}
                                  onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "dms_number", event.target.value)}
                                  placeholder="DMS No"
                                  aria-label={`Dms row ${entry.id}`}
                                />
                              </label>
                              <label className="bdc-dms-log-history-row__cell" data-label="Apt Set Under">
                                <input
                                  list="tracker-apt-set-under"
                                  value={entry.apt_set_under}
                                  onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "apt_set_under", event.target.value)}
                                  placeholder="Apt Set Under"
                                  aria-label={`Apt set under row ${entry.id}`}
                                  autoComplete="off"
                                />
                              </label>
                              <label className="bdc-dms-log-history-row__cell" data-label="Notes">
                                <input
                                  value={entry.notes || ""}
                                  onChange={(event) => patchBdcSalesTrackerDmsLogEntry(entry.id, "notes", event.target.value)}
                                  placeholder=""
                                  aria-label={`Notes row ${entry.id}`}
                                />
                              </label>
                              <div className="bdc-dms-log-history-row__actions" data-label="Actions">
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => saveBdcSalesTrackerDmsLogEntry(entry, true, entry.logged_at)}
                                  disabled={busy === `bdc-dms-save-${entry.id}`}
                                >
                                  {busy === `bdc-dms-save-${entry.id}` ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className={entry.sold ? "secondary bdc-dms-log-history-row__sold-button is-sold" : "bdc-dms-log-history-row__sold-button"}
                                  onClick={() => markBdcSalesTrackerDmsLogAsSold(entry.id)}
                                  disabled={busy === `bdc-dms-sold-${entry.id}` || entry.sold}
                                >
                                  {busy === `bdc-dms-sold-${entry.id}` ? "Sending..." : entry.sold ? "Tracker Updated" : "Mark Sold"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveBdcSalesTrackerDmsLogEntry(entry, false, "")}
                                  disabled={busy === `bdc-dms-save-${entry.id}` || entry.sold}
                                >
                                  {busy === `bdc-dms-save-${entry.id}` ? "Moving..." : "Move Back"}
                                </button>
                                <button
                                  type="button"
                                  className="button-danger"
                                  onClick={() => removeBdcSalesTrackerDmsLogEntry(entry.id)}
                                  disabled={busy === `bdc-dms-delete-${entry.id}`}
                                >
                                  {busy === `bdc-dms-delete-${entry.id}` ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="empty">No logged DMS rows for this month yet.</div>
                      )}
                    </div>
                  </article>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {tab === "salesAnalytics" ? (
          <SalesAnalyticsSection
            assetUrl={assetUrl}
            dashboard={salesAnalyticsDashboard}
            feedback={salesAnalyticsFeedback}
            loading={salesAnalyticsLoading}
            onSelectVariant={(nextVariant) => {
              setError("");
              setSalesAnalyticsFeedback("");
              setSalesAnalyticsVariant(nextVariant);
            }}
            onRefresh={() => {
              setError("");
              setSalesAnalyticsFeedback("");
              refreshSalesAnalyticsDashboard({ variant: salesAnalyticsVariant }).catch((errorValue) =>
                setError(errText(errorValue))
              );
            }}
            onRun={() => triggerSalesAnalyticsDashboardRun(salesAnalyticsVariant)}
            running={
              busy === `sales-analytics-run:${salesAnalyticsVariant}` ||
              String(salesAnalyticsDashboard?.status?.state || "").toLowerCase() === "running"
            }
            selectedVariant={salesAnalyticsVariant}
            variants={SALES_ANALYTICS_VARIANTS}
          />
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
                  Built for service-to-sales follow-up. Read the month by day, weekday, mileage, vehicle age, and owner
                  load so the team can see where the strongest upgrade conversations sit.
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
                  <span>Busiest Day</span>
                  <TrafficAnalysisHint text="The highest-volume traffic day in the selected month, based on imported and manually added rows." />
                </div>
                <strong>{trafficAnalysis.busiestDay ? trafficAnalysis.busiestDay.count : 0}</strong>
                <small>
                  {trafficAnalysis.busiestDay
                    ? `${trafficAnalysis.busiestDay.weekdayLong} ${dateParts(trafficAnalysis.busiestDay.date).monthShort} ${dateParts(trafficAnalysis.busiestDay.date).dayNumber}`
                    : "No traffic yet"}
                </small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Avg Odometer</span>
                  <TrafficAnalysisHint text="Average mileage across rows where odometer data was imported from the service-drive source." />
                </div>
                <strong>{trafficAnalysis.avgOdometer ? formatWholeNumber(trafficAnalysis.avgOdometer) : "n/a"}</strong>
                <small>
                  {trafficAnalysis.medianOdometer ? `Median ${formatWholeNumber(trafficAnalysis.medianOdometer)} miles` : "Mileage is sparse this month"}
                </small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Avg Vehicle Age</span>
                  <TrafficAnalysisHint text="Average model-year age across rows where the imported vehicle year was available." />
                </div>
                <strong>{trafficAnalysis.avgVehicleAge ? trafficAnalysis.avgVehicleAge.toFixed(1) : "n/a"}</strong>
                <small>
                  {trafficAnalysis.medianVehicleAge ? `Median ${trafficAnalysis.medianVehicleAge.toFixed(1)} yrs` : "Model-year data is sparse this month"}
                </small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Trade-Cycle Now</span>
                  <TrafficAnalysisHint text="Rows already in the likely upgrade cycle using a simple rule: 60k+ miles or 5+ model years old." />
                </div>
                <strong>{trafficAnalysis.tradeCycleCount}</strong>
                <small>{percentOfTotal(trafficAnalysis.tradeCycleCount, trafficAnalysis.totalRows).toFixed(0)}% of visible month traffic</small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>Open Upgrade Rows</span>
                  <TrafficAnalysisHint text="Trade-cycle customers that still do not have a saved salesperson note." />
                </div>
                <strong>{trafficAnalysis.openTradeCycleCount}</strong>
                <small>{trafficAnalysis.pendingCount} total rows still missing salesperson notes</small>
              </article>
              <article className="traffic-analysis-stat">
                <div className="traffic-analysis-stat__label">
                  <span>100k+ Mileage</span>
                  <TrafficAnalysisHint text="High-mileage service visits that usually carry stronger replacement urgency." />
                </div>
                <strong>{trafficAnalysis.highMileageCount}</strong>
                <small>{trafficAnalysis.olderVehicleCount} rows are 9+ model years old</small>
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
                        title={`${longDateLabel(item.date)}: ${item.count} traffic row${item.count === 1 ? "" : "s"} with ${item.noteCoverage}% note coverage`}
                      >
                        <div className="traffic-analysis-bars__label">
                          <strong>{item.weekdayShort}</strong>
                          <small>
                            {dateParts(item.date).monthShort} {dateParts(item.date).dayNumber}
                          </small>
                        </div>
                        <div className="traffic-analysis-bars__track">
                          <div
                            className="traffic-analysis-bars__fill"
                            style={{ width: `${Math.max(10, Math.round((item.count / trafficAnalysisMaxDayCount) * 100))}%` }}
                          />
                        </div>
                        <div className="traffic-analysis-bars__metric">
                          <strong>{item.count}</strong>
                          <small>{item.noteCoverage}% notes</small>
                        </div>
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
                className="traffic-analysis-panel traffic-analysis-panel--wide"
                eyebrow="Service-to-sales lens"
                title="Opportunity buckets for upgrade conversations"
                summary={`${trafficAnalysis.tradeCycleCount} trade-cycle rows in ${monthLabel(trafficAnalysisData.month || trafficMonth)}`}
                hint="These are working heuristics for service-to-sales. They do not guarantee a sale, but they surface where the month likely deserves more sales attention."
                defaultOpen
              >
                <div className="traffic-analysis-opportunity-grid">
                  {trafficAnalysis.opportunityCards.map((item) => (
                    <article
                      key={item.key}
                      className={`traffic-analysis-opportunity-card traffic-analysis-opportunity-card--${item.tone}`}
                    >
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                      <small>{item.share}% of visible traffic</small>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
                <div className="traffic-analysis-two-column">
                  <div className="traffic-analysis-subpanel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Vehicle mix</span>
                        <h4>Top models in service this month</h4>
                      </div>
                    </div>
                    {trafficAnalysis.topModels.length ? (
                      <div className="traffic-analysis-list">
                        {trafficAnalysis.topModels.map((item) => (
                          <div key={item.label} className="traffic-analysis-list__item">
                            <div>
                              <strong>{item.label}</strong>
                              <small>Most common service-drive vehicle family</small>
                            </div>
                            <b>{item.count}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty">Model data has not populated yet for this month.</div>
                    )}
                  </div>
                  <div className="traffic-analysis-subpanel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Imported pipeline</span>
                        <h4>Source and status mix</h4>
                      </div>
                    </div>
                    <div className="traffic-analysis-list">
                      {trafficAnalysis.sources.map((item) => (
                        <div key={`source-${item.label}`} className="traffic-analysis-list__item">
                          <div>
                            <strong>{item.label}</strong>
                            <small>Traffic source rows in scope</small>
                          </div>
                          <b>{item.count}</b>
                        </div>
                      ))}
                      {trafficAnalysis.statuses.map((item) => (
                        <div key={`status-${item.label}`} className="traffic-analysis-list__item">
                          <div>
                            <strong>{item.label}</strong>
                            <small>Imported status signal</small>
                          </div>
                          <b>{item.count}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TrafficAnalysisSection>

              <TrafficAnalysisSection
                className="traffic-analysis-panel traffic-analysis-panel--wide"
                eyebrow="Vehicle profile"
                title="Mileage and vehicle-age spread"
                summary={`${trafficAnalysis.odometerBands.reduce((sum, item) => sum + item.count, 0)} rows with mileage / ${trafficAnalysis.vehicleAgeBands.reduce((sum, item) => sum + item.count, 0)} rows with model year`}
                hint="This is the cleanest service-to-sales view of the cars in lane right now: how many are high mileage, how many are older, and where the month clusters."
              >
                <div className="traffic-analysis-two-column">
                  <div className="traffic-analysis-subpanel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Odometer bands</span>
                        <h4>How deep the mileage sits</h4>
                      </div>
                      <small>
                        {trafficAnalysis.avgOdometer ? `Avg ${formatWholeNumber(trafficAnalysis.avgOdometer)} miles` : "No mileage average yet"}
                      </small>
                    </div>
                    <div className="traffic-analysis-bars">
                      {trafficAnalysis.odometerBands.map((item) => (
                        <div key={item.key} className="traffic-analysis-bars__item">
                          <div className="traffic-analysis-bars__label">
                            <strong>{item.label}</strong>
                            <small>{item.share}% of rows with mileage</small>
                          </div>
                          <div className="traffic-analysis-bars__track">
                            <div
                              className="traffic-analysis-bars__fill"
                              style={{ width: `${Math.max(8, Math.round((item.count / trafficAnalysisMaxOdometerBandCount) * 100))}%` }}
                            />
                          </div>
                          <div className="traffic-analysis-bars__metric">
                            <strong>{item.count}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="traffic-analysis-subpanel">
                    <div className="row">
                      <div>
                        <span className="eyebrow">Vehicle age bands</span>
                        <h4>How old the fleet in lane is</h4>
                      </div>
                      <small>
                        {trafficAnalysis.avgVehicleAge ? `Avg ${trafficAnalysis.avgVehicleAge.toFixed(1)} yrs` : "No age average yet"}
                      </small>
                    </div>
                    <div className="traffic-analysis-bars">
                      {trafficAnalysis.vehicleAgeBands.map((item) => (
                        <div key={item.key} className="traffic-analysis-bars__item">
                          <div className="traffic-analysis-bars__label">
                            <strong>{item.label}</strong>
                            <small>{item.share}% of rows with model year</small>
                          </div>
                          <div className="traffic-analysis-bars__track">
                            <div
                              className="traffic-analysis-bars__fill"
                              style={{ width: `${Math.max(8, Math.round((item.count / trafficAnalysisMaxVehicleAgeBandCount) * 100))}%` }}
                            />
                          </div>
                          <div className="traffic-analysis-bars__metric">
                            <strong>{item.count}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TrafficAnalysisSection>

              <TrafficAnalysisSection
                eyebrow="Weekday rhythm"
                title="Weekday load and appointment windows"
                summary={`${trafficAnalysis.weekdayCards.filter((item) => item.count > 0).length} weekdays active in the month`}
                hint="Shows where the month clusters by weekday and where appointments are stacking inside the day."
                className="traffic-analysis-panel traffic-analysis-panel--wide"
              >
                <div className="traffic-analysis-weekday-grid">
                  {trafficAnalysis.weekdayCards.map((item) => (
                    <div key={item.label} className="traffic-analysis-weekday-card">
                      <div className="traffic-analysis-weekday-card__top">
                        <strong>{item.label}</strong>
                        <span>{item.share}% of month</span>
                      </div>
                      <div className="traffic-analysis-weekday-card__track">
                        <div
                          className="traffic-analysis-weekday-card__fill"
                          style={{ width: `${Math.max(8, Math.round((item.count / trafficAnalysisMaxWeekdayCount) * 100))}%` }}
                        />
                      </div>
                      <div className="traffic-analysis-weekday-card__meta">
                        <b>{item.count}</b>
                        <small>{item.noteCoverage}% notes</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="traffic-analysis-time-grid">
                  {trafficAnalysis.timeWindowCards.map((item) => (
                    <div key={item.key} className="traffic-analysis-time-card">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                      <div className="traffic-analysis-time-card__track">
                        <div
                          className="traffic-analysis-time-card__fill"
                          style={{ width: `${Math.max(8, Math.round((item.count / trafficAnalysisMaxTimeWindowCount) * 100))}%` }}
                        />
                      </div>
                      <small>{item.share}% of month traffic</small>
                    </div>
                  ))}
                </div>
              </TrafficAnalysisSection>

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
                    placeholder="Ask: Which weekdays are busiest, how many rows are 100k+ miles, or where the best upgrade opportunities sit."
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
                <div className="freshup-hero__copy">
                  <span className="eyebrow">Freshup Log</span>
                  <h2>Choose the salesperson first, then log the customer fast.</h2>
                  <p>
                    This page is built for quick lot use. Pick the rep, enter the customer name and phone, save the freshup,
                    and keep the tap-page links and live log underneath.
                  </p>
                </div>
                <div className="freshup-hero__status-grid">
                  <div className="freshup-hero__status">
                    <span>Ready to log</span>
                    <strong>{freshUpFilledCount}/3 filled</strong>
                    <small>Salesperson, customer name, and phone are the only required steps.</small>
                  </div>
                  <div className="freshup-hero__status freshup-hero__status--soft">
                    <span>Current rep</span>
                    <strong>{freshUpAssignedSalesperson?.name || "Choose first"}</strong>
                    <small>{freshUpAssignedSalesperson?.dealership || `${freshUpLog.total} freshups logged so far.`}</small>
                  </div>
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
                    <div className="freshup-card-intro__top">
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
                      <div className="freshup-card-intro__copy">
                        <span className="eyebrow">Monthly Gift</span>
                        <h2>{freshUpCardIntroHeading}</h2>
                        <p>{freshUpCardIntroCopy}</p>
                      </div>
                    </div>
                    <div className="freshup-card-intro__meta">
                      <span>{freshUpPrimaryStore?.display_name || "Bert Ogden Mission"}</span>
                      <span>{freshUpSalespersonPhoneText || `Ask for ${freshUpSalespersonFirstName}`}</span>
                    </div>
                    <div className="freshup-agent-actions freshup-agent-actions--compact">
                      {freshUpSalespersonPhoneHref ? (
                        <a
                          className="freshup-link-btn freshup-link-btn--blue"
                          href={freshUpSalespersonPhoneHref}
                          onClick={() =>
                            trackFreshUpEvent({
                              eventType: "link_click",
                              linkType: "call",
                              targetUrl: freshUpSalespersonPhoneHref,
                              storeDealership: freshUpAssignedSalesperson?.dealership || freshUpPrimaryStore?.dealership || "",
                            })
                          }
                        >
                          Call {freshUpAssignedSalesperson?.name || "Sales Agent"}
                        </a>
                      ) : null}
                      {freshUpSalespersonContactHref ? (
                        <a
                          className="freshup-link-btn freshup-link-btn--outline"
                          href={freshUpSalespersonContactHref}
                          download={freshUpSalespersonContactFileName}
                          onClick={() =>
                            trackFreshUpEvent({
                              eventType: "link_click",
                              linkType: "contact_save",
                              targetUrl: freshUpSalespersonContactHref,
                              storeDealership: freshUpAssignedSalesperson?.dealership || freshUpPrimaryStore?.dealership || "",
                            })
                          }
                        >
                          {freshUpSalespersonContactLabel}
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {!freshUpCardMode ? (
                  <div className="freshup-capture__header">
                    <div>
                      <span className="eyebrow">Quick Entry</span>
                      <h3>Salesperson-first freshup capture</h3>
                      <small>Pick the rep first, then save the customer in one pass.</small>
                    </div>
                    <button type="button" className="secondary" onClick={resetFreshUpForm}>
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="freshup-capture__header freshup-capture__header--compact">
                    <div className="freshup-capture__header-copy">
                      <span className="eyebrow">Step 1</span>
                      <h3>Text me my gift code</h3>
                      <small>Your salesperson will receive your info and help with the next step.</small>
                    </div>
                  </div>
                )}

                <div className={`freshup-form ${freshUpCardMode ? "freshup-form--card" : "freshup-form--desk"}`}>
                  {freshUpCardMode ? (
                    <>
                      <div className="freshup-gift-promise">
                        <span>Gift text</span>
                        <strong>Use this month's code to get your gift.</strong>
                        <small>Enter your name and mobile number, then tap Get Your Gift.</small>
                      </div>
                      <label>
                        <span>Your Name</span>
                        <input
                          value={freshUpForm.customerName}
                          onChange={(event) => updateFreshUpFormField("customerName", event.target.value)}
                          placeholder="Enter your name"
                          autoComplete="name"
                          required
                        />
                      </label>
                      <label>
                        <span>Best Phone Number</span>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={freshUpForm.phone}
                          onChange={(event) => updateFreshUpFormField("phone", formatPhoneInput(event.target.value))}
                          placeholder="(956) 555-1234"
                          required
                        />
                        <small className="freshup-field-hint">We will text the gift code to this 10-digit mobile number.</small>
                      </label>
                      <div className="freshup-lockbox freshup-lockbox--customer">
                        <strong>{freshUpAssignedSalesperson?.name || "Your Mission sales team"}</strong>
                        <small>{freshUpAssignedSalesperson?.dealership || "We will connect you with the right specialist."}</small>
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="freshup-form__field freshup-form__field--salesperson">
                        <span>Salesperson</span>
                        <select value={resolvedFreshUpSalespersonId} onChange={(event) => applyFreshUpSalespersonSelection(event.target.value)}>
                          <option value="">Select salesperson</option>
                          {activeSales.map((person) => (
                            <option key={`freshup-person-${person.id}`} value={person.id}>
                              {person.name} ({person.dealership})
                            </option>
                          ))}
                        </select>
                        <small>
                          {freshUpAssignedSalesperson
                            ? `Selected ${freshUpAssignedSalesperson.name} (${freshUpAssignedSalesperson.dealership}).`
                            : "Pick the salesperson before logging the fresh up."}
                        </small>
                      </label>
                      {freshUpAssignedSalesperson ? (
                        <div className="freshup-salesperson-strip">
                          <div className="freshup-salesperson-strip__copy">
                            <span className="eyebrow">Assigned salesperson</span>
                            <strong>{freshUpAssignedSalesperson.name}</strong>
                            <small>
                              {freshUpAssignedSalesperson.dealership}
                              {freshUpSalespersonPhoneText ? ` · ${freshUpSalespersonPhoneText}` : " · No phone saved yet"}
                            </small>
                            <span className="freshup-salesperson-strip__meta">
                              {freshUpAssignedSalesperson.dealership}
                              {freshUpSalespersonPhoneText ? ` - ${freshUpSalespersonPhoneText}` : " - No phone saved yet"}
                            </span>
                          </div>
                          <div className="freshup-salesperson-strip__actions">
                            {freshUpSalespersonPhoneHref ? (
                              <a className="freshup-link-btn freshup-link-btn--blue" href={freshUpSalespersonPhoneHref}>
                                Call {freshUpAssignedSalesperson.name}
                              </a>
                            ) : null}
                            {freshUpSalespersonContactHref ? (
                              <a
                                className="freshup-link-btn freshup-link-btn--outline"
                                href={freshUpSalespersonContactHref}
                                download={freshUpSalespersonContactFileName}
                              >
                                {freshUpSalespersonContactLabel}
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <label className="freshup-form__field">
                          <span>Customer Name</span>
                          <input
                            value={freshUpForm.customerName}
                          onChange={(event) => updateFreshUpFormField("customerName", event.target.value)}
                            placeholder="Full name"
                            autoComplete="name"
                            required
                          />
                        </label>
                      <label className="freshup-form__field">
                        <span>Phone Number</span>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={freshUpForm.phone}
                          onChange={(event) => updateFreshUpFormField("phone", formatPhoneInput(event.target.value))}
                          placeholder="(956) 555-1234"
                          required
                        />
                      </label>
                    </>
                  )}
                  {freshUpCardMode ? (
                    <small className="freshup-consent">
                      By tapping Get Your Gift, you agree to receive a one-time gift code text and dealership follow-up.
                    </small>
                  ) : null}
                  <div className="freshup-actions">
                    <button
                      type="submit"
                      disabled={busy === "freshup-submit" || !freshUpAssignedSalesperson || !freshUpCustomerNameReady || !freshUpCustomerPhoneReady}
                    >
                      {busy === "freshup-submit" ? (freshUpCardMode ? "Sending Text..." : "Saving...") : freshUpCardMode ? freshUpCardSubmitLabel : "Log Freshup"}
                    </button>
                    {!freshUpCardMode ? (
                      <button type="button" className="secondary" onClick={copyFreshUpSummary}>
                        Copy Recap
                      </button>
                    ) : null}
                  </div>

                  {freshUpFormError ? <div className="notice error freshup-form-notice">{freshUpFormError}</div> : null}
                  {freshUpStatus ? <div className={`notice ${freshUpStatusTone}`}>{freshUpStatus}</div> : null}
                </div>
              </form>

              <div id={freshUpCardMode ? "freshup-links" : undefined} className={`panel freshup-nfc ${freshUpCardMode ? "freshup-nfc--card" : ""}`}>
                <div className="freshup-nfc__header">
                  <div className="freshup-nfc__header-copy">
                    <span className="eyebrow">{freshUpCardMode ? "Choose your next step" : "NFC Card Side"}</span>
                    <h3>{freshUpCardMode ? freshUpPrimaryStore?.display_name || freshUpLinksConfig.page_title : "Program one link per salesperson"}</h3>
                    <p>
                      {freshUpCardMode
                        ? "Choose the credit application, inventory, maps, or social link you need next."
                        : "Put this link on the NFC business card. When a customer taps, it opens a customer-facing landing page with contact capture at the top and the right links underneath."}
                    </p>
                  </div>
                  {freshUpCardMode ? (
                    <div className="freshup-nfc__header-chip">
                      <strong>{freshUpAssignedSalesperson?.name || "Sales team"}</strong>
                      <span>{freshUpPrimaryStore?.display_name || "Bert Ogden Mission"}</span>
                    </div>
                  ) : null}
                </div>
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
                              <p>Financing and shopping links for {store.display_name}.</p>
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
            <div className="panel specials-panel-header">
              <span className="eyebrow">Live specials</span>
              <h2>{specialMonthStamp(latestSpecialImportTs)} Kia, Mazda, and Auto Outlet picks</h2>
              <p className="admin-note">
                This page now stays focused on the live monthly Kia and Mazda offer tiles plus the top used picks from Mission Auto
                Outlet. The old manual graphic library stays on the admin side only.
              </p>
              <div className="specials-panel-header__chips">
                <span>{specialMonthStamp(latestSpecialImportTs)} stamp</span>
                <span>{specialSectionsByKey.kia_new?.entries?.length || 0} Kia tile{(specialSectionsByKey.kia_new?.entries?.length || 0) === 1 ? "" : "s"}</span>
                <span>{specialSectionsByKey.mazda_new?.entries?.length || 0} Mazda tile{(specialSectionsByKey.mazda_new?.entries?.length || 0) === 1 ? "" : "s"}</span>
                <span>{specialSectionsByKey.used_srp?.entries?.length || 0} Auto Outlet pick{(specialSectionsByKey.used_srp?.entries?.length || 0) === 1 ? "" : "s"}</span>
              </div>
              {adminToken ? (
                <div className="specials-panel-header__actions">
                  <button
                    type="button"
                    onClick={refreshAutomaticSpecials}
                    disabled={
                      busy === "specials-auto-all" ||
                      busy === "specials-auto-kia_new" ||
                      busy === "specials-auto-mazda_new" ||
                      busy === "specials-auto-used_srp"
                    }
                  >
                    {busy === "specials-auto-all" ? "Refreshing all live specials..." : "Refresh All Live Specials"}
                  </button>
                </div>
              ) : null}
              {specialsImportStatus ? <div className="special-feed-admin-panel__status">{specialsImportStatus}</div> : null}
            </div>

            {populatedSpecialVehicleSections.length ? (
              populatedSpecialVehicleSections.map((section) => {
                const sectionMonth = specialMonthStamp(section.imported_ts || latestSpecialImportTs);
                const sectionTitle =
                  section.key === "kia_new"
                    ? `${sectionMonth} Kia specials`
                    : section.key === "mazda_new"
                      ? `${sectionMonth} Mazda specials`
                      : `${sectionMonth} Mission Auto Outlet top picks`;
                const sectionSummary =
                  section.key === "used_srp"
                    ? "Highest-scoring used inventory picks based on price, miles, and model year."
                    : "Live website tiles cached from the current monthly offers.";
              const sourceMeta = specialFeedSourceMap[section.key] || null;
              const sectionUrl = section.source_url || sourceMeta?.defaultUrl || "";
              return (
                <div key={section.key} className="panel special-feed-section">
                  <div className="special-feed-section__header">
                    <div>
                      <span className="eyebrow">{section.label}</span>
                      <h3>{sectionTitle}</h3>
                      <p className="admin-note">{sectionSummary}</p>
                    </div>
                    <div className="special-feed-section__meta">
                      <span>{section.entries?.length || 0} live tile{(section.entries?.length || 0) === 1 ? "" : "s"}</span>
                      {section.imported_ts ? <span>Synced {dateTimeLabel(section.imported_ts)}</span> : <span>Not imported yet</span>}
                      {sectionUrl ? (
                        <a href={sectionUrl} target="_blank" rel="noreferrer">
                          Open source
                        </a>
                      ) : (
                        <span>Source URL pending</span>
                      )}
                    </div>
                  </div>

                  <div className="special-feed-grid">
                      {section.entries.map((item) => {
                        const Wrapper = item.link_url ? "a" : "div";
                        const wrapperProps = item.link_url
                          ? { href: item.link_url, target: "_blank", rel: "noreferrer" }
                          : {};
                        return (
                          <Wrapper
                            key={`special-feed-${section.key}-${item.id}`}
                            className={`special-feed-card ${section.key === "used_srp" ? "is-used" : ""}`}
                            {...wrapperProps}
                          >
                            <div className="special-feed-card__art">
                              {item.image_url ? <img src={item.image_url} alt={item.title} /> : null}
                              <div className="special-feed-card__overlay">
                                <div className="special-feed-card__overlay-top">
                                  <span>{item.badge || section.label}</span>
                                  <span className="special-feed-card__month">{sectionMonth}</span>
                                </div>
                                {item.score_label ? <strong>{item.score_label}</strong> : null}
                              </div>
                            </div>
                            <div className="special-feed-card__copy">
                              <strong>{item.title}</strong>
                              {item.subtitle ? <p>{item.subtitle}</p> : null}
                              <div className="special-feed-card__chips">
                                {item.price_text ? <span>{item.price_text}</span> : null}
                                {item.payment_text ? <span>{item.payment_text}</span> : null}
                                {item.mileage_text ? <span>{item.mileage_text}</span> : null}
                                {item.score ? <span>Score {Math.round(item.score)}</span> : null}
                              </div>
                              {item.note ? <small>{item.note}</small> : null}
                            </div>
                          </Wrapper>
                        );
                      })}
                    </div>
                </div>
              );
            })) : (
              <div className="panel empty">
                {adminToken
                  ? "No live specials have been imported yet. Use Refresh All Live Specials above."
                  : "No live specials are available yet. Ask an admin to refresh the live feeds."}
              </div>
            )}
          </section>
        ) : null}

        {tab === "crmCleanup" ? <CrmCleanupSection /> : null}

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
                <div className="panel admin-session-card">
                  <div className="admin-session-card__identity">
                    <span className="eyebrow">Admin unlocked</span>
                    <h2>{adminSession.username}</h2>
                  </div>
                  <div className="admin-session-card__release">
                    <span className="eyebrow">Current release</span>
                    <div className="admin-session-card__release-top">
                      <strong>{LATEST_ADMIN_RELEASE.version}</strong>
                      <span>Updated {LATEST_ADMIN_RELEASE.updatedAt}</span>
                    </div>
                    <p>{LATEST_ADMIN_RELEASE.summary}</p>
                  </div>
                  <button type="button" className="secondary" onClick={logout}>
                    Sign Out
                  </button>
                </div>

                <div className="panel admin-release-history">
                  <div className="admin-release-history__header">
                    <div>
                      <span className="eyebrow">Version history</span>
                      <h3>Recent software updates</h3>
                    </div>
                    <span className="admin-release-history__stamp">
                      Last updated {LATEST_ADMIN_RELEASE.updatedAt}
                    </span>
                  </div>
                  <div className="admin-release-history__list">
                    {ADMIN_RELEASE_HISTORY.map((release, index) => (
                      <article
                        key={`${release.version}-${release.updatedAt}`}
                        className={`admin-release-entry ${index === 0 ? "is-current" : ""}`}
                      >
                        <div className="admin-release-entry__header">
                          <span className="admin-release-entry__version">{release.version}</span>
                          <span className="admin-release-entry__date">{release.updatedAt}</span>
                        </div>
                        <h4>{release.title}</h4>
                        <p>{release.summary}</p>
                        <ul>
                          {release.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="subtabs">
                  {ADMIN_SECTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`subtab ${adminSection === item.id ? "is-active" : ""}`}
                      onClick={() => setAdminSection(item.id)}
                      aria-pressed={adminSection === item.id}
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
                          <h3>WhatsApp assignment push</h3>
                          <p className="admin-note">
                            Twilio and email are off for BDC Assign. New lead assignments now push only to{" "}
                            <strong>{bdcLeadPushConfig.chat_name || "your self chat"}</strong> through the local controlled
                            Chrome WhatsApp session.
                          </p>
                        </div>
                        <div
                          className="controls"
                        >
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => refreshBdcLeadPushConfig()}
                            disabled={busy === "bdc-lead-push-refresh"}
                          >
                            {busy === "bdc-lead-push-refresh" ? "Refreshing..." : "Refresh Status"}
                          </button>
                        </div>
                      </div>
                      <div className="notification-status-grid notification-status-grid--single">
                        <div
                          className={`notification-status-card ${
                            !bdcLeadPushConfig.runner_ready
                              ? "is-missing"
                              : bdcLeadPushConfig.enabled
                                ? "is-ready"
                                : "is-paused"
                          }`}
                        >
                          <span className="eyebrow">WhatsApp</span>
                          <strong>{bdcLeadPushConfig.chat_name || "Self chat"}</strong>
                          <small>
                            {!bdcLeadPushConfig.runner_ready
                              ? bdcLeadPushConfig.runner_status_text || "The WhatsApp bridge is not ready yet."
                              : !bdcLeadPushConfig.enabled
                                ? "Lead push is paused, but Twilio and email stay off."
                                : bdcLeadPushConfig.runner_status_text || "BDC Assign is set to push new leads into your self chat."}
                          </small>
                        </div>
                      </div>
                      <div className="distribution-toggle">
                        <button
                          type="button"
                          className={`pill ${bdcLeadPushConfig.enabled ? "is-active" : ""}`}
                          onClick={() => saveBdcLeadPushEnabled(true)}
                          disabled={busy === "bdc-lead-push" || !bdcLeadPushConfig.runner_ready}
                        >
                          Lead push on
                        </button>
                        <button
                          type="button"
                          className={`pill ${!bdcLeadPushConfig.enabled ? "is-active" : ""}`}
                          onClick={() => saveBdcLeadPushEnabled(false)}
                          disabled={busy === "bdc-lead-push"}
                        >
                          Lead push off
                        </button>
                      </div>
                      <div className="notice">
                        {!bdcLeadPushConfig.runner_ready
                          ? bdcLeadPushConfig.runner_status_text || "Keep the controlled Chrome profile signed into WhatsApp Web on this machine, then refresh the status here."
                          : !bdcLeadPushConfig.enabled
                            ? "Lead push is paused until you turn it back on."
                            : bdcLeadPushConfig.runner_status_text
                              ? `Every new BDC assignment will push only to ${bdcLeadPushConfig.chat_name || "your self chat"}. ${bdcLeadPushConfig.runner_status_text}`
                              : `Every new BDC assignment will push only to ${bdcLeadPushConfig.chat_name || "your self chat"}.`}
                      </div>
                      <div className="notification-setup-list">
                        <div>
                          <strong>Delivery path</strong>
                          <small>BDC Assign → local WhatsApp Web self chat</small>
                        </div>
                        <div>
                          <strong>Sender session</strong>
                          <small>The runner must stay signed into WhatsApp Web in the controlled Chrome profile.</small>
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="row">
                        <div>
                          <span className="eyebrow">Salespeople by store</span>
                          <h3>Roster columns</h3>
                          <p className="admin-note">
                            Edit the live roster here, or export the staff CSV, update it quickly in Excel, and upload the
                            same file to bulk sync names, phone numbers, emails, alerts, and active status back into the app.
                          </p>
                        </div>
                        <div className="controls">
                          <input
                            key={staffImportKey}
                            ref={staffImportInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            hidden
                            onChange={handleStaffRosterImportChange}
                          />
                          <button
                            type="button"
                            className="secondary"
                            onClick={openStaffRosterImportPicker}
                            disabled={busy === "staff-import"}
                          >
                            {busy === "staff-import" ? "Importing..." : "Import Staff CSV"}
                          </button>
                          <button type="button" className="secondary" onClick={exportStaffRosterCsv}>
                            Export Staff CSV
                          </button>
                        </div>
                      </div>
                      {staffRosterFeedback ? (
                        <div className={`notice ${staffRosterFeedback.kind}`}>{staffRosterFeedback.message}</div>
                      ) : null}
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

                {adminSection === "salesAnalytics" ? (
                  <>
                    <div className="panel sales-automation-admin-panel">
                      <div className="sales-automation-admin-panel__header">
                        <div>
                          <span className="eyebrow">Manual report pushes</span>
                          <h3>Send any of the three reports to WhatsApp now</h3>
                          <p className="admin-note">
                            These buttons run the live DealerSocket scrape and send the screenshot only to{" "}
                            <strong>{bdcLeadPushConfig.chat_name || "your self chat"}</strong>.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary"
                          onClick={refreshAdminSalesAnalyticsOverview}
                          disabled={salesAnalyticsAdminLoading || !adminToken}
                        >
                          {salesAnalyticsAdminLoading ? "Refreshing..." : "Refresh Status"}
                        </button>
                      </div>
                      {runningAdminSalesAnalytics.length ? (
                        <div className="sales-automation-admin-running" role="status" aria-live="polite">
                          <span className="eyebrow">Pull status</span>
                          <h4>Queued and running pulls stay synced here</h4>
                          <p>
                            The website refreshes automatically when each queued or running snapshot moves forward. Most pulls show up within{" "}
                            {SALES_ANALYTICS_PULL_WINDOW_LABEL}.
                          </p>
                          <div className="sales-automation-admin-running__list">
                            {runningAdminSalesAnalytics.map((item) => (
                              <article key={`sales-analytics-running-${item.key}`} className="sales-automation-admin-running__item">
                                <strong>{item.label}</strong>
                                <span>
                                  {item.state === "queued"
                                    ? "Queued for home PC"
                                    : item.startedAt
                                      ? `Started ${dateTimeLabel(item.startedAt)}`
                                      : "Starting now"}
                                </span>
                                <small>
                                  {item.message ||
                                    (item.state === "queued"
                                      ? "Waiting for the home-PC bridge to claim the request."
                                      : "DealerSocket scrape, WhatsApp send, and dashboard refresh are running now.")}
                                </small>
                              </article>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {salesAnalyticsAdminFeedback ? <div className="notice">{salesAnalyticsAdminFeedback}</div> : null}
                      <div className="sales-automation-admin-grid">
                        {SALES_ANALYTICS_VARIANTS.map((variant) => {
                          const dashboard = salesAnalyticsAdminDashboards[variant.key] || emptySalesAnalyticsDashboard();
                          const config = dashboard?.config || {};
                          const status = dashboard?.status || {};
                          const latest = dashboard?.latest || null;
                          const statusState = String(status.state || "").trim().toLowerCase();
                          const isRunning = busy === `admin-sales-analytics-run:${variant.key}`;
                          const isJobActive = isRunning || ["queued", "running"].includes(statusState);
                          return (
                            <article key={`admin-sales-analytics-${variant.key}`} className="sales-automation-admin-card inset-panel">
                              <div className="sales-automation-admin-card__copy">
                                <span>{variant.label}</span>
                                <strong>{latest?.role_name || config.report_name || variant.label}</strong>
                                <small>
                                  {config.schedule_label || "Manual only"}
                                  <br />
                                  Last success: {dateTimeLabel(status.last_success_at) || "Not available yet"}
                                </small>
                              </div>
                              <div className="sales-automation-admin-card__meta">
                                <span className={`sales-analytics-state is-${String(status.state || "idle").toLowerCase()}`}>
                                  {humanStatusLabel(status.state)}
                                </span>
                                <span>{latest?.delivery?.chat_name || config.chat_name || "Kau 429-8898 (You)"}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => triggerAdminSalesAnalyticsRun(variant.key)}
                                disabled={isJobActive || salesAnalyticsAdminLoading || !config.runner_ready || !adminToken}
                              >
                                {isRunning
                                  ? "Sending..."
                                  : statusState === "queued"
                                    ? "Queued..."
                                    : statusState === "running"
                                      ? "Running..."
                                      : "Send To My WhatsApp"}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}

                {adminSection === "tabs" ? (
                  <div className="panel">
                    <span className="eyebrow">Page order</span>
                    <h3>Choose the tab order and who can see each page</h3>
                    <p className="admin-note">
                      Move the pages into the order you want, then save once. Hidden tabs stay visible for admin, and the
                      public navigation follows this same saved order everywhere else.
                    </p>
                    <div className="admin-tab-order-list">
                      {orderedTabEntries.map((entry, index) => {
                        const item = TABS.find((tabItem) => tabItem.id === entry.tab_id);
                        if (!item) return null;
                        return (
                          <div key={entry.tab_id} className="admin-tab-order-row panel inset-panel">
                            <div className="admin-tab-order-row__meta">
                              <span className="admin-tab-order-row__position">{index + 1}</span>
                              <div>
                                <strong>{item.label}</strong>
                                <small>{entry.visible ? "Visible to everyone" : "Hidden from non-admin users"}</small>
                              </div>
                            </div>
                            <label className="checkbox admin-tab-order-row__toggle">
                              <input
                                type="checkbox"
                                checked={entry.visible}
                                onChange={(event) => setTabVisibilityValue(entry.tab_id, event.target.checked)}
                              />
                              <span>{entry.visible ? "Visible" : "Hidden"}</span>
                            </label>
                            <div className="admin-tab-order-row__actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => moveTabVisibility(entry.tab_id, "up")}
                                disabled={index === 0}
                              >
                                Move Up
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => moveTabVisibility(entry.tab_id, "down")}
                                disabled={index === orderedTabEntries.length - 1}
                              >
                                Move Down
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="controls">
                      <button type="button" className="secondary" onClick={resetTabVisibilityOrder}>
                        Reset Default Order
                      </button>
                      <button type="button" onClick={saveTabVisibilitySettings} disabled={busy === "tab-visibility"}>
                        {busy === "tab-visibility" ? "Saving..." : "Save Page Order"}
                      </button>
                    </div>
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
                    <div className="panel special-feed-admin-panel">
                      <div className="special-feed-admin-panel__header">
                        <div>
                          <span className="eyebrow">Website imports</span>
                          <h3>Refresh Kia, Mazda, and Auto Outlet in one click</h3>
                          <p className="admin-note">
                            This is the primary specials workflow now. It pulls the live Kia monthly offers, the live Mazda monthly
                            offers, and the top used picks from Mission Auto Outlet.
                          </p>
                        </div>
                        {specialsImportStatus ? <div className="special-feed-admin-panel__status">{specialsImportStatus}</div> : null}
                      </div>

                      <div className="special-feed-admin-panel__actions">
                        <button
                          type="button"
                          onClick={refreshAutomaticSpecials}
                          disabled={
                            busy === "specials-auto-all" ||
                            busy === "specials-auto-kia_new" ||
                            busy === "specials-auto-mazda_new" ||
                            busy === "specials-auto-used_srp"
                          }
                        >
                          {busy === "specials-auto-all" ? "Refreshing all live specials..." : "Refresh All Live Specials"}
                        </button>
                      </div>

                      <div className="special-feed-admin-grid">
                        {SPECIAL_FEED_SOURCES.map((source) => {
                          const sourceSection = specialSectionsByKey[source.key];
                          const sourceCount = sourceSection?.entries?.length || 0;
                          const sourceMonth = specialMonthStamp(sourceSection?.imported_ts || latestSpecialImportTs);
                          return (
                          <article key={`special-source-${source.key}`} className="special-feed-admin-card special-feed-admin-card--auto">
                            <div className="special-feed-admin-card__copy">
                              <span>{source.label}</span>
                              <strong>{source.description}</strong>
                              <small>
                                {sourceCount} live tile{sourceCount === 1 ? "" : "s"} · {sourceMonth}
                                {sourceSection?.imported_ts ? ` · synced ${dateTimeLabel(sourceSection.imported_ts)}` : " · not imported yet"}
                              </small>
                            </div>
                            <div className="special-feed-admin-card__url">
                              <label>
                                <span>Source URL</span>
                                <input value={specialsSourceUrl(source.key)} readOnly placeholder={source.defaultUrl || ""} />
                              </label>
                              <small>Fixed live source. No copy, console, or clipboard step anymore.</small>
                            </div>
                            <div className="special-feed-admin-card__actions">
                              <a href={specialsSourceUrl(source.key)} target="_blank" rel="noreferrer">
                                Open Source
                              </a>
                              <button
                                type="button"
                                onClick={() => refreshSpecialFeedSource(source.key)}
                                disabled={busy === "specials-auto-all" || busy === `specials-auto-${source.key}` || busy !== ""}
                              >
                                {busy === `specials-auto-${source.key}` ? "Refreshing..." : "Refresh Now"}
                              </button>
                            </div>
                          </article>
                          );
                        })}
                      </div>

                      <p className="admin-note">All three live sources refresh from fixed website feeds now. No manual used-SRP import step remains.</p>
                    </div>

                    <details className="special-feed-admin-manual">
                      <summary>Optional manual override library</summary>
                      <div className="admin-grid">
                        <div className="panel">
                          <span className="eyebrow">{specialForm.editingId ? "Edit override tile" : "Upload override tile"}</span>
                          <h3>1080 x 1080 manual promo tile</h3>
                          <p className="admin-note">
                            Only use this if you need a custom one-off graphic beyond the live Kia, Mazda, and Auto Outlet feeds.
                          </p>
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
                          <span className="eyebrow">Manual overrides</span>
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
                              <div className="empty">No manual override graphics uploaded yet.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </details>
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
