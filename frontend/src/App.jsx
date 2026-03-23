import React, { useEffect, useState } from "react";
import {
  adminLogin,
  assignBdcLead,
  createBdcAgent,
  createSalesperson,
  createServiceDriveNote,
  generateServiceDrive,
  getAdminDaysOff,
  getAdminSession,
  getBdcAgents,
  getBdcLog,
  getBdcReport,
  getBdcState,
  getSalespeople,
  getServiceDrive,
  getServiceDriveNotes,
  updateAdminDaysOff,
  updateBdcAgent,
  updateSalesperson,
  updateServiceDriveAssignment,
  updateServiceDriveNote,
  updateServiceDriveSalesNote,
} from "./api.js";
import "./App.css";

const TABS = [
  { id: "serviceCalendar", label: "Service Drive Calendar" },
  { id: "serviceNotes", label: "Service Drive Notes" },
  { id: "bdc", label: "BDC Assign" },
  { id: "reports", label: "BDC Reports" },
  { id: "traffic", label: "Service Drive Traffic" },
  { id: "admin", label: "Admin" },
];

const ADMIN_SECTIONS = [
  { id: "staff", label: "Staff Setup" },
  { id: "daysOff", label: "Days Off" },
  { id: "serviceNotes", label: "Service Notes" },
];

const DEALERSHIP_ORDER = ["Kia", "Mazda", "Outlet"];
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

function currentDateTimeInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function defaultServiceNoteForm() {
  return {
    appointmentAt: currentDateTimeInput(),
    brand: "Kia",
    customerName: "",
    customerPhone: "",
    adminNotes: "",
  };
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

function errText(error) {
  if (!error) return "Request failed";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return "Request failed";
}

function buildCalendarCells(days) {
  if (!days.length) return [];
  const firstOffset = dateParts(days[0].date).weekdayIndex;
  return [...Array.from({ length: firstOffset }, () => null), ...days];
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

function LogTable({ entries, empty }) {
  if (!entries.length) return <div className="empty">{empty}</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>BDC Agent</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Salesperson</th>
            <th>Store</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{dateTimeLabel(entry.assigned_at)}</td>
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

export default function App() {
  const [tab, setTab] = useState("serviceCalendar");
  const [adminSection, setAdminSection] = useState("staff");
  const [month, setMonth] = useState(currentMonth());
  const [daysOffMonth, setDaysOffMonth] = useState(currentMonth());
  const [serviceNotesFilters, setServiceNotesFilters] = useState({
    salespersonId: "",
    startDate: todayDateValue(),
    endDate: "",
    brand: "",
  });
  const [salespeople, setSalespeople] = useState([]);
  const [bdcAgents, setBdcAgents] = useState([]);
  const [serviceMonth, setServiceMonth] = useState(null);
  const [serviceNotesData, setServiceNotesData] = useState({ total: 0, entries: [] });
  const [bdcState, setBdcState] = useState(null);
  const [bdcLog, setBdcLog] = useState({ total: 0, entries: [] });
  const [bdcReport, setBdcReport] = useState(null);
  const [daysOffData, setDaysOffData] = useState({ month: currentMonth(), entries: [] });
  const [selectedDaysOffSalesId, setSelectedDaysOffSalesId] = useState("");
  const [filters, setFilters] = useState({ salespersonId: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastAssignment, setLastAssignment] = useState(null);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("dealer_tool_admin") || "");
  const [adminSession, setAdminSession] = useState(null);
  const [login, setLogin] = useState({ username: "admin", password: "admin123" });
  const [salesForm, setSalesForm] = useState({ name: "", dealership: "Kia", weekly_days_off: [], active: true });
  const [bdcForm, setBdcForm] = useState({ name: "", active: true });
  const [leadForm, setLeadForm] = useState({ bdcAgentId: "", customerName: "", customerPhone: "" });
  const [serviceNoteForm, setServiceNoteForm] = useState(defaultServiceNoteForm());

  const activeSales = salespeople.filter((person) => person.active);
  const serviceEligible = activeSales.filter((person) => person.dealership !== "Outlet");
  const activeBdc = bdcAgents.filter((agent) => agent.active);
  const serviceCalendarCells = buildCalendarCells(serviceMonth?.days || []);
  const daysOffMonthCells = buildMonthDateCells(daysOffMonth);
  const today = todayDateValue();
  const dealershipColumns = DEALERSHIP_ORDER.map((dealership) => ({
    dealership,
    people: salespeople.filter((person) => person.dealership === dealership),
  }));
  const daysOffEntriesBySalesperson = new Map(daysOffData.entries.map((entry) => [entry.salesperson_id, entry.off_dates]));
  const selectedDaysOffSalesperson =
    salespeople.find((person) => String(person.id) === String(selectedDaysOffSalesId)) || salespeople[0] || null;
  const selectedDaysOffDates = selectedDaysOffSalesperson
    ? daysOffEntriesBySalesperson.get(selectedDaysOffSalesperson.id) || []
    : [];
  const selectedServiceNotesSalesId = serviceNotesFilters.salespersonId ? Number(serviceNotesFilters.salespersonId) : null;
  const selectedServiceNotesSalesperson =
    serviceEligible.find((person) => person.id === selectedServiceNotesSalesId) || null;
  const serviceNotesMissingCount = serviceNotesData.entries.filter((entry) => !entry.sales_notes?.trim()).length;
  const monthDaysOffSummary = monthDateValues(daysOffMonth).map((value) => ({
    date: value,
    people: activeSales.filter((person) => (daysOffEntriesBySalesperson.get(person.id) || []).includes(value)),
  }));

  async function loadAll(nextMonth = month, nextFilters = filters) {
    const [sales, bdc, service, state, log, report] = await Promise.all([
      getSalespeople({ includeInactive: true }),
      getBdcAgents({ includeInactive: true }),
      getServiceDrive({ month: nextMonth }),
      getBdcState(),
      getBdcLog({
        salespersonId: nextFilters.salespersonId || undefined,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
        limit: 150,
      }),
      getBdcReport({
        salespersonId: nextFilters.salespersonId || undefined,
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
      }),
    ]);
    setSalespeople(sales);
    setBdcAgents(bdc);
    setServiceMonth(service);
    setBdcState(state);
    setBdcLog(log);
    setBdcReport(report);
  }

  async function refreshServiceNotes(nextFilters = serviceNotesFilters) {
    const data = await getServiceDriveNotes({
      salespersonId: nextFilters.salespersonId || undefined,
      startDate: nextFilters.startDate || undefined,
      endDate: nextFilters.endDate || undefined,
      brand: nextFilters.brand || undefined,
      limit: 300,
    });
    setServiceNotesData(data);
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
  }, [month, filters.salespersonId, filters.startDate, filters.endDate]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const data = await getServiceDriveNotes({
          salespersonId: serviceNotesFilters.salespersonId || undefined,
          startDate: serviceNotesFilters.startDate || undefined,
          endDate: serviceNotesFilters.endDate || undefined,
          brand: serviceNotesFilters.brand || undefined,
          limit: 300,
        });
        if (active) setServiceNotesData(data);
      } catch (errorValue) {
        if (active) setError(errText(errorValue));
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [serviceNotesFilters.salespersonId, serviceNotesFilters.startDate, serviceNotesFilters.endDate, serviceNotesFilters.brand]);

  useEffect(() => {
    if (!leadForm.bdcAgentId && activeBdc.length) {
      setLeadForm((current) => ({ ...current, bdcAgentId: String(activeBdc[0].id) }));
    }
  }, [leadForm.bdcAgentId, activeBdc]);

  useEffect(() => {
    if (!selectedDaysOffSalesId && salespeople.length) {
      setSelectedDaysOffSalesId(String(salespeople[0].id));
      return;
    }
    if (selectedDaysOffSalesId && !salespeople.some((person) => String(person.id) === String(selectedDaysOffSalesId))) {
      setSelectedDaysOffSalesId(salespeople.length ? String(salespeople[0].id) : "");
    }
  }, [selectedDaysOffSalesId, salespeople]);

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
      await loadAll(month, filters);
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

  async function saveDaysOff(personId, offDates) {
    setBusy(`days-off-${personId}`);
    setError("");
    try {
      const data = await updateAdminDaysOff(adminToken, {
        salesperson_id: personId,
        month: daysOffMonth,
        off_dates: offDates,
      });
      setDaysOffData(data);
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
      await refreshServiceNotes();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  function patchServiceNoteEntry(noteId, patch) {
    setServiceNotesData((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.id === noteId ? { ...entry, ...patch } : entry)),
    }));
  }

  async function addServiceNote(event) {
    event.preventDefault();
    setBusy("add-service-note");
    setError("");
    try {
      await createServiceDriveNote(adminToken, {
        appointment_at: serviceNoteForm.appointmentAt,
        brand: serviceNoteForm.brand,
        customer_name: serviceNoteForm.customerName,
        customer_phone: serviceNoteForm.customerPhone,
        admin_notes: serviceNoteForm.adminNotes,
      });
      setServiceNoteForm(defaultServiceNoteForm());
      await refreshServiceNotes();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveServiceNote(entry) {
    setBusy(`service-note-admin-${entry.id}`);
    setError("");
    try {
      const saved = await updateServiceDriveNote(adminToken, entry.id, {
        appointment_at: entry.appointment_at,
        brand: entry.brand,
        customer_name: entry.customer_name,
        customer_phone: entry.customer_phone,
        admin_notes: entry.admin_notes,
      });
      patchServiceNoteEntry(entry.id, saved);
      await refreshServiceNotes();
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function saveSalesNote(entry) {
    if (!selectedServiceNotesSalesId) {
      setError("Choose your salesperson name first.");
      return;
    }
    setBusy(`service-note-sales-${entry.id}`);
    setError("");
    try {
      const saved = await updateServiceDriveSalesNote(entry.id, {
        salesperson_id: selectedServiceNotesSalesId,
        sales_notes: entry.sales_notes,
      });
      patchServiceNoteEntry(entry.id, saved);
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
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
          <div>
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
          <section className="stack">
            <div className="panel row">
              <div>
                <span className="eyebrow">Service drive month</span>
                <h2>{monthLabel(month)}</h2>
              </div>
              <div className="controls">
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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

                      <div className="calendar-day__assignments">
                        {[
                          ["Kia", day.kia],
                          ["Mazda", day.mazda],
                        ].map(([brand, slot]) => (
                          <div key={brand} className="assignment">
                            <div className="assignment__summary">
                              <span className="assignment__brand">{brand}</span>
                              <strong>{slot.salesperson_name || "Open"}</strong>
                              <small>{slot.salesperson_dealership || "No assignment"}</small>
                            </div>
                            {adminSession ? (
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
          </section>
        ) : null}

        {tab === "serviceNotes" ? (
          <section className="stack">
            <div className="panel">
              <div className="row">
                <div>
                  <span className="eyebrow">Service drive notes</span>
                  <h2>Traffic notes tied to the daily service schedule</h2>
                  <p className="admin-note">
                    Choose your salesperson name to unlock note saving for only your assigned appointments. Admin notes stay
                    read-only on this page.
                  </p>
                </div>
              </div>
              <div className="filters filters--notes">
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={serviceNotesFilters.startDate}
                    onChange={(event) => setServiceNotesFilters((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>End date</span>
                  <input
                    type="date"
                    value={serviceNotesFilters.endDate}
                    onChange={(event) => setServiceNotesFilters((current) => ({ ...current, endDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Store</span>
                  <select
                    value={serviceNotesFilters.brand}
                    onChange={(event) => setServiceNotesFilters((current) => ({ ...current, brand: event.target.value }))}
                  >
                    <option value="">All stores</option>
                    <option value="Kia">Kia</option>
                    <option value="Mazda">Mazda</option>
                  </select>
                </label>
                <label>
                  <span>Salesperson</span>
                  <select
                    value={serviceNotesFilters.salespersonId}
                    onChange={(event) =>
                      setServiceNotesFilters((current) => ({ ...current, salespersonId: event.target.value }))
                    }
                  >
                    <option value="">View all appointments</option>
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
                <span>Appointments in view</span>
                <strong>{serviceNotesData.total}</strong>
              </div>
              <div className="stat">
                <span>Still missing salesperson notes</span>
                <strong>{serviceNotesMissingCount}</strong>
              </div>
              <div className="stat">
                <span>Selected salesperson</span>
                <strong>{selectedServiceNotesSalesperson?.name || "None"}</strong>
              </div>
            </div>

            <div className="notes-list">
              {serviceNotesData.entries.length ? (
                serviceNotesData.entries.map((entry) => {
                  const canEditSales =
                    selectedServiceNotesSalesId !== null && entry.salesperson_id === selectedServiceNotesSalesId;

                  return (
                    <article key={entry.id} className="note-card">
                      <div className="note-card__top">
                        <div>
                          <span className="eyebrow">Service appointment</span>
                          <h3>{entry.customer_name}</h3>
                          <p className="note-card__subtitle">{dateTimeLabel(entry.appointment_at)}</p>
                        </div>
                        <span className={`brand-pill brand-pill--${entry.brand.toLowerCase()}`}>{entry.brand}</span>
                      </div>

                      <div className="note-meta">
                        <div className="meta-item">
                          <span>Phone</span>
                          <strong>{entry.customer_phone || "No phone"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Assigned salesperson</span>
                          <strong>{entry.salesperson_name || "Open service slot"}</strong>
                        </div>
                        <div className="meta-item">
                          <span>Store</span>
                          <strong>{entry.brand}</strong>
                        </div>
                      </div>

                      <div className="note-copy">
                        <div className="note-copy__block is-readonly">
                          <span>Admin notes</span>
                          <p>{entry.admin_notes || "No admin notes yet."}</p>
                        </div>

                        <label className="note-copy__block">
                          <span>Salesperson notes</span>
                          <textarea
                            rows={5}
                            value={entry.sales_notes}
                            disabled={!canEditSales}
                            onChange={(event) => patchServiceNoteEntry(entry.id, { sales_notes: event.target.value })}
                          />
                        </label>
                      </div>

                      <div className="note-actions">
                        <small>
                          {canEditSales
                            ? "You can only update the salesperson notes field on this appointment."
                            : selectedServiceNotesSalesId
                              ? "This appointment is not assigned to your selected salesperson today."
                              : "Pick your salesperson name above to unlock note saving."}
                        </small>
                        <button
                          type="button"
                          onClick={() => saveSalesNote(entry)}
                          disabled={!canEditSales || busy === `service-note-sales-${entry.id}`}
                        >
                          {busy === `service-note-sales-${entry.id}` ? "Saving..." : "Save Notes"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty">No service appointments match these filters.</div>
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
                <p>Choose the BDC agent, enter the customer details, then assign the lead and log it for reporting.</p>
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
                  <span>Next up</span>
                  <strong>{bdcState?.next_salesperson?.name || "No active salesperson"}</strong>
                  <small>
                    {bdcState?.next_salesperson?.dealership ||
                      (activeSales.length ? "Everyone scheduled today is off" : "Round robin is empty")}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={assignLead}
                  disabled={busy === "assign" || !activeBdc.length || !bdcState?.next_salesperson}
                >
                  {busy === "assign" ? "Assigning..." : "Assign Next Lead"}
                </button>
              </div>
            </div>

            {lastAssignment ? (
              <div className="notice success">
                {lastAssignment.bdc_agent_name} assigned {lastAssignment.customer_name || "a customer"} to{" "}
                {lastAssignment.salesperson_name} at {dateTimeLabel(lastAssignment.assigned_at)}
              </div>
            ) : null}

            {activeSales.length && !bdcState?.next_salesperson ? (
              <div className="notice">
                Nobody is eligible in the round robin today because every active salesperson is scheduled off.
              </div>
            ) : null}

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
                          Pick one salesperson, mark their exact dates off for the month, then save. Those dates block
                          both service-drive assignments and BDC round-robin leads.
                        </p>
                      </div>
                      <div className="controls">
                        <input type="month" value={daysOffMonth} onChange={(event) => setDaysOffMonth(event.target.value)} />
                        <select
                          value={selectedDaysOffSalesId}
                          onChange={(event) => setSelectedDaysOffSalesId(event.target.value)}
                        >
                          <option value="">Choose salesperson</option>
                          {salespeople.map((person) => (
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
                        <h3>Schedule in order</h3>
                        <div className="days-off-people">
                          {salespeople.map((person) => {
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
                                onClick={() => saveDaysOff(selectedDaysOffSalesperson.id, selectedDaysOffDates)}
                                disabled={busy === `days-off-${selectedDaysOffSalesperson.id}`}
                              >
                                {busy === `days-off-${selectedDaysOffSalesperson.id}` ? "Saving..." : "Save Month"}
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

                {adminSection === "serviceNotes" ? (
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
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
