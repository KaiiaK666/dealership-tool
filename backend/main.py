import calendar
import os
import secrets
import sqlite3
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


DB_PATH = os.getenv(
    "DEALER_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "dealership.db"),
)
RULES_TIMEZONE = os.getenv("DEALER_TIMEZONE", "America/Chicago").strip() or "America/Chicago"
ADMIN_USERNAME = os.getenv("DEALER_ADMIN_USERNAME", "admin").strip() or "admin"
ADMIN_PASSWORD = os.getenv("DEALER_ADMIN_PASSWORD", "admin123").strip() or "admin123"
SESSION_SECONDS = max(900, int(os.getenv("DEALER_ADMIN_SESSION_SECONDS", "43200") or 43200))
DEALERSHIPS = ("Kia", "Mazda", "Outlet")
SERVICE_BRANDS = ("Kia", "Mazda")
DEFAULT_CORS_ORIGINS = [
    "http://localhost:4183",
    "http://127.0.0.1:4183",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://dealership-tool-web.onrender.com",
    "https://app.bertogden123.com",
    "https://bertogden123.com",
    "https://www.bertogden123.com",
]
EXTRA_CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DEALER_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ORIGINS = list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *EXTRA_CORS_ORIGINS]))

app = FastAPI(title="Dealership Tool")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_lock = threading.Lock()
db_conn: Optional[sqlite3.Connection] = None
admin_sessions: Dict[str, Dict[str, Any]] = {}


class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminSessionOut(BaseModel):
    token: str
    username: str
    expires_ts: float


class AdminStatusOut(BaseModel):
    username: str
    expires_ts: float


class SalespersonIn(BaseModel):
    name: str
    dealership: str
    weekly_days_off: List[int] = []
    active: bool = True


class SalespersonOut(BaseModel):
    id: int
    name: str
    dealership: str
    weekly_days_off: List[int]
    active: bool
    created_ts: float
    updated_ts: float


class BdcAgentIn(BaseModel):
    name: str
    active: bool = True


class BdcAgentOut(BaseModel):
    id: int
    name: str
    active: bool
    created_ts: float
    updated_ts: float


class DaysOffEntryOut(BaseModel):
    salesperson_id: int
    off_dates: List[str]


class DaysOffMonthOut(BaseModel):
    month: str
    entries: List[DaysOffEntryOut]


class DaysOffMonthIn(BaseModel):
    salesperson_id: int
    month: str
    off_dates: List[str] = []


class ServiceSlotOut(BaseModel):
    brand: str
    salesperson_id: Optional[int] = None
    salesperson_name: Optional[str] = None
    salesperson_dealership: Optional[str] = None


class ServiceDayOut(BaseModel):
    date: str
    day_label: str
    kia: ServiceSlotOut
    mazda: ServiceSlotOut


class ServiceMonthOut(BaseModel):
    month: str
    total_days: int
    total_slots: int
    assigned_slots: int
    days: List[ServiceDayOut]


class ServiceGenerateIn(BaseModel):
    month: str
    overwrite: bool = False


class ServiceAssignmentIn(BaseModel):
    schedule_date: str
    brand: str
    salesperson_id: Optional[int] = None


class BdcLeadAssignIn(BaseModel):
    bdc_agent_id: Optional[int] = None
    bdc_agent_name: Optional[str] = None
    customer_name: str = ""
    customer_phone: str = ""


class BdcAssignmentOut(BaseModel):
    id: int
    assigned_ts: float
    assigned_at: str
    bdc_agent_id: Optional[int] = None
    bdc_agent_name: str
    salesperson_id: int
    salesperson_name: str
    salesperson_dealership: str
    customer_name: str = ""
    customer_phone: str = ""


class BdcStateOut(BaseModel):
    next_index: int
    next_salesperson: Optional[SalespersonOut] = None
    queue: List[SalespersonOut]


class BdcLogOut(BaseModel):
    total: int
    entries: List[BdcAssignmentOut]


class BdcReportRowOut(BaseModel):
    salesperson_id: Optional[int] = None
    salesperson_name: str
    dealership: str
    assignments: int


class BdcReportOut(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    salesperson_id: Optional[int] = None
    total_assignments: int
    filtered_assignments: int
    active_salespeople: int
    expected_min: int
    expected_max: int
    selected_salesperson_actual: int
    rows: List[BdcReportRowOut]


class ServiceDriveNoteIn(BaseModel):
    appointment_at: str
    brand: str
    customer_name: str
    customer_phone: str = ""
    admin_notes: str = ""


class ServiceDriveSalesNoteIn(BaseModel):
    salesperson_id: Optional[int] = None
    sales_notes: str = ""


class ServiceDriveNoteOut(BaseModel):
    id: int
    appointment_at: str
    appointment_date: str
    brand: str
    customer_name: str
    customer_phone: str
    admin_notes: str
    sales_notes: str
    salesperson_id: Optional[int] = None
    salesperson_name: Optional[str] = None
    salesperson_dealership: Optional[str] = None
    created_ts: float
    updated_ts: float


class ServiceDriveNotesOut(BaseModel):
    total: int
    entries: List[ServiceDriveNoteOut]


def now_local() -> datetime:
    return datetime.now(ZoneInfo(RULES_TIMEZONE))


def now_iso() -> str:
    return now_local().replace(microsecond=0).isoformat()


def date_to_ts(day: date, *, end_exclusive: bool = False) -> float:
    dt = datetime(day.year, day.month, day.day, tzinfo=ZoneInfo(RULES_TIMEZONE))
    if end_exclusive:
        dt += timedelta(days=1)
    return dt.timestamp()


def normalize_name(value: str, field_name: str) -> str:
    text = " ".join(str(value or "").strip().split())
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")
    if len(text) > 120:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return text


def normalize_short_text(value: str, field_name: str, max_len: int = 160) -> str:
    text = " ".join(str(value or "").strip().split())
    if len(text) > max_len:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return text


def normalize_notes(value: str, field_name: str, max_len: int = 4000) -> str:
    text = str(value or "").replace("\r\n", "\n").strip()
    if len(text) > max_len:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return text


def normalize_dealership(value: str) -> str:
    mapping = {item.lower(): item for item in DEALERSHIPS}
    normalized = mapping.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="dealership must be Kia, Mazda, or Outlet")
    return normalized


