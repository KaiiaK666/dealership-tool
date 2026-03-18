import React, { useEffect, useState } from "react";
import {
  adminLogin,
  assignBdcLead,
  createBdcAgent,
  createSalesperson,
  generateServiceDrive,
  getAdminSession,
  getBdcAgents,
  getBdcLog,
  getBdcReport,
  getBdcState,
  getSalespeople,
  getServiceDrive,
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

const WEEKDAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
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

function dateLabel(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
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

function toggleDay(list, day) {
  return list.includes(day)
    ? list.filter((item) => item !== day)
    : [...list, day].sort((a, b) => a - b);
}

function buildCalendarCells(days) {
  if (!days.length) return [];
  const firstOffset = dateParts(days[0].date).weekdayIndex;
  return [...Array.from({ length: firstOffset }, () => null), ...days];
}

function DayOffPicker({ value, onChange }) {
  return (
    <div className="dayoff-picker">
      {WEEKDAYS.map((day) => (
        <button
          key={day.value}
          type="button"
          className={`day-chip ${value.includes(day.value) ? "is-active" : ""}`}
          onClick={() => onChange(toggleDay(value, day.value))}
        >
          {day.label}
        </button>
      ))}
    </div>
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
  const [month, setMonth] = useState(currentMonth());
  const [salespeople, setSalespeople] = useState([]);
  const [bdcAgents, setBdcAgents] = useState([]);
  const [serviceMonth, setServiceMonth] = useState(null);
  const [bdcState, setBdcState] = useState(null);
  const [bdcLog, setBdcLog] = useState({ total: 0, entries: [] });
  const [bdcReport, setBdcReport] = useState(null);
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
                  <small>{bdcState?.next_salesperson?.dealership || "Round robin is empty"}</small>
                </div>
                <button type="button" onClick={assignLead} disabled={busy === "assign" || !activeBdc.length}>
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
                          onChange={(event) => setSalesForm((current) => ({ ...current, dealership: event.target.value }))}
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
                      <div>
                        <span>Weekly days off</span>
                        <DayOffPicker
                          value={salesForm.weekly_days_off}
                          onChange={(days) => setSalesForm((current) => ({ ...current, weekly_days_off: days }))}
                        />
                      </div>
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
                            <div>
                              <span>Weekly days off</span>
                              <DayOffPicker
                                value={person.weekly_days_off}
                                onChange={(days) =>
                                  setSalespeople((current) =>
                                    current.map((item) =>
                                      item.id === person.id ? { ...item, weekly_days_off: days } : item
                                    )
                                  )
                                }
                              />
                            </div>
                            <button type="button" onClick={() => saveSalesperson(person)} disabled={busy === `sales-${person.id}`}>
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
                                    current.map((item) => (item.id === agent.id ? { ...item, name: event.target.value } : item))
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
                                    current.map((item) => (item.id === agent.id ? { ...item, active: event.target.checked } : item))
                                  )
                                }
                              />
                              <span>Active</span>
                            </label>
                            <button type="button" onClick={() => saveBdcAgent(agent)} disabled={busy === `bdc-${agent.id}`}>
                              {busy === `bdc-${agent.id}` ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </EditorCard>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
