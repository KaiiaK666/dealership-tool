import React, { useEffect, useState } from "react";
import {
  apiBase,
  adminLogin,
  assignBdcLead,
  clearBdcHistory,
  createBdcAgent,
  createSalesperson,
  createServiceDriveTraffic,
  createSpecial,
  createTrafficPdf,
  deleteServiceDriveTrafficDay,
  generateServiceDrive,
  getAdminDaysOff,
  getAdminSession,
  getBdcAgents,
  getBdcLog,
  getBdcReport,
  getBdcState,
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
  importReynoldsServiceDriveTraffic,
  replaceAdminDaysOffMonth,
  undoReynoldsServiceDriveTrafficImport,
  updateBdcAgent,
  updateBdcDistribution,
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
  { id: "bdc", label: "BDC Assign" },
  { id: "reports", label: "BDC Reports" },
  { id: "traffic", label: "Service Drive Traffic" },
  { id: "freshUp", label: "Fresh Up Quick Add" },
  { id: "marketplace", label: "Facebook Marketplace" },
  { id: "quote", label: "Quote Tool" },
  { id: "specials", label: "Specials" },
  { id: "admin", label: "Admin" },
];

const ADMIN_SECTIONS = [
  { id: "staff", label: "Staff Setup" },
  { id: "daysOff", label: "Days Off" },
  { id: "trafficLog", label: "Traffic Log" },
  { id: "bdcDistribution", label: "Lead Distribution Type" },
  { id: "tabs", label: "Tab Visibility" },
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
  price_label: "Bert Ogden Price",
  cta_text: "Message us for availability and financing options.",
};
const MARKETPLACE_PLACEHOLDERS = [
  "{year}",
  "{make}",
  "{model}",
  "{price}",
  "{mileage}",
  "{vin}",
  "{url}",
  "{price_label}",
  "{cta_text}",
];
const MARKETPLACE_PREVIEW_SAMPLE = {
  year: "2024",
  make: "Kia",
  model: "Telluride SX",
  price: "$41,995",
  mileage: "12,440 mi",
  vin: "5XYP5DGC8RG123456",
  url: "https://www.bertogdenexample.com/vehicle/2024-kia-telluride-sx",
};
const FRESH_UP_STORAGE_KEY = "dealer_tool_fresh_up_form";
const FRESH_UP_DEFAULTS = {
  customerName: "",
  phone: "",
  email: "",
  vehicleInterest: "",
  stockNumber: "",
  salespersonId: "",
  source: "Walk-in",
  tradeIn: "Unknown",
  nextStep: "Needs TO",
  notes: "",
};
const CREDIT_TIERS = [
  { label: "400s", min: 400, max: 499 },
  { label: "500s", min: 500, max: 599 },
  { label: "600s", min: 600, max: 699 },
  { label: "700s", min: 700, max: 799 },
  { label: "800s", min: 800, max: 899 },
];
const TRAFFIC_URL = "https://bokbbui-production.up.railway.app/";
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
  if (typeof error === "string") return error;
  if (error.message) return error.message;
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

