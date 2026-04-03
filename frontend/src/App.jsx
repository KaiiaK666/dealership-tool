import React, { useEffect, useState } from "react";
import {
  apiBase,
  adminLogin,
  assignBdcLead,
  createBdcAgent,
  createSalesperson,
  createServiceDriveTraffic,
  createSpecial,
  createTrafficPdf,
  generateServiceDrive,
  getAdminDaysOff,
  getAdminSession,
  getBdcAgents,
  getBdcLog,
  getBdcReport,
  getBdcState,
  getSalespeople,
  getSpecials,
  getServiceDrive,
  getServiceDriveTraffic,
  getTrafficPdfs,
  replaceAdminDaysOffMonth,
  updateBdcAgent,
  updateSalesperson,
  updateSpecial,
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
  { id: "specials", label: "Specials" },
  { id: "admin", label: "Admin" },
];

const ADMIN_SECTIONS = [
  { id: "staff", label: "Staff Setup" },
  { id: "daysOff", label: "Days Off" },
  { id: "trafficLog", label: "Traffic Log" },
  { id: "specials", label: "Specials" },
];

const DEALERSHIP_ORDER = ["Kia", "Mazda", "Outlet"];
const TRAFFIC_BRANDS = ["Kia", "Mazda"];
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
    vehicleYear: "",
    modelMake: "",
    offerIdea: "",
  });
  const [trafficEntryFiles, setTrafficEntryFiles] = useState([]);
  const [trafficEntryFileKey, setTrafficEntryFileKey] = useState(0);
  const [trafficRowUploadFiles, setTrafficRowUploadFiles] = useState({});
  const [trafficRowUploadKeys, setTrafficRowUploadKeys] = useState({});
  const [trafficPdfForm, setTrafficPdfForm] = useState({ title: "", file: null });
  const [specialForm, setSpecialForm] = useState({ editingId: null, title: "", tag: "", file: null });
  const [trafficUploadKey, setTrafficUploadKey] = useState(0);
  const [specialUploadKey, setSpecialUploadKey] = useState(0);

  const activeSales = salespeople.filter((person) => person.active);
  const activeLeadStoreSales = activeSales.filter((person) => person.dealership === leadForm.leadStore);
  const serviceEligible = activeSales.filter((person) => person.dealership !== "Outlet");
  const activeBdc = bdcAgents.filter((agent) => agent.active);
  const bdcClosedToday = isSundayDate(today);
  const serviceCalendarCells = buildCalendarCells(serviceMonth?.days || []);
  const serviceCalendarPrintCells = buildPrintCalendarCells(serviceMonth?.days || []);
  const daysOffMonthCells = buildMonthDateCells(daysOffMonth);
  const today = todayDateValue();
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
  const visibleTrafficEntries =
    selectedTrafficBrandFilter === "All"
      ? serviceTrafficData.entries
      : serviceTrafficData.entries.filter((entry) => entry.brand === selectedTrafficBrandFilter);
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

  async function loadAll(nextMonth = month, nextFilters = filters) {
    const [sales, bdc, service, log, report] = await Promise.all([
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
    ]);
    setSalespeople(sales);
    setBdcAgents(bdc);
    setServiceMonth(service);
    setBdcLog(log);
    setBdcReport(report);
  }

  async function refreshBdcState(nextLeadStore = leadForm.leadStore) {
    const data = await getBdcState({ dealership: nextLeadStore });
    setBdcState(data);
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
  }

  async function refreshSpecials() {
    const data = await getSpecials();
    setSpecials(data.entries || []);
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
    let active = true;
    const run = async () => {
      try {
        const [pdfData, specialData] = await Promise.all([getTrafficPdfs(), getSpecials()]);
        if (!active) return;
        setTrafficPdfs(pdfData.entries || []);
        setSpecials(specialData.entries || []);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

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
      vehicleYear: "",
      modelMake: "",
      offerIdea: "",
    });
    setTrafficEntryFiles([]);
    setTrafficEntryFileKey((current) => current + 1);
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
    try {
      let saved = await createServiceDriveTraffic(adminToken, {
        traffic_date: selectedTrafficDate,
        brand: trafficEntryForm.brand,
        customer_name: trafficEntryForm.customerName,
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

  async function saveTrafficEntry(entry) {
    setBusy(`traffic-admin-${entry.id}`);
    setError("");
    try {
      const saved = await updateServiceDriveTraffic(adminToken, entry.id, {
        traffic_date: entry.traffic_date,
        brand: entry.brand,
        customer_name: entry.customer_name,
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

  return (
    <div className="shell">
      <main className="app">
        <header className="hero">
          <div className="hero-brand">
            <img className="hero-logo" src="/logo-head.png" alt="Dale Gas" />
            <span className="eyebrow">Service drive and BDC</span>
            <h1>Dealership BDC Tool</h1>
          </div>
          <div className="hero-card">
            <span>Admin</span>
            <strong>{adminSession ? adminSession.username : "Not signed in"}</strong>
            <small>{adminSession ? "Management actions unlocked" : "Only the admin tab requires login"}</small>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map((item) => (
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
                        <button
                          type="button"
                          className="calendar-day__plus"
                          aria-label={`Open service-drive traffic for ${day.date}`}
                          onClick={() => openTrafficDay(day.date)}
                        >
                          <b>+</b>
                          <small>Traffic</small>
                        </button>
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
                <img className="calendar-print-sheet__logo" src="/logo-head.png" alt="Bert Ogden Auto Group" />
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
                  const vehicleLine = [entry.vehicle_year, entry.model_make].filter(Boolean).join(" ");
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
                          <div className="note-card__summary-vehicle">
                            <span>Vehicle</span>
                            <strong>{vehicleLine || "Year / model not entered"}</strong>
                          </div>
                        </div>
                        <div className="note-card__summary-side">
                          <span className={`brand-pill brand-pill--${brandKey}`}>{entry.brand}</span>
                          <span className="note-card__summary-date">{entry.traffic_date}</span>
                          <span className="note-card__summary-toggle">{isExpanded ? "Open" : "Expand"}</span>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="note-card__details">
                      <div className="note-card__top">
                        <div>
                          <span className="eyebrow">Service drive traffic</span>
                          <h3>{entry.customer_name}</h3>
                          <p className="note-card__subtitle">{entry.traffic_date}</p>
                        </div>
                        <span className={`brand-pill brand-pill--${brandKey}`}>{entry.brand}</span>
                      </div>

                      <div className="note-meta">
                        <div className={`meta-item meta-item--brand meta-item--${brandKey}`}>
                          <span>Store</span>
                          <strong>{entry.brand}</strong>
                        </div>
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
                          <strong>{driveTeamText(entry.drive_team)}</strong>
                        </div>
                      </div>

                      <div className="note-copy">
                        <div className="note-copy__block is-readonly">
                          <span>Offer idea</span>
                          <p>{entry.offer_idea || "No offer idea entered yet."}</p>
                          <TrafficOfferGallery images={entry.offer_images} brand={entry.brand} />
                        </div>

                        <label className="note-copy__block">
                          <span>Salesperson notes</span>
                          <textarea
                            rows={5}
                            value={entry.sales_notes}
                            onChange={(event) => patchTrafficEntry(entry.id, { sales_notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="note-actions">
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
                        <button
                          type="button"
                          onClick={() => saveTrafficSalesNotes(entry)}
                          disabled={busy === `traffic-sales-${entry.id}`}
                        >
                          {busy === `traffic-sales-${entry.id}` ? "Saving..." : "Save Notes"}
                        </button>
                      </div>

                      <div className="note-meta note-meta--notes">
                        <div className="meta-item">
                          <span>Latest note by</span>
                          <strong>{entry.sales_note_salesperson_name || "No name tag saved"}</strong>
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
                <p>Choose the source store first, then assign the lead only within that store's salesperson pool.</p>
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
                  >
                    {DEALERSHIP_ORDER.map((dealership) => (
                      <option key={`lead-store-${dealership}`} value={dealership}>
                        {dealership}
                      </option>
                    ))}
                  </select>
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
                  <span>Next up for {leadForm.leadStore}</span>
                  <strong>{bdcState?.next_salesperson?.name || "No active salesperson"}</strong>
                  <small>
                    {bdcClosedToday
                      ? "Closed on Sundays"
                      : bdcState?.next_salesperson?.dealership ||
                      (activeLeadStoreSales.length
                        ? `Everyone in ${leadForm.leadStore} is scheduled off today`
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
              </div>
            </div>

            {lastAssignment ? (
              <div className="notice success">
                {lastAssignment.bdc_agent_name} assigned {lastAssignment.customer_name || "a customer"} to{" "}
                {lastAssignment.salesperson_name} for {lastAssignment.lead_store || lastAssignment.salesperson_dealership} at{" "}
                {dateTimeLabel(lastAssignment.assigned_at)}
              </div>
            ) : null}

            {!bdcClosedToday && activeLeadStoreSales.length && !bdcState?.next_salesperson ? (
              <div className="notice">
                Nobody is eligible in the {leadForm.leadStore} round robin today because every active salesperson in that store is scheduled off.
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
                    {DEALERSHIP_ORDER.map((dealership) => (
                      <option key={`report-store-${dealership}`} value={dealership}>
                        {dealership}
                      </option>
                    ))}
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
                          <span className="eyebrow">Selected day</span>
                          <h3>{longDateLabel(selectedTrafficDate)}</h3>
                          <p className="admin-note">
                            Sales staff can only edit the notes field from the public page. Everything else stays admin
                            controlled here.
                          </p>
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
