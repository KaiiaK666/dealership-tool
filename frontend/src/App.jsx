import React, { useEffect, useState } from "react";
import {
  adminLogin,
  assignBdcLead,
  createBdcAgent,
  createSalesperson,
  generateServiceDrive,
  getAdminDaysOff,
  getAdminSession,
  getBdcAgents,
  getBdcLog,
  getBdcReport,
  getBdcState,
  getSalespeople,
  getServiceDrive,
  updateAdminDaysOff,
  updateBdcAgent,
  updateSalesperson,
  updateServiceDriveAssignment,
} from "./api.js";
import "./App.css";

const TABS = [
  { id: "service", label: "Service Drive" },
  { id: "bdc", label: "BDC Assign" },
  { id: "reports", label: "BDC Reports" },
  { id: "traffic", label: "Service Drive Traffic" },
  { id: "admin", label: "Admin" },
];

const ADMIN_SECTIONS = [
  { id: "staff", label: "Staff Setup" },
  { id: "daysOff", label: "Days Off" },
];

const TRAFFIC_URL = "https://bokbbui-production.up.railway.app/";
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
            <th>Salesperson</th>
            <th>Store</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{dateTimeLabel(entry.assigned_at)}</td>
              <td>{entry.bdc_agent_name}</td>
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
  const [tab, setTab] = useState("service");
  const [adminSection, setAdminSection] = useState("staff");
  const [month, setMonth] = useState(currentMonth());
  const [daysOffMonth, setDaysOffMonth] = useState(currentMonth());
  const [salespeople, setSalespeople] = useState([]);
  const [bdcAgents, setBdcAgents] = useState([]);
  const [serviceMonth, setServiceMonth] = useState(null);
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
  const [assignBdcId, setAssignBdcId] = useState("");

  const activeSales = salespeople.filter((person) => person.active);
  const serviceEligible = activeSales.filter((person) => person.dealership !== "Outlet");
  const activeBdc = bdcAgents.filter((agent) => agent.active);
  const serviceCalendarCells = buildCalendarCells(serviceMonth?.days || []);
  const daysOffMonthCells = buildMonthDateCells(daysOffMonth);
  const daysOffEntriesBySalesperson = new Map(daysOffData.entries.map((entry) => [entry.salesperson_id, entry.off_dates]));
  const selectedDaysOffSalesperson =
    salespeople.find((person) => String(person.id) === String(selectedDaysOffSalesId)) || salespeople[0] || null;
  const selectedDaysOffDates = selectedDaysOffSalesperson
    ? daysOffEntriesBySalesperson.get(selectedDaysOffSalesperson.id) || []
    : [];
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
    if (!assignBdcId && activeBdc.length) {
      setAssignBdcId(String(activeBdc[0].id));
    }
  }, [assignBdcId, activeBdc]);

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
    } catch (errorValue) {
      setError(errText(errorValue));
    } finally {
      setBusy("");
    }
  }

  async function assignLead() {
    if (!assignBdcId) {
      setError("Choose a BDC agent first.");
      return;
    }
    setBusy("assign");
    setError("");
    try {
      const result = await assignBdcLead({ bdc_agent_id: Number(assignBdcId) });
      setLastAssignment(result);
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
            <span className="eyebrow">Dealership Tool</span>
            <h1>Service drive scheduling and BDC lead distribution.</h1>
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

        {tab === "service" ? (
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
                      className={`calendar-day ${parts.weekdayIndex === 0 || parts.weekdayIndex === 6 ? "is-weekend" : ""}`}
                    >
                      <div className="calendar-day__header">
                        <span className="calendar-day__weekday">{day.day_label}</span>
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

        {tab === "bdc" ? (
          <section className="stack">
            <div className="panel lead-grid">
              <div>
                <span className="eyebrow">BDC lead assign</span>
                <h2>Ask for the next salesperson in the round robin.</h2>
                <p>Choose the BDC agent, click assign, then use the returned name in your CRM.</p>
              </div>
              <div className="assign-card">
                <label>
                  <span>BDC agent</span>
                  <select value={assignBdcId} onChange={(event) => setAssignBdcId(event.target.value)}>
                    <option value="">Choose an agent</option>
                    {activeBdc.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
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
                {lastAssignment.bdc_agent_name} assigned {lastAssignment.salesperson_name} at{" "}
                {dateTimeLabel(lastAssignment.assigned_at)}
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

                    <div className="admin-grid">
                      <div className="panel">
                        <span className="eyebrow">Edit salespeople</span>
                        <div className="editor-list">
                          {salespeople.map((person) => (
                            <EditorCard key={person.id} title={`${person.name} - ${person.dealership}`}>
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
                          ))}
                        </div>
                      </div>

                      <div className="panel">
                        <span className="eyebrow">Edit BDC agents</span>
                        <div className="editor-list">
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
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