function freshUpSummaryText(form, salespersonName) {
  return [
    `Fresh Up - ${freshUpTimestampLabel()}`,
    `Customer: ${String(form.customerName || "").trim() || "Not added"}`,
    `Phone: ${String(form.phone || "").trim() || "Not added"}`,
    `Email: ${String(form.email || "").trim() || "Not added"}`,
    `Vehicle: ${String(form.vehicleInterest || "").trim() || "Not added"}`,
    `Stock #: ${String(form.stockNumber || "").trim() || "Not added"}`,
    `Assigned Salesperson: ${salespersonName || "Not selected"}`,
    `Lead Source: ${String(form.source || "").trim() || "Not added"}`,
    `Trade-In: ${String(form.tradeIn || "").trim() || "Unknown"}`,
    `Next Step: ${String(form.nextStep || "").trim() || "Not added"}`,
    `Notes: ${String(form.notes || "").trim() || "None"}`,
  ].join("\n");
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

export default function App() {
  const [tab, setTab] = useState("serviceCalendar");
  const [adminSection, setAdminSection] = useState("staff");
  const [month, setMonth] = useState(currentMonth());
  const [daysOffMonth, setDaysOffMonth] = useState(currentMonth());
  const [trafficMonth, setTrafficMonth] = useState(currentMonth());
  const [selectedTrafficDate, setSelectedTrafficDate] = useState(todayDateValue());
  const [selectedTrafficSalesId, setSelectedTrafficSalesId] = useState("");
  const [selectedTrafficBrandFilter, setSelectedTrafficBrandFilter] = useState("All");
  const [expandedTrafficEntryId, setExpandedTrafficEntryId] = useState(null);
  const [salespeople, setSalespeople] = useState([]);
  const [bdcAgents, setBdcAgents] = useState([]);
  const [serviceMonth, setServiceMonth] = useState(null);
  const [serviceTrafficData, setServiceTrafficData] = useState({ month: currentMonth(), selected_date: null, total: 0, counts_by_date: {}, entries: [] });
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
  const [login, setLogin] = useState({ username: "admin", password: "admin123" });
  const [salesForm, setSalesForm] = useState({ name: "", dealership: "Kia", weekly_days_off: [], active: true });
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
  const [trafficDayClearResult, setTrafficDayClearResult] = useState(null);
  const [resourceLoadState, setResourceLoadState] = useState({
    trafficPdfs: false,
    specials: false,
    quoteRates: false,
    marketplaceTemplate: false,
  });
  const [quoteRates, setQuoteRates] = useState([]);
  const [quoteRateDraft, setQuoteRateDraft] = useState({});
  const [marketplaceTemplate, setMarketplaceTemplate] = useState(MARKETPLACE_TEMPLATE_DEFAULTS);
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
  const [freshUpForm, setFreshUpForm] = useState(() => readFreshUpDraft());
  const [freshUpCopiedAt, setFreshUpCopiedAt] = useState("");
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
  const freshUpAssignedSalesperson = salespeople.find((person) => String(person.id) === String(freshUpForm.salespersonId)) || null;
  const freshUpSummary = freshUpSummaryText(freshUpForm, freshUpAssignedSalesperson?.name || "");
  const freshUpFilledCount = [
    freshUpForm.customerName,
    freshUpForm.phone,
    freshUpForm.email,
    freshUpForm.vehicleInterest,
    freshUpForm.stockNumber,
    freshUpForm.salespersonId,
    freshUpForm.notes,
  ].filter((value) => String(value || "").trim()).length;
  const marketplacePreviewData = {
    ...MARKETPLACE_PREVIEW_SAMPLE,
    price_label: marketplaceTemplate.price_label || MARKETPLACE_TEMPLATE_DEFAULTS.price_label,
    cta_text: marketplaceTemplate.cta_text || MARKETPLACE_TEMPLATE_DEFAULTS.cta_text,
  };
  const marketplacePreviewTitle = fillMarketplaceTemplate(marketplaceTemplate.title_template, marketplacePreviewData);
  const marketplacePreviewDescription = fillMarketplaceTemplate(
    marketplaceTemplate.description_template,
    marketplacePreviewData
  );
  const visibleTabIds = new Set(
    (tabVisibility.entries || []).filter((entry) => entry.visible).map((entry) => entry.tab_id)
  );
  const tabsToShow = TABS.filter((item) => item.id === "admin" || adminSession || visibleTabIds.has(item.id));

  async function loadAll(nextMonth = month, nextFilters = filters) {
    const [sales, bdc, service, log, report, distribution, undoSettings, tabs] = await Promise.all([
      getSalespeople({ includeInactive: true }),
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
    setMarketplaceTemplate(data);
    setResourceLoadState((current) => ({ ...current, marketplaceTemplate: true }));
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
      const updated = await updateMarketplaceTemplate(adminToken, marketplaceTemplate);
      setMarketplaceTemplate(updated);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function appendMarketplacePlaceholder(field, placeholder) {
    setMarketplaceTemplate((current) => ({
      ...current,
      [field]: (() => {
        const currentValue = String(current[field] || "");
        const separator = !currentValue
          ? ""
          : field === "description_template"
            ? currentValue.endsWith("\n") ? "" : "\n"
            : currentValue.endsWith(" ") ? "" : " ";
        return `${currentValue}${separator}${placeholder}`;
      })(),
    }));
  }

  function resetMarketplaceTemplateDraft() {
    setMarketplaceTemplate(MARKETPLACE_TEMPLATE_DEFAULTS);
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
        setMarketplaceTemplate(data);
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
    if (!adminSession && tab !== "admin" && !visibleTabIds.has(tab)) {
      setTab("serviceCalendar");
    }
  }, [adminSession, tab, visibleTabIds]);

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

  async function refresh() {
    try {
      await Promise.all([
        loadAll(month, filters),
        refreshServiceTraffic(trafficMonth, selectedTrafficDate),
        refreshBdcState(leadForm.leadStore),
      ]);
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
      setSalesForm({ name: "", dealership: "Kia", weekly_days_off: [], active: true });
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

  async function copyFreshUpSummary() {
    try {
      setError("");
      await copyTextValue(freshUpSummary);
      setFreshUpCopiedAt(new Date().toISOString());
    } catch (errorValue) {
      setError(errText(errorValue));
    }
  }

  function resetFreshUpForm() {
    setFreshUpForm(FRESH_UP_DEFAULTS);
    setFreshUpCopiedAt("");
  }

  return (
    <div className="shell">
      <main className="app">
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
          <section className="stack">
            <div className="panel traffic-notes-hero">
              <div className="traffic-focus-panel__headline">
                <div>
                  <span className="eyebrow">{focusTrafficIsToday ? "Today's activity" : "Service drive activity"}</span>
                  <h2>{longDateLabel(focusTrafficDate)}</h2>
                  <p className="admin-note">
                    The selected date stays front and center here so the team immediately sees who is up for Kia and Mazda,
                    how many traffic rows are on the board, and can start writing notes right away.
                  </p>
                </div>
                <div className="traffic-day-panel__count">{visibleTrafficCount} rows</div>
              </div>
              <div className="traffic-focus-grid">
                <div className="traffic-focus-status">
                  <strong>{selectedTrafficSalesperson?.name || "Notes are open"}</strong>
                  <small>
                    {selectedTrafficHasAuthor
                      ? "The selected name will be attached to each note you save on this date."
                      : "Name tagging is optional. You can start typing and save notes without selecting anyone."}
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
                  <span>Name tag optional</span>
                  <select value={selectedTrafficSalesId} onChange={(event) => setSelectedTrafficSalesId(event.target.value)}>
                    <option value="">No name tag</option>
                    {activeSales.map((person) => (
                      <option key={`traffic-sales-${person.id}`} value={person.id}>
                        {person.name} - {person.dealership}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="traffic-notes-hero__actions">
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
                            onChange={(event) => patchTrafficEntry(entry.id, { sales_notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="note-actions">
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
                            Latest note by: {entry.sales_note_salesperson_name || "No name tag saved"}
                          </small>
                        </div>
                        <button
                          type="button"
                          onClick={() => saveTrafficSalesNotes(entry)}
                          disabled={busy === `traffic-sales-${entry.id}`}
                        >
                          {busy === `traffic-sales-${entry.id}` ? "Saving..." : "Save Notes"}
                        </button>
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

            {lastAssignment ? (
              <div className="notice success">
                {lastAssignment.bdc_agent_name} assigned {lastAssignment.customer_name || "a customer"} to{" "}
                {lastAssignment.salesperson_name} for {lastAssignment.lead_store || lastAssignment.salesperson_dealership} at{" "}
                {dateTimeLabel(lastAssignment.assigned_at)}
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
                <a className="asset-link" href="/facebook-marketplace-extension.zip" download>
                  Download Extension Zip
                </a>
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
                  <span>The helper already defaults to `https://api.bertogden123.com`. Reps should not need to change settings.</span>
                </div>
              </div>

              <div className="panel marketplace-card">
                <span className="eyebrow">Step 2</span>
                <h3>Daily rep workflow</h3>
                <ol className="numbered-list">
                  <li>Open the Bert Ogden vehicle page in Chrome</li>
                  <li>Click the extension and press `Quick Post Current Vehicle`</li>
                  <li>The helper builds the draft and opens Facebook Marketplace automatically</li>
                  <li>Let the helper try to fill the Facebook form for you</li>
                  <li>Review the listing and finish the post manually</li>
                </ol>
                <div className="marketplace-callout">
                  <strong>Main improvement</strong>
                  <span>Reps no longer need to capture first, then open Marketplace, then click Apply Draft as separate steps.</span>
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
                  <strong>Manual step that remains</strong>
                  <span>Facebook image upload can still require rep review. If Facebook changes a field, the helper panel on the page can retry the draft fill.</span>
                </div>
              </div>
            </div>

            <div className="panel marketplace-template-preview">
              <span className="eyebrow">Current template</span>
              <h3>Admin-controlled post content</h3>
              <div className="marketplace-template-grid">
                <div>
                  <span className="eyebrow">Title template</span>
                  <pre>{marketplaceTemplate.title_template}</pre>
                </div>
                <div>
                  <span className="eyebrow">Description template</span>
                  <pre>{marketplaceTemplate.description_template}</pre>
                </div>
              </div>
              <p className="admin-note">
                Supported placeholders: `{"{year}"}`, `{"{make}"}`, `{"{model}"}`, `{"{price}"}`, `{"{mileage}"}`, `{"{vin}"}`,
                `{"{url}"}`, `{"{price_label}"}`, `{"{cta_text}"}`.
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

                {adminSection === "marketplace" ? (
                  <div className="panel marketplace-admin">
                    <div className="marketplace-admin__header">
                      <div>
                        <span className="eyebrow">Marketplace template</span>
                        <h3>Facebook post content</h3>
                      </div>
                      <button type="button" className="secondary" onClick={resetMarketplaceTemplateDraft}>
                        Reset Defaults
                      </button>
                    </div>
                    <p className="admin-note">
                      Build the default Facebook copy here. The extension merges this with year, make, model, price,
                      mileage, VIN, and the inventory URL from the live vehicle page.
                    </p>

                    <div className="marketplace-admin__layout">
                      <div className="marketplace-admin__editor">
                        <div className="marketplace-admin__section">
                          <div className="marketplace-admin__section-head">
                            <div>
                              <span className="eyebrow">Step 1</span>
                              <h4>Headline and CTA</h4>
                            </div>
                            <small>These usually stay short and clean.</small>
                          </div>
                          <div className="form">
                            <label>
                              <span>Title template</span>
                              <input
                                value={marketplaceTemplate.title_template}
                                onChange={(event) =>
                                  setMarketplaceTemplate((current) => ({ ...current, title_template: event.target.value }))
                                }
                                placeholder="{year} {make} {model}"
                              />
                            </label>
                            <div className="marketplace-placeholder-group">
                              {["{year}", "{make}", "{model}", "{price}"].map((placeholder) => (
                                <button
                                  key={`title-${placeholder}`}
                                  type="button"
                                  className="pill"
                                  onClick={() => appendMarketplacePlaceholder("title_template", placeholder)}
                                >
                                  {placeholder}
                                </button>
                              ))}
                            </div>
                            <div className="marketplace-admin__two-up">
                              <label>
                                <span>Price label</span>
                                <input
                                  value={marketplaceTemplate.price_label}
                                  onChange={(event) =>
                                    setMarketplaceTemplate((current) => ({ ...current, price_label: event.target.value }))
                                  }
                                  placeholder="Bert Ogden Price"
                                />
                              </label>
                              <label>
                                <span>CTA text</span>
                                <input
                                  value={marketplaceTemplate.cta_text}
                                  onChange={(event) =>
                                    setMarketplaceTemplate((current) => ({ ...current, cta_text: event.target.value }))
                                  }
                                  placeholder="Message us for availability and financing options."
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="marketplace-admin__section">
                          <div className="marketplace-admin__section-head">
                            <div>
                              <span className="eyebrow">Step 2</span>
                              <h4>Description builder</h4>
                            </div>
                            <small>Use the chips to drop fields in fast.</small>
                          </div>
                          <label className="marketplace-admin__description">
                            <span>Description template</span>
                            <textarea
                              rows={10}
                              value={marketplaceTemplate.description_template}
                              onChange={(event) =>
                                setMarketplaceTemplate((current) => ({ ...current, description_template: event.target.value }))
                              }
                            />
                          </label>
                          <div className="marketplace-placeholder-group">
                            {MARKETPLACE_PLACEHOLDERS.map((placeholder) => (
                              <button
                                key={`description-${placeholder}`}
                                type="button"
                                className="pill"
                                onClick={() => appendMarketplacePlaceholder("description_template", placeholder)}
                              >
                                {placeholder}
                              </button>
                            ))}
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
                          <span className="eyebrow">Available placeholders</span>
                          <div className="marketplace-token-grid">
                            {MARKETPLACE_PLACEHOLDERS.map((placeholder) => (
                              <div key={`placeholder-${placeholder}`} className="marketplace-token">
                                {placeholder}
                              </div>
                            ))}
                          </div>
                          <small>
                            The extension pulls these values from the current vehicle page, then fills the template above.
                          </small>
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={saveMarketplaceTemplate} disabled={busy === "marketplace-template"}>
                      {busy === "marketplace-template" ? "Saving..." : "Save Marketplace Template"}
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