def normalize_brand(value: str) -> str:
    mapping = {item.lower(): item for item in SERVICE_BRANDS}
    normalized = mapping.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="brand must be Kia or Mazda")
    return normalized


def normalize_days_off(value: Any) -> List[int]:
    items = value if isinstance(value, list) else str(value or "").split(",")
    days: List[int] = []
    for item in items:
        try:
            day = int(item)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="weekly_days_off must contain weekday numbers 0-6") from exc
        if day < 0 or day > 6:
            raise HTTPException(status_code=400, detail="weekly_days_off must contain weekday numbers 0-6")
        if day not in days:
            days.append(day)
    days.sort()
    return days


def days_to_text(value: Any) -> str:
    return ",".join(str(day) for day in normalize_days_off(value))


def text_to_days(value: Any) -> List[int]:
    text = str(value or "").strip()
    if not text:
        return []
    return normalize_days_off(text.split(","))


def parse_month_key(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="month is required")
    try:
        parsed = datetime.strptime(text, "%Y-%m")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="month must be YYYY-MM") from exc
    return parsed.strftime("%Y-%m")


def parse_iso_date(value: str, field_name: str) -> date:
    text = str(value or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be YYYY-MM-DD") from exc


def parse_local_datetime(value: str, field_name: str) -> Tuple[str, str, float]:
    text = str(value or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")

    parsed: Optional[datetime] = None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
            break
        except ValueError:
            continue

    if parsed is None:
        raise HTTPException(status_code=400, detail=f"{field_name} must be YYYY-MM-DDTHH:MM")

    local_dt = parsed.replace(second=0, microsecond=0, tzinfo=ZoneInfo(RULES_TIMEZONE))
    return local_dt.strftime("%Y-%m-%dT%H:%M"), local_dt.date().isoformat(), local_dt.timestamp()


def month_dates(month_key: str) -> List[date]:
    year_text, month_text = month_key.split("-")
    year = int(year_text)
    month_num = int(month_text)
    count = calendar.monthrange(year, month_num)[1]
    return [date(year, month_num, day) for day in range(1, count + 1)]


def month_date_bounds(month_key: str) -> Tuple[str, str]:
    dates = month_dates(month_key)
    start_day = dates[0]
    end_day = dates[-1] + timedelta(days=1)
    return start_day.isoformat(), end_day.isoformat()


def fetch_days_off_lookup(start_day: date, end_day: date) -> set[Tuple[int, str]]:
    end_exclusive = end_day + timedelta(days=1)
    rows = db_query_all(
        """
        SELECT salesperson_id, off_date
        FROM salesperson_days_off
        WHERE off_date >= ? AND off_date < ?
        """,
        (start_day.isoformat(), end_exclusive.isoformat()),
    )
    return {
        (int(row.get("salesperson_id") or 0), str(row.get("off_date") or ""))
        for row in rows
        if row.get("salesperson_id") is not None and row.get("off_date")
    }


def salesperson_is_off(
    person: SalespersonOut,
    on_day: date,
    off_lookup: Optional[set[Tuple[int, str]]] = None,
) -> bool:
    key = (person.id, on_day.isoformat())
    if off_lookup is not None:
        return key in off_lookup
    return (
        db_query_one(
            "SELECT 1 AS found FROM salesperson_days_off WHERE salesperson_id = ? AND off_date = ?",
            (person.id, on_day.isoformat()),
        )
        is not None
    )


def get_db() -> sqlite3.Connection:
    global db_conn
    if db_conn is None:
        db_dir = os.path.dirname(DB_PATH)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        db_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        db_conn.row_factory = sqlite3.Row
    return db_conn


def db_execute(query: str, params: Tuple[Any, ...] = ()) -> None:
    with db_lock:
        conn = get_db()
        conn.execute(query, params)
        conn.commit()


def db_insert(query: str, params: Tuple[Any, ...] = ()) -> int:
    with db_lock:
        conn = get_db()
        cur = conn.execute(query, params)
        conn.commit()
        return int(cur.lastrowid)


def db_query_all(query: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    with db_lock:
        rows = get_db().execute(query, params).fetchall()
    return [dict(row) for row in rows]


def db_query_one(query: str, params: Tuple[Any, ...] = ()) -> Optional[Dict[str, Any]]:
    with db_lock:
        row = get_db().execute(query, params).fetchone()
    return dict(row) if row else None


def table_columns(table_name: str) -> set[str]:
    rows = db_query_all(f"PRAGMA table_info({table_name})")
    return {str(row.get("name") or "") for row in rows}


def ensure_column(table_name: str, column_name: str, definition: str) -> None:
    if column_name in table_columns(table_name):
        return
    db_execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def get_meta(key: str) -> Optional[str]:
    row = db_query_one("SELECT value FROM meta WHERE key = ?", (key,))
    return str(row.get("value")) if row else None


def set_meta(key: str, value: str) -> None:
    db_execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def init_db() -> None:
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS salespeople (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            dealership TEXT NOT NULL,
            weekly_days_off TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS salesperson_days_off (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            salesperson_id INTEGER NOT NULL,
            off_date TEXT NOT NULL,
            created_ts REAL NOT NULL,
            UNIQUE(salesperson_id, off_date)
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS service_drive_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_date TEXT NOT NULL,
            month_key TEXT NOT NULL,
            brand TEXT NOT NULL,
            salesperson_id INTEGER,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL,
            UNIQUE(schedule_date, brand)
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_assignment_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            assigned_ts REAL NOT NULL,
            assigned_at TEXT NOT NULL,
            bdc_agent_id INTEGER,
            bdc_agent_name TEXT NOT NULL,
            salesperson_id INTEGER NOT NULL,
            salesperson_name TEXT NOT NULL,
            salesperson_dealership TEXT NOT NULL
        )
        """
    )
    ensure_column("bdc_assignment_log", "customer_name", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_assignment_log", "customer_phone", "TEXT NOT NULL DEFAULT ''")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS service_drive_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_at TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            appointment_ts REAL NOT NULL,
            brand TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL DEFAULT '',
            admin_notes TEXT NOT NULL DEFAULT '',
            sales_notes TEXT NOT NULL DEFAULT '',
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )


def prune_sessions() -> None:
    now_ts = time.time()
    expired = [token for token, session in admin_sessions.items() if float(session.get("expires_ts") or 0.0) <= now_ts]
    for token in expired:
        admin_sessions.pop(token, None)


def require_admin(token: Optional[str]) -> Dict[str, Any]:
    prune_sessions()
    session = admin_sessions.get((token or "").strip())
    if not session:
        raise HTTPException(status_code=403, detail="admin login required")
    return session


def issue_session() -> AdminSessionOut:
    prune_sessions()
    token = secrets.token_urlsafe(24)
    expires_ts = time.time() + SESSION_SECONDS
    admin_sessions[token] = {"username": ADMIN_USERNAME, "expires_ts": expires_ts}
    return AdminSessionOut(token=token, username=ADMIN_USERNAME, expires_ts=expires_ts)


def salesperson_out(row: Dict[str, Any]) -> SalespersonOut:
    return SalespersonOut(
        id=int(row.get("id") or 0),
        name=str(row.get("name") or ""),
        dealership=str(row.get("dealership") or ""),
        weekly_days_off=text_to_days(row.get("weekly_days_off")),
        active=bool(int(row.get("active") or 0)),
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def bdc_agent_out(row: Dict[str, Any]) -> BdcAgentOut:
    return BdcAgentOut(
        id=int(row.get("id") or 0),
        name=str(row.get("name") or ""),
        active=bool(int(row.get("active") or 0)),
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def bdc_log_out(row: Dict[str, Any]) -> BdcAssignmentOut:
    return BdcAssignmentOut(
        id=int(row.get("id") or 0),
        assigned_ts=float(row.get("assigned_ts") or 0.0),
        assigned_at=str(row.get("assigned_at") or ""),
        bdc_agent_id=int(row["bdc_agent_id"]) if row.get("bdc_agent_id") is not None else None,
        bdc_agent_name=str(row.get("bdc_agent_name") or ""),
        salesperson_id=int(row.get("salesperson_id") or 0),
        salesperson_name=str(row.get("salesperson_name") or ""),
        salesperson_dealership=str(row.get("salesperson_dealership") or ""),
        customer_name=str(row.get("customer_name") or ""),
        customer_phone=str(row.get("customer_phone") or ""),
    )


def get_salesperson_row(salesperson_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM salespeople WHERE id = ?", (int(salesperson_id),))


def get_bdc_agent_row(agent_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM bdc_agents WHERE id = ?", (int(agent_id),))


def get_service_note_row(note_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one(
        """
        SELECT
            n.*,
            s.salesperson_id,
            p.name AS salesperson_name,
            p.dealership AS salesperson_dealership
        FROM service_drive_notes n
        LEFT JOIN service_drive_assignments s
            ON s.schedule_date = n.appointment_date AND s.brand = n.brand
        LEFT JOIN salespeople p ON p.id = s.salesperson_id
        WHERE n.id = ?
        """,
        (int(note_id),),
    )


def service_note_out(row: Dict[str, Any]) -> ServiceDriveNoteOut:
    return ServiceDriveNoteOut(
        id=int(row.get("id") or 0),
        appointment_at=str(row.get("appointment_at") or ""),
        appointment_date=str(row.get("appointment_date") or ""),
        brand=str(row.get("brand") or ""),
        customer_name=str(row.get("customer_name") or ""),
        customer_phone=str(row.get("customer_phone") or ""),
        admin_notes=str(row.get("admin_notes") or ""),
        sales_notes=str(row.get("sales_notes") or ""),
        salesperson_id=int(row["salesperson_id"]) if row.get("salesperson_id") is not None else None,
        salesperson_name=str(row.get("salesperson_name") or "") or None,
        salesperson_dealership=str(row.get("salesperson_dealership") or "") or None,
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def assert_unique_name(table: str, name: str, exclude_id: Optional[int] = None) -> None:
    query = f"SELECT id FROM {table} WHERE LOWER(name) = LOWER(?)"
    params: List[Any] = [name]
    if exclude_id is not None:
        query += " AND id <> ?"
        params.append(int(exclude_id))
    if db_query_one(query, tuple(params)):
        label = "salesperson" if table == "salespeople" else "BDC agent"
        raise HTTPException(status_code=400, detail=f"{label} name already exists")


def fetch_salespeople(include_inactive: bool = False) -> List[SalespersonOut]:
    query = "SELECT * FROM salespeople"
    if not include_inactive:
        query += " WHERE active = 1"
    query += " ORDER BY active DESC, dealership ASC, name ASC, id ASC"
    return [salesperson_out(row) for row in db_query_all(query)]


def fetch_round_robin_salespeople() -> List[SalespersonOut]:
    return [salesperson_out(row) for row in db_query_all("SELECT * FROM salespeople WHERE active = 1 ORDER BY id ASC")]


def fetch_bdc_agents(include_inactive: bool = False) -> List[BdcAgentOut]:
    query = "SELECT * FROM bdc_agents"
    if not include_inactive:
        query += " WHERE active = 1"
    query += " ORDER BY active DESC, name ASC, id ASC"
    return [bdc_agent_out(row) for row in db_query_all(query)]


def fetch_days_off_month(month_key: str) -> DaysOffMonthOut:
    start_date, end_date = month_date_bounds(month_key)
    rows = db_query_all(
        """
        SELECT salesperson_id, off_date
        FROM salesperson_days_off
        WHERE off_date >= ? AND off_date < ?
        ORDER BY salesperson_id ASC, off_date ASC
        """,
        (start_date, end_date),
    )
    grouped: Dict[int, List[str]] = {}
    for row in rows:
        sid = int(row.get("salesperson_id") or 0)
        grouped.setdefault(sid, []).append(str(row.get("off_date") or ""))
    entries = [DaysOffEntryOut(salesperson_id=sid, off_dates=dates) for sid, dates in grouped.items()]
    return DaysOffMonthOut(month=month_key, entries=entries)


def update_days_off_month(payload: DaysOffMonthIn) -> DaysOffMonthOut:
    month_key = parse_month_key(payload.month)
    person = get_salesperson_row(int(payload.salesperson_id))
    if not person:
        raise HTTPException(status_code=404, detail="salesperson not found")

    valid_dates = {item.isoformat() for item in month_dates(month_key)}
    normalized_dates: List[str] = []
    for value in payload.off_dates:
        off_day = parse_iso_date(value, "off_dates")
        off_date = off_day.isoformat()
        if off_date not in valid_dates:
            raise HTTPException(status_code=400, detail="off_dates must stay within the selected month")
        if off_date not in normalized_dates:
            normalized_dates.append(off_date)
    normalized_dates.sort()

    start_date, end_date = month_date_bounds(month_key)
    db_execute(
        "DELETE FROM salesperson_days_off WHERE salesperson_id = ? AND off_date >= ? AND off_date < ?",
        (int(payload.salesperson_id), start_date, end_date),
    )

    now_ts = time.time()
    for off_date in normalized_dates:
        db_execute(
            """
            INSERT INTO salesperson_days_off (salesperson_id, off_date, created_ts)
            VALUES (?, ?, ?)
            ON CONFLICT(salesperson_id, off_date) DO NOTHING
            """,
            (int(payload.salesperson_id), off_date, now_ts),
        )

    return fetch_days_off_month(month_key)


def create_salesperson(payload: SalespersonIn) -> SalespersonOut:
    name = normalize_name(payload.name, "name")
    dealership = normalize_dealership(payload.dealership)
    assert_unique_name("salespeople", name)
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO salespeople (name, dealership, weekly_days_off, active, created_ts, updated_ts)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (name, dealership, days_to_text(payload.weekly_days_off), 1 if payload.active else 0, now_ts, now_ts),
    )
    row = get_salesperson_row(created_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to create salesperson")
    return salesperson_out(row)


def update_salesperson(salesperson_id: int, payload: SalespersonIn) -> SalespersonOut:
    if not get_salesperson_row(salesperson_id):
        raise HTTPException(status_code=404, detail="salesperson not found")
    name = normalize_name(payload.name, "name")
    dealership = normalize_dealership(payload.dealership)
    assert_unique_name("salespeople", name, exclude_id=salesperson_id)
    db_execute(
        """
        UPDATE salespeople
        SET name = ?, dealership = ?, weekly_days_off = ?, active = ?, updated_ts = ?
        WHERE id = ?
        """,
        (
            name,
            dealership,
            days_to_text(payload.weekly_days_off),
            1 if payload.active else 0,
            time.time(),
            salesperson_id,
        ),
    )
    row = get_salesperson_row(salesperson_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update salesperson")
    return salesperson_out(row)


def create_bdc_agent(payload: BdcAgentIn) -> BdcAgentOut:
    name = normalize_name(payload.name, "name")
    assert_unique_name("bdc_agents", name)
    now_ts = time.time()
    created_id = db_insert(
        "INSERT INTO bdc_agents (name, active, created_ts, updated_ts) VALUES (?, ?, ?, ?)",
        (name, 1 if payload.active else 0, now_ts, now_ts),
    )
    row = get_bdc_agent_row(created_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to create BDC agent")
    return bdc_agent_out(row)


def update_bdc_agent(agent_id: int, payload: BdcAgentIn) -> BdcAgentOut:
    if not get_bdc_agent_row(agent_id):
        raise HTTPException(status_code=404, detail="BDC agent not found")
    name = normalize_name(payload.name, "name")
    assert_unique_name("bdc_agents", name, exclude_id=agent_id)
    db_execute(
        "UPDATE bdc_agents SET name = ?, active = ?, updated_ts = ? WHERE id = ?",
        (name, 1 if payload.active else 0, time.time(), agent_id),
    )
    row = get_bdc_agent_row(agent_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update BDC agent")
    return bdc_agent_out(row)


def ensure_month_slots(month_key: str) -> None:
    now_ts = time.time()
    for service_day in month_dates(month_key):
        for brand in SERVICE_BRANDS:
            db_execute(
                """
                INSERT INTO service_drive_assignments (
                    schedule_date, month_key, brand, salesperson_id, created_ts, updated_ts
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(schedule_date, brand) DO NOTHING
                """,
                (service_day.isoformat(), month_key, brand, None, now_ts, now_ts),
            )


def service_pointer_key(brand: str) -> str:
    return f"service:pointer:{brand.lower()}"


def pick_service_person(
    pool: List[SalespersonOut],
    service_day: date,
    cursor: int,
    off_lookup: Optional[set[Tuple[int, str]]] = None,
) -> Tuple[Optional[SalespersonOut], int]:
    if not pool:
        return None, 0
    start = cursor % len(pool)
    for offset in range(len(pool)):
        idx = (start + offset) % len(pool)
        candidate = pool[idx]
        if salesperson_is_off(candidate, service_day, off_lookup):
            continue
        return candidate, (idx + 1) % len(pool)
    return None, start


def pick_round_robin_person(
    pool: List[SalespersonOut],
    working_day: date,
    cursor: int,
) -> Tuple[Optional[SalespersonOut], int, List[SalespersonOut]]:
    if not pool:
        return None, 0, []

    start = cursor % len(pool)
    ordered_available: List[SalespersonOut] = []
    picked: Optional[SalespersonOut] = None
    next_pointer = start

    for offset in range(len(pool)):
        idx = (start + offset) % len(pool)
        candidate = pool[idx]
        if salesperson_is_off(candidate, working_day):
            continue
        if picked is None:
            picked = candidate
            next_pointer = (idx + 1) % len(pool)
        ordered_available.append(candidate)

    if picked is None:
        return None, start, []

    return picked, next_pointer, ordered_available


def generate_service_schedule(month_key: str, overwrite: bool = False) -> None:
    ensure_month_slots(month_key)
    month_days = month_dates(month_key)
    people = fetch_salespeople(include_inactive=False)
    pools = {
        "Kia": [person for person in people if person.dealership == "Kia"],
        "Mazda": [person for person in people if person.dealership == "Mazda"],
    }
    off_lookup = fetch_days_off_lookup(month_days[0], month_days[-1]) if month_days else set()
    existing_rows = db_query_all(
        "SELECT schedule_date, brand, salesperson_id FROM service_drive_assignments WHERE month_key = ?",
        (month_key,),
    )
    existing_map = {(str(row["schedule_date"]), str(row["brand"])): row for row in existing_rows}
    pointers: Dict[str, int] = {}
    for brand in SERVICE_BRANDS:
        try:
            pointers[brand] = int(get_meta(service_pointer_key(brand)) or 0)
        except Exception:
            pointers[brand] = 0

    for service_day in month_days:
        for brand in SERVICE_BRANDS:
            row = existing_map.get((service_day.isoformat(), brand)) or {}
            if not overwrite and row.get("salesperson_id") is not None:
                continue
            picked, next_pointer = pick_service_person(pools.get(brand, []), service_day, pointers[brand], off_lookup)
            pointers[brand] = next_pointer
            db_execute(
                """
                UPDATE service_drive_assignments
                SET salesperson_id = ?, updated_ts = ?
                WHERE schedule_date = ? AND brand = ?
                """,
                (picked.id if picked else None, time.time(), service_day.isoformat(), brand),
            )

    for brand, pointer in pointers.items():
        set_meta(service_pointer_key(brand), str(pointer))


def fetch_service_month(month_key: str) -> ServiceMonthOut:
    ensure_month_slots(month_key)
    rows = db_query_all(
        """
        SELECT
            s.schedule_date,
            s.brand,
            s.salesperson_id,
            p.name AS salesperson_name,
            p.dealership AS salesperson_dealership
        FROM service_drive_assignments s
        LEFT JOIN salespeople p ON p.id = s.salesperson_id
        WHERE s.month_key = ?
        ORDER BY s.schedule_date ASC, s.brand ASC
        """,
        (month_key,),
    )
    if rows and not any(row.get("salesperson_id") is not None for row in rows):
        generate_service_schedule(month_key, overwrite=False)
        rows = db_query_all(
            """
            SELECT
                s.schedule_date,
                s.brand,
                s.salesperson_id,
                p.name AS salesperson_name,
                p.dealership AS salesperson_dealership
            FROM service_drive_assignments s
            LEFT JOIN salespeople p ON p.id = s.salesperson_id
            WHERE s.month_key = ?
            ORDER BY s.schedule_date ASC, s.brand ASC
            """,
            (month_key,),
        )

    slots_by_day: Dict[str, Dict[str, ServiceSlotOut]] = {}
    for service_day in month_dates(month_key):
        slots_by_day[service_day.isoformat()] = {
            "Kia": ServiceSlotOut(brand="Kia"),
            "Mazda": ServiceSlotOut(brand="Mazda"),
        }

    for row in rows:
        service_date = str(row.get("schedule_date") or "")
        brand = normalize_brand(str(row.get("brand") or ""))
        slots_by_day[service_date][brand] = ServiceSlotOut(
            brand=brand,
            salesperson_id=int(row["salesperson_id"]) if row.get("salesperson_id") is not None else None,
            salesperson_name=str(row.get("salesperson_name") or "") or None,
            salesperson_dealership=str(row.get("salesperson_dealership") or "") or None,
        )

    days: List[ServiceDayOut] = []
    assigned_slots = 0
    for service_day in month_dates(month_key):
        service_date = service_day.isoformat()
        kia = slots_by_day[service_date]["Kia"]
        mazda = slots_by_day[service_date]["Mazda"]
        if kia.salesperson_id is not None:
            assigned_slots += 1
        if mazda.salesperson_id is not None:
            assigned_slots += 1
        days.append(
            ServiceDayOut(
                date=service_date,
                day_label=service_day.strftime("%a"),
                kia=kia,
                mazda=mazda,
            )
        )

    total_days = len(days)
    return ServiceMonthOut(
        month=month_key,
        total_days=total_days,
        total_slots=total_days * len(SERVICE_BRANDS),
        assigned_slots=assigned_slots,
        days=days,
    )


def update_service_assignment(schedule_date: str, brand: str, salesperson_id: Optional[int]) -> ServiceMonthOut:
    service_day = parse_iso_date(schedule_date, "schedule_date")
    month_key = service_day.strftime("%Y-%m")
    ensure_month_slots(month_key)
    brand_name = normalize_brand(brand)
    resolved_id: Optional[int] = None
    if salesperson_id is not None:
        person = get_salesperson_row(int(salesperson_id))
        if not person:
            raise HTTPException(status_code=404, detail="salesperson not found")
        if not bool(int(person.get("active") or 0)):
            raise HTTPException(status_code=400, detail="salesperson must be active")
        if str(person.get("dealership") or "") == "Outlet":
            raise HTTPException(status_code=400, detail="Outlet salespeople cannot be assigned to service drive")
        person_out = salesperson_out(person)
        if salesperson_is_off(person_out, service_day):
            raise HTTPException(status_code=400, detail="salesperson is off on that day")
        resolved_id = int(person.get("id") or 0)
    db_execute(
        """
        UPDATE service_drive_assignments
        SET salesperson_id = ?, updated_ts = ?
        WHERE schedule_date = ? AND brand = ?
        """,
        (resolved_id, time.time(), service_day.isoformat(), brand_name),
    )
    return fetch_service_month(month_key)


def resolve_bdc_agent(agent_id: Optional[int], agent_name: Optional[str]) -> Tuple[Optional[int], str]:
    if agent_id is not None:
        row = get_bdc_agent_row(int(agent_id))
        if not row:
            raise HTTPException(status_code=404, detail="BDC agent not found")
        if not bool(int(row.get("active") or 0)):
            raise HTTPException(status_code=400, detail="BDC agent must be active")
        return int(row.get("id") or 0), str(row.get("name") or "")

    name = normalize_name(str(agent_name or ""), "bdc_agent_name")
    row = db_query_one("SELECT * FROM bdc_agents WHERE LOWER(name) = LOWER(?)", (name,))
    if row and not bool(int(row.get("active") or 0)):
        raise HTTPException(status_code=400, detail="BDC agent must be active")
    if row:
        return int(row.get("id") or 0), str(row.get("name") or "")
    return None, name


def build_bdc_state() -> BdcStateOut:
    queue = fetch_round_robin_salespeople()
    if not queue:
        return BdcStateOut(next_index=0, next_salesperson=None, queue=[])
    try:
        pointer = int(get_meta("bdc:pointer") or 0)
    except Exception:
        pointer = 0
    next_index = pointer % len(queue)
    picked, _, available_queue = pick_round_robin_person(queue, now_local().date(), pointer)
    return BdcStateOut(next_index=next_index, next_salesperson=picked, queue=available_queue)


def assign_next_lead(payload: BdcLeadAssignIn) -> BdcAssignmentOut:
    salespeople = fetch_round_robin_salespeople()
    if not salespeople:
        raise HTTPException(status_code=400, detail="no active salespeople available")
    try:
        pointer = int(get_meta("bdc:pointer") or 0)
    except Exception:
        pointer = 0
    salesperson, next_pointer, _ = pick_round_robin_person(salespeople, now_local().date(), pointer)
    if not salesperson:
        raise HTTPException(status_code=400, detail="no active salespeople available for today's rotation")
    bdc_agent_id, bdc_agent_name = resolve_bdc_agent(payload.bdc_agent_id, payload.bdc_agent_name)
    customer_name = normalize_short_text(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    created_id = db_insert(
        """
        INSERT INTO bdc_assignment_log (
            assigned_ts, assigned_at, bdc_agent_id, bdc_agent_name, salesperson_id, salesperson_name,
            salesperson_dealership, customer_name, customer_phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            now_iso(),
            bdc_agent_id,
            bdc_agent_name,
            salesperson.id,
            salesperson.name,
            salesperson.dealership,
            customer_name,
            customer_phone,
        ),
    )
    set_meta("bdc:pointer", str(next_pointer))
    row = db_query_one("SELECT * FROM bdc_assignment_log WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to create assignment log")
    return bdc_log_out(row)


def build_log_filter(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[str, Tuple[Any, ...], Optional[str], Optional[str]]:
    clauses: List[str] = []
    params: List[Any] = []
    start_norm: Optional[str] = None
    end_norm: Optional[str] = None

    if start_date:
        start = parse_iso_date(start_date, "start_date")
        start_norm = start.isoformat()
        clauses.append("assigned_ts >= ?")
        params.append(date_to_ts(start))

    if end_date:
        end = parse_iso_date(end_date, "end_date")
        end_norm = end.isoformat()
        clauses.append("assigned_ts < ?")
        params.append(date_to_ts(end, end_exclusive=True))

    if start_norm and end_norm and start_norm > end_norm:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")

    if salesperson_id is not None:
        clauses.append("salesperson_id = ?")
        params.append(int(salesperson_id))

    where_sql = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, tuple(params), start_norm, end_norm


def fetch_bdc_log(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 200,
) -> BdcLogOut:
    where_sql, params, _, _ = build_log_filter(salesperson_id, start_date, end_date)
    safe_limit = max(1, min(int(limit or 200), 500))
    count_row = db_query_one(f"SELECT COUNT(*) AS count FROM bdc_assignment_log{where_sql}", params) or {}
    rows = db_query_all(
        f"SELECT * FROM bdc_assignment_log{where_sql} ORDER BY assigned_ts DESC, id DESC LIMIT ?",
        params + (safe_limit,),
    )
    return BdcLogOut(total=int(count_row.get("count") or 0), entries=[bdc_log_out(row) for row in rows])


def fetch_bdc_report(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BdcReportOut:
    base_where_sql, base_params, start_norm, end_norm = build_log_filter(None, start_date, end_date)
    total_row = db_query_one(f"SELECT COUNT(*) AS count FROM bdc_assignment_log{base_where_sql}", base_params) or {}
    total_assignments = int(total_row.get("count") or 0)
    grouped_rows = db_query_all(
        f"""
        SELECT salesperson_id, salesperson_name, salesperson_dealership AS dealership, COUNT(*) AS assignments
        FROM bdc_assignment_log
        {base_where_sql}
        GROUP BY salesperson_id, salesperson_name, salesperson_dealership
        """,
        base_params,
    )

    active_salespeople = fetch_round_robin_salespeople()
    active_ids = {person.id for person in active_salespeople}
    grouped_by_id: Dict[int, Dict[str, Any]] = {}
    for row in grouped_rows:
        if row.get("salesperson_id") is not None:
            grouped_by_id[int(row.get("salesperson_id") or 0)] = row

    rows: List[BdcReportRowOut] = []
    for person in active_salespeople:
        grouped = grouped_by_id.get(person.id)
        rows.append(
            BdcReportRowOut(
                salesperson_id=person.id,
                salesperson_name=person.name,
                dealership=person.dealership,
                assignments=int(grouped.get("assignments") or 0) if grouped else 0,
            )
        )

    for row in grouped_rows:
        sid = int(row.get("salesperson_id") or 0) if row.get("salesperson_id") is not None else None
        if sid is not None and sid in active_ids:
            continue
        rows.append(
            BdcReportRowOut(
                salesperson_id=sid,
                salesperson_name=str(row.get("salesperson_name") or "Unknown"),
                dealership=str(row.get("dealership") or ""),
                assignments=int(row.get("assignments") or 0),
            )
        )

    rows.sort(key=lambda item: (-item.assignments, item.salesperson_name.lower()))
    active_count = len(active_salespeople)
    expected_min = total_assignments // active_count if active_count else 0
    expected_max = (total_assignments + active_count - 1) // active_count if active_count else 0
    filtered_assignments = total_assignments
    selected_actual = 0
    if salesperson_id is not None:
        sid = int(salesperson_id)
        selected_actual = next((row.assignments for row in rows if row.salesperson_id == sid), 0)
        filtered_assignments = selected_actual

    return BdcReportOut(
        start_date=start_norm,
        end_date=end_norm,
        salesperson_id=int(salesperson_id) if salesperson_id is not None else None,
        total_assignments=total_assignments,
        filtered_assignments=filtered_assignments,
        active_salespeople=active_count,
        expected_min=expected_min,
        expected_max=expected_max,
        selected_salesperson_actual=selected_actual,
        rows=rows,
    )


def build_service_notes_filter(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand: Optional[str] = None,
) -> Tuple[str, Tuple[Any, ...]]:
    clauses: List[str] = []
    params: List[Any] = []

    if start_date:
        clauses.append("n.appointment_date >= ?")
        params.append(parse_iso_date(start_date, "start_date").isoformat())

    if end_date:
        clauses.append("n.appointment_date <= ?")
        params.append(parse_iso_date(end_date, "end_date").isoformat())

    if start_date and end_date and str(params[0]) > str(params[1]):
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")

    if brand:
        clauses.append("n.brand = ?")
        params.append(normalize_brand(brand))

    if salesperson_id is not None:
        clauses.append("s.salesperson_id = ?")
        params.append(int(salesperson_id))

    where_sql = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, tuple(params)


def fetch_service_notes(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand: Optional[str] = None,
    limit: int = 300,
) -> ServiceDriveNotesOut:
    where_sql, params = build_service_notes_filter(
        salesperson_id=salesperson_id,
        start_date=start_date,
        end_date=end_date,
        brand=brand,
    )
    safe_limit = max(1, min(int(limit or 300), 500))
    join_sql = """
        FROM service_drive_notes n
        LEFT JOIN service_drive_assignments s
            ON s.schedule_date = n.appointment_date AND s.brand = n.brand
        LEFT JOIN salespeople p ON p.id = s.salesperson_id
    """
    count_row = db_query_one(f"SELECT COUNT(*) AS count {join_sql}{where_sql}", params) or {}
    rows = db_query_all(
        f"""
        SELECT
            n.*,
            s.salesperson_id,
            p.name AS salesperson_name,
            p.dealership AS salesperson_dealership
        {join_sql}
        {where_sql}
        ORDER BY n.appointment_ts ASC, n.id ASC
        LIMIT ?
        """,
        params + (safe_limit,),
    )
    return ServiceDriveNotesOut(total=int(count_row.get("count") or 0), entries=[service_note_out(row) for row in rows])


def create_service_note(payload: ServiceDriveNoteIn) -> ServiceDriveNoteOut:
    appointment_at, appointment_date, appointment_ts = parse_local_datetime(payload.appointment_at, "appointment_at")
    brand = normalize_brand(payload.brand)
    customer_name = normalize_name(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    admin_notes = normalize_notes(payload.admin_notes, "admin_notes")
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO service_drive_notes (
            appointment_at, appointment_date, appointment_ts, brand, customer_name, customer_phone, admin_notes,
            sales_notes, created_ts, updated_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (appointment_at, appointment_date, appointment_ts, brand, customer_name, customer_phone, admin_notes, "", now_ts, now_ts),
    )
    row = get_service_note_row(created_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to create service note")
    return service_note_out(row)


def update_service_note_admin(note_id: int, payload: ServiceDriveNoteIn) -> ServiceDriveNoteOut:
    existing = get_service_note_row(note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="service note not found")
    appointment_at, appointment_date, appointment_ts = parse_local_datetime(payload.appointment_at, "appointment_at")
    brand = normalize_brand(payload.brand)
    customer_name = normalize_name(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    admin_notes = normalize_notes(payload.admin_notes, "admin_notes")
    db_execute(
        """
        UPDATE service_drive_notes
        SET appointment_at = ?, appointment_date = ?, appointment_ts = ?, brand = ?, customer_name = ?,
            customer_phone = ?, admin_notes = ?, updated_ts = ?
        WHERE id = ?
        """,
        (appointment_at, appointment_date, appointment_ts, brand, customer_name, customer_phone, admin_notes, time.time(), note_id),
    )
    row = get_service_note_row(note_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update service note")
    return service_note_out(row)


def update_service_note_sales(note_id: int, payload: ServiceDriveSalesNoteIn) -> ServiceDriveNoteOut:
    row = get_service_note_row(note_id)
    if not row:
        raise HTTPException(status_code=404, detail="service note not found")
    assigned_salesperson_id = int(row["salesperson_id"]) if row.get("salesperson_id") is not None else None
    if assigned_salesperson_id is None:
        raise HTTPException(status_code=400, detail="no salesperson is currently assigned to that service appointment")
    if payload.salesperson_id is not None and int(payload.salesperson_id) != assigned_salesperson_id:
        raise HTTPException(status_code=403, detail="that note belongs to a different salesperson today")

    sales_notes = normalize_notes(payload.sales_notes, "sales_notes")
    db_execute(
        "UPDATE service_drive_notes SET sales_notes = ?, updated_ts = ? WHERE id = ?",
        (sales_notes, time.time(), note_id),
    )
    saved = get_service_note_row(note_id)
    if not saved:
        raise HTTPException(status_code=500, detail="failed to update service note")
    return service_note_out(saved)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/admin/login", response_model=AdminSessionOut)
def admin_login(payload: AdminLoginIn) -> AdminSessionOut:
    if payload.username.strip() != ADMIN_USERNAME or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="invalid admin credentials")
    return issue_session()


@app.get("/api/admin/session", response_model=AdminStatusOut)
def admin_session(x_admin_token: Optional[str] = Header(default=None)) -> AdminStatusOut:
    session = require_admin(x_admin_token)
    return AdminStatusOut(
        username=str(session.get("username") or ADMIN_USERNAME),
        expires_ts=float(session.get("expires_ts") or 0.0),
    )


@app.get("/api/salespeople", response_model=List[SalespersonOut])
def get_salespeople(include_inactive: bool = False) -> List[SalespersonOut]:
    return fetch_salespeople(include_inactive=include_inactive)


@app.post("/api/admin/salespeople", response_model=SalespersonOut)
def post_salesperson(payload: SalespersonIn, x_admin_token: Optional[str] = Header(default=None)) -> SalespersonOut:
    require_admin(x_admin_token)
    return create_salesperson(payload)


@app.put("/api/admin/salespeople/{salesperson_id}", response_model=SalespersonOut)
def put_salesperson(
    salesperson_id: int,
    payload: SalespersonIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> SalespersonOut:
    require_admin(x_admin_token)
    return update_salesperson(salesperson_id, payload)


@app.get("/api/admin/days-off", response_model=DaysOffMonthOut)
def get_admin_days_off(month: str, x_admin_token: Optional[str] = Header(default=None)) -> DaysOffMonthOut:
    require_admin(x_admin_token)
    return fetch_days_off_month(parse_month_key(month))


@app.put("/api/admin/days-off", response_model=DaysOffMonthOut)
def put_admin_days_off(
    payload: DaysOffMonthIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> DaysOffMonthOut:
    require_admin(x_admin_token)
    return update_days_off_month(payload)


@app.get("/api/bdc/agents", response_model=List[BdcAgentOut])
def get_bdc_agents(include_inactive: bool = False) -> List[BdcAgentOut]:
    return fetch_bdc_agents(include_inactive=include_inactive)


@app.post("/api/admin/bdc/agents", response_model=BdcAgentOut)
def post_bdc_agent(payload: BdcAgentIn, x_admin_token: Optional[str] = Header(default=None)) -> BdcAgentOut:
    require_admin(x_admin_token)
    return create_bdc_agent(payload)


@app.put("/api/admin/bdc/agents/{agent_id}", response_model=BdcAgentOut)
def put_bdc_agent(agent_id: int, payload: BdcAgentIn, x_admin_token: Optional[str] = Header(default=None)) -> BdcAgentOut:
    require_admin(x_admin_token)
    return update_bdc_agent(agent_id, payload)


@app.get("/api/service-drive", response_model=ServiceMonthOut)
def get_service_drive(month: Optional[str] = None) -> ServiceMonthOut:
    return fetch_service_month(parse_month_key(month or now_local().strftime("%Y-%m")))


@app.get("/api/service-drive/notes", response_model=ServiceDriveNotesOut)
def get_service_drive_notes(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand: Optional[str] = None,
    limit: int = 300,
) -> ServiceDriveNotesOut:
    return fetch_service_notes(
        salesperson_id=salesperson_id,
        start_date=start_date,
        end_date=end_date,
        brand=brand,
        limit=limit,
    )


@app.post("/api/admin/service-drive/generate", response_model=ServiceMonthOut)
def post_service_generate(payload: ServiceGenerateIn, x_admin_token: Optional[str] = Header(default=None)) -> ServiceMonthOut:
    require_admin(x_admin_token)
    month_key = parse_month_key(payload.month)
    generate_service_schedule(month_key, overwrite=payload.overwrite)
    return fetch_service_month(month_key)


@app.post("/api/admin/service-drive/notes", response_model=ServiceDriveNoteOut)
def post_service_note(
    payload: ServiceDriveNoteIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveNoteOut:
    require_admin(x_admin_token)
    return create_service_note(payload)


@app.put("/api/admin/service-drive/notes/{note_id}", response_model=ServiceDriveNoteOut)
def put_service_note(
    note_id: int,
    payload: ServiceDriveNoteIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveNoteOut:
    require_admin(x_admin_token)
    return update_service_note_admin(note_id, payload)


@app.put("/api/admin/service-drive/assignment", response_model=ServiceMonthOut)
def put_service_assignment(
    payload: ServiceAssignmentIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceMonthOut:
    require_admin(x_admin_token)
    return update_service_assignment(payload.schedule_date, payload.brand, payload.salesperson_id)


@app.put("/api/service-drive/notes/{note_id}/sales", response_model=ServiceDriveNoteOut)
def put_service_note_sales(note_id: int, payload: ServiceDriveSalesNoteIn) -> ServiceDriveNoteOut:
    return update_service_note_sales(note_id, payload)


@app.get("/api/bdc/state", response_model=BdcStateOut)
def get_bdc_state() -> BdcStateOut:
    return build_bdc_state()


@app.post("/api/bdc/assign", response_model=BdcAssignmentOut)
def post_bdc_assign(payload: BdcLeadAssignIn) -> BdcAssignmentOut:
    return assign_next_lead(payload)


@app.get("/api/bdc/log", response_model=BdcLogOut)
def get_bdc_log(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 200,
) -> BdcLogOut:
    return fetch_bdc_log(salesperson_id=salesperson_id, start_date=start_date, end_date=end_date, limit=limit)


@app.get("/api/bdc/report", response_model=BdcReportOut)
def get_bdc_report(
    salesperson_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BdcReportOut:
    return fetch_bdc_report(salesperson_id=salesperson_id, start_date=start_date, end_date=end_date)
