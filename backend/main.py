import calendar
import base64
import json
import csv
import io
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from curl_cffi import requests as curl_requests
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from orgtool_api import app as orgtool_app


def load_local_env_file(file_path: str) -> None:
    if not os.path.exists(file_path):
        return
    try:
        with open(file_path, "r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.lower().startswith("export "):
                    line = line[7:].lstrip()
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if not key:
                    continue
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                    value = value[1:-1]
                os.environ.setdefault(key, value)
    except OSError:
        return


load_local_env_file(os.path.join(os.path.dirname(__file__), ".env"))


DB_PATH = os.getenv(
    "DEALER_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "dealership.db"),
)
DATA_ROOT = os.path.dirname(DB_PATH)
UPLOADS_ROOT = os.path.join(DATA_ROOT, "uploads")
TRAFFIC_PDF_ROOT = os.path.join(UPLOADS_ROOT, "traffic-pdfs")
SPECIALS_ROOT = os.path.join(UPLOADS_ROOT, "specials")
TRAFFIC_OFFER_ROOT = os.path.join(UPLOADS_ROOT, "traffic-offers")
for path in (DATA_ROOT, UPLOADS_ROOT, TRAFFIC_PDF_ROOT, SPECIALS_ROOT, TRAFFIC_OFFER_ROOT):
    if path:
        os.makedirs(path, exist_ok=True)
RULES_TIMEZONE = os.getenv("DEALER_TIMEZONE", "America/Chicago").strip() or "America/Chicago"
ADMIN_USERNAME = os.getenv("DEALER_ADMIN_USERNAME", "").strip()
ADMIN_PASSWORD = os.getenv("DEALER_ADMIN_PASSWORD", "").strip()
SESSION_SECONDS = max(900, int(os.getenv("DEALER_ADMIN_SESSION_SECONDS", "43200") or 43200))
APP_BASE_URL = os.getenv("DEALER_APP_BASE_URL", "https://app.bertogden123.com").strip() or "https://app.bertogden123.com"
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "").strip()
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
BDC_NOTIFY_EMAIL_FROM = os.getenv("BDC_NOTIFY_EMAIL_FROM", "").strip()
BDC_NOTIFY_EMAIL_REPLY_TO = os.getenv("BDC_NOTIFY_EMAIL_REPLY_TO", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_AGENT_MODEL = os.getenv("OPENAI_AGENT_MODEL", "gpt-5.4-mini").strip() or "gpt-5.4-mini"
OPENAI_AGENT_REASONING_EFFORT = os.getenv("OPENAI_AGENT_REASONING_EFFORT", "low").strip() or "low"
OPENAI_AGENT_MAX_STEPS = max(2, min(10, int(os.getenv("OPENAI_AGENT_MAX_STEPS", "6") or 6)))
DEALERSHIPS = ("Kia", "Mazda", "Outlet")
SERVICE_BRANDS = ("Kia", "Mazda")
QUOTE_BRANDS = ("Kia New", "Mazda New", "Used")
BDC_DISTRIBUTION_MODES = ("franchise", "global", "universal")
BDC_DISTRIBUTION_META_KEY = "bdc:distribution"
BDC_UNDO_REQUIRE_META_KEY = "bdc:undo:require_password"
BDC_UNDO_PASSWORD_META_KEY = "bdc:undo:password"
TAB_VISIBILITY_META_KEY = "tabs:visibility"
FRESHUP_LINKS_META_KEY = "freshup:links"
SPECIALS_USED_SOURCE_META_KEY = "specials:used_source_url"
TAB_VISIBILITY_IDS = (
    "serviceCalendar",
    "serviceNotes",
    "trafficAnalysis",
    "bdc",
    "bdcSalesTracker",
    "reports",
    "traffic",
    "freshUp",
    "marketplace",
    "quote",
    "specials",
)
BDC_SALES_TRACKER_DEFAULT_GOAL = 252.0
BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_FLOOR = 0.20
BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_TARGET = 0.30
BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_FLOOR = 0.50
BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_TARGET = 0.60
BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_FLOOR = 0.10
BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_TARGET = 0.15
BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_CEILING = 0.18
SPECIALS_KIA_NEW_URL = "https://www.bertogdenmissionkia.com/new-specials/"
SPECIALS_MAZDA_NEW_URL = "https://www.bertogdenmissionmazda.com/new-vehicles/"
SPECIALS_KIA_JIRA_ID = "OGDENMIKIA"
SPECIALS_KIA_OFFERS_JS_URL = "https://d2dhakgqu1upap.cloudfront.net/specials/offers.js"
SPECIALS_SOURCE_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "kia_new": {
        "label": "Kia New Specials",
        "default_url": SPECIALS_KIA_NEW_URL,
        "category": "new_specials",
    },
    "mazda_new": {
        "label": "Mazda New Inventory Picks",
        "default_url": SPECIALS_MAZDA_NEW_URL,
        "category": "new_inventory",
    },
    "used_srp": {
        "label": "Used Deal Picks",
        "default_url": "",
        "category": "used_inventory",
    },
}
DEFAULT_CORS_ORIGINS = [
    "http://localhost:4174",
    "http://127.0.0.1:4174",
    "http://localhost:4183",
    "http://127.0.0.1:4183",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://dealership-tool-web.onrender.com",
    "https://orgtool-web.onrender.com",
    "https://organize.bertogden123.com",
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
AGENT_LOOP_STATUSES = ("queued", "running", "completed", "blocked", "failed", "canceled")
AGENT_LOOP_PRESETS = (
    {
        "key": "executive_daily_brief",
        "label": "Executive Daily Brief",
        "description": "Review BDC, freshups, service traffic, and staffing signals across the dealership.",
        "starter_objective": "Create a concise executive brief that surfaces the biggest opportunities, risks, and next actions across the dealership today.",
    },
    {
        "key": "bdc_recovery",
        "label": "BDC Recovery Loop",
        "description": "Inspect BDC assignments, distribution fairness, and follow-up gaps.",
        "starter_objective": "Analyze recent BDC activity, identify missed opportunities or uneven distribution, and recommend concrete follow-up actions.",
    },
    {
        "key": "service_drive_followup",
        "label": "Service Drive Follow-Up",
        "description": "Find service-drive customers who still need notes, follow-up, or manager attention.",
        "starter_objective": "Review current service-drive traffic and notes, then surface customers and rows that still need follow-up today.",
    },
    {
        "key": "freshup_conversion",
        "label": "Freshup Conversion Loop",
        "description": "Analyze freshup logs and tap-page analytics for handoff and conversion gaps.",
        "starter_objective": "Review freshup volume and analytics, identify drop-off points, and recommend changes that should improve showroom conversion.",
    },
)

app = FastAPI(title="Dealership Tool")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOADS_ROOT), name="uploads")
app.mount("/orgtool", orgtool_app)

db_lock = threading.Lock()
db_conn: Optional[sqlite3.Connection] = None
admin_sessions: Dict[str, Dict[str, Any]] = {}
agent_run_threads: Dict[int, threading.Thread] = {}
agent_run_threads_lock = threading.Lock()


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
    phone_number: str = ""
    email: str = ""
    notify_sms: bool = False
    notify_email: bool = False


class SalespersonOut(BaseModel):
    id: int
    name: str
    dealership: str
    weekly_days_off: List[int]
    active: bool
    created_ts: float
    updated_ts: float


class SalespersonAdminOut(SalespersonOut):
    phone_number: str = ""
    email: str = ""
    notify_sms: bool = False
    notify_email: bool = False


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


class DaysOffMonthBulkIn(BaseModel):
    month: str
    entries: List[DaysOffEntryOut] = []


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
    people_off: List[str] = []


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
    lead_store: str = "Kia"
    customer_name: str = ""
    customer_phone: str = ""


class BdcAssignmentOut(BaseModel):
    id: int
    assigned_ts: float
    assigned_at: str
    bdc_agent_id: Optional[int] = None
    bdc_agent_name: str
    lead_store: str = ""
    salesperson_id: int
    salesperson_name: str
    salesperson_dealership: str
    customer_name: str = ""
    customer_phone: str = ""
    notification_sms_status: str = ""
    notification_email_status: str = ""


class NotificationConfigOut(BaseModel):
    sms_provider: str = "Twilio"
    sms_configured: bool = False
    email_provider: str = "Resend"
    email_configured: bool = False


class NotificationTestSmsIn(BaseModel):
    phone_number: str


class NotificationTestSmsOut(BaseModel):
    phone_number: str
    status: str


class NotificationTestEmailIn(BaseModel):
    email: str


class NotificationTestEmailOut(BaseModel):
    email: str
    status: str


class BdcStateOut(BaseModel):
    dealership: Optional[str] = None
    next_index: int
    next_salesperson: Optional[SalespersonOut] = None
    queue: List[SalespersonOut]


class BdcDistributionOut(BaseModel):
    mode: str


class BdcDistributionIn(BaseModel):
    mode: str


class BdcLogOut(BaseModel):
    total: int
    entries: List[BdcAssignmentOut]


class FreshUpLogCreateIn(BaseModel):
    customer_name: str
    customer_phone: str
    salesperson_id: Optional[int] = None
    source: str = "Desk"


class FreshUpLogOut(BaseModel):
    id: int
    created_ts: float
    created_at: str
    customer_name: str
    customer_phone: str
    salesperson_id: Optional[int] = None
    salesperson_name: str = ""
    salesperson_dealership: str = ""
    source: str = "Desk"


class FreshUpLogListOut(BaseModel):
    total: int
    entries: List[FreshUpLogOut]


class FreshUpLinkStoreOut(BaseModel):
    dealership: str
    display_name: str
    call_label: str = ""
    call_url: str = ""
    maps_label: str = ""
    maps_url: str = ""
    instagram_url: str = ""
    facebook_url: str = ""
    youtube_url: str = ""
    soft_pull_label: str
    soft_pull_url: str
    hard_pull_label: str
    hard_pull_url: str
    inventory_label: str
    inventory_url: str


class FreshUpLinksConfigOut(BaseModel):
    page_title: str
    page_subtitle: str
    form_title: str
    form_subtitle: str
    submit_label: str
    stores: List[FreshUpLinkStoreOut]


class FreshUpLinksConfigIn(FreshUpLinksConfigOut):
    pass


class FreshUpAnalyticsEventIn(BaseModel):
    salesperson_id: Optional[int] = None
    store_dealership: str = ""
    event_type: str
    link_type: str = ""
    target_url: str = ""


class FreshUpAnalyticsEventOut(BaseModel):
    id: int
    event_at: str
    event_type: str
    link_type: str = ""
    salesperson_name: str = ""
    salesperson_dealership: str = ""
    store_dealership: str = ""
    target_url: str = ""


class FreshUpAnalyticsCountOut(BaseModel):
    label: str
    count: int


class FreshUpAnalyticsSummaryOut(BaseModel):
    total_events: int
    page_views: int
    submissions: int
    link_clicks: int
    clicks_by_link_type: List[FreshUpAnalyticsCountOut]
    clicks_by_store: List[FreshUpAnalyticsCountOut]
    recent: List[FreshUpAnalyticsEventOut]


class FreshUpAnalyticsAck(BaseModel):
    ok: bool = True


class BdcReportRowOut(BaseModel):
    salesperson_id: Optional[int] = None
    salesperson_name: str
    dealership: str
    assignments: int


class BdcReportOut(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    salesperson_id: Optional[int] = None
    lead_store: Optional[str] = None
    total_assignments: int
    filtered_assignments: int
    active_salespeople: int
    expected_min: int
    expected_max: int
    selected_salesperson_actual: int
    rows: List[BdcReportRowOut]


class BdcHistoryClearOut(BaseModel):
    cleared: int


class BdcUndoOut(BaseModel):
    removed: Optional[BdcAssignmentOut] = None
    pointer: int = 0


class BdcUndoSettingsOut(BaseModel):
    require_password: bool = True
    password_hint: str = ""


class BdcUndoSettingsIn(BaseModel):
    require_password: bool = True
    password: str = ""


class BdcUndoRequest(BaseModel):
    password: str = ""


class BdcSalesTrackerMonthIn(BaseModel):
    month: str
    goal: float = BDC_SALES_TRACKER_DEFAULT_GOAL


class BdcSalesTrackerBenchmarksIn(BaseModel):
    month: str
    appointment_set_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_FLOOR
    appointment_set_rate_target: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_TARGET
    appointment_show_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_FLOOR
    appointment_show_rate_target: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_TARGET
    sold_from_appointments_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_FLOOR
    sold_from_appointments_rate_target: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_TARGET
    sold_from_appointments_rate_ceiling: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_CEILING


class BdcSalesTrackerAgentMetricsIn(BaseModel):
    month: str
    total_leads: int = 0
    appointments_set: int = 0
    appointments_shown: int = 0
    actual_sold: int = 0
    calls_mtd: int = 0
    emails_mtd: int = 0
    texts_mtd: int = 0
    days_off: int = 0


class BdcSalesTrackerEntryIn(BaseModel):
    month: str
    agent_id: int
    dms_number: str = ""
    dms_numbers_text: str = ""
    profile_name: str = ""
    notes: str = ""
    sold: bool = False


class BdcSalesTrackerEntryUpdateIn(BaseModel):
    dms_number: str = ""
    profile_name: str = ""
    notes: str = ""
    sold: bool = False


class BdcSalesTrackerEntryOut(BaseModel):
    id: int
    month: str
    agent_id: int
    agent_name: str
    dms_number: str = ""
    profile_name: str = ""
    notes: str = ""
    sold: bool = False
    sold_at: str = ""
    created_at: str
    updated_at: str
    created_ts: float
    updated_ts: float


class BdcSalesTrackerDmsLogEntryIn(BaseModel):
    month: str
    customer_name: str
    apt_set_under: str = ""
    notes: str = ""


class BdcSalesTrackerDmsLogEntryUpdateIn(BaseModel):
    customer_name: str
    opportunity_id: str = ""
    dms_number: str = ""
    apt_set_under: str = ""
    notes: str = ""
    logged: bool = False
    logged_at: str = ""


class BdcSalesTrackerDmsLogEntryOut(BaseModel):
    id: int
    month: str
    customer_name: str
    opportunity_id: str = ""
    dms_number: str = ""
    apt_set_under: str = ""
    notes: str = ""
    logged: bool = False
    logged_at: str = ""
    created_at: str
    updated_at: str
    created_ts: float
    updated_ts: float


class BdcSalesTrackerDmsLogOut(BaseModel):
    current_entries: List[BdcSalesTrackerDmsLogEntryOut] = []
    log_entries: List[BdcSalesTrackerDmsLogEntryOut] = []


class BdcSalesTrackerFocusNoteIn(BaseModel):
    month: str
    focus_key: str
    focus_label: str = ""
    notes: str = ""


class BdcSalesTrackerFocusNoteOut(BaseModel):
    focus_key: str
    focus_label: str = ""
    notes: str = ""
    updated_at: str = ""
    updated_ts: float = 0.0


class BdcSalesTrackerAgentOut(BaseModel):
    agent_id: int
    agent_name: str
    active: bool = True
    sold_count: int = 0
    tracking_projection: float = 0.0
    total_leads: int = 0
    appointments_set: int = 0
    appointment_set_rate: float = 0.0
    appointments_shown: int = 0
    appointment_show_rate: float = 0.0
    actual_sold: int = 0
    actual_sold_rate: float = 0.0
    sold_from_shown_rate: float = 0.0
    avg_appointments_per_day: float = 0.0
    avg_shown_per_day: float = 0.0
    avg_sold_per_day: float = 0.0
    calls_mtd: int = 0
    emails_mtd: int = 0
    texts_mtd: int = 0
    average_activity_label: str = "0 / 0 / 0"
    days_off: int = 0
    entries: List[BdcSalesTrackerEntryOut] = []


class BdcSalesTrackerBenchmarksOut(BaseModel):
    appointment_set_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_FLOOR
    appointment_set_rate_target: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_TARGET
    appointment_show_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_FLOOR
    appointment_show_rate_target: float = BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_TARGET
    sold_from_appointments_rate_floor: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_FLOOR
    sold_from_appointments_rate_target: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_TARGET
    sold_from_appointments_rate_ceiling: float = BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_CEILING


class BdcSalesTrackerSummaryOut(BaseModel):
    goal: float = BDC_SALES_TRACKER_DEFAULT_GOAL
    mtd_tracked: int = 0
    tracking_projection: float = 0.0
    daily_goal: float = 0.0
    working_days: int = 0
    days_worked: int = 0
    days_left: int = 0
    should_be_at_sold: float = 0.0
    behind_by: float = 0.0


class BdcSalesTrackerOut(BaseModel):
    month: str
    goal: float = BDC_SALES_TRACKER_DEFAULT_GOAL
    summary: BdcSalesTrackerSummaryOut
    benchmarks: BdcSalesTrackerBenchmarksOut = BdcSalesTrackerBenchmarksOut()
    agents: List[BdcSalesTrackerAgentOut]
    dms_log: BdcSalesTrackerDmsLogOut = BdcSalesTrackerDmsLogOut()
    focus_notes: List[BdcSalesTrackerFocusNoteOut] = []


class TabVisibilityItem(BaseModel):
    tab_id: str
    visible: bool = True
    position: int = 0


class TabVisibilityOut(BaseModel):
    entries: List[TabVisibilityItem]


class TabVisibilityIn(BaseModel):
    entries: List[TabVisibilityItem]


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


class ServiceDriveTrafficAssignmentOut(BaseModel):
    brand: str
    salesperson_id: Optional[int] = None
    salesperson_name: Optional[str] = None
    salesperson_dealership: Optional[str] = None


class ServiceDriveTrafficIn(BaseModel):
    traffic_date: str
    brand: str = "Kia"
    customer_name: str
    customer_phone: str = ""
    vehicle_year: str = ""
    model_make: str = ""
    offer_idea: str = ""


class ServiceDriveTrafficSalesNoteIn(BaseModel):
    salesperson_id: Optional[int] = None
    sales_notes: str = ""


class ServiceDriveTrafficImageOut(BaseModel):
    id: int
    original_filename: str
    image_url: str
    created_ts: float


class ServiceDriveTrafficOut(BaseModel):
    id: int
    traffic_date: str
    brand: str
    customer_name: str
    customer_phone: str
    appointment_label: str = ""
    appointment_ts: float = 0.0
    vehicle_year: str
    odometer: str = ""
    model_make: str
    offer_idea: str
    offer_images: List[ServiceDriveTrafficImageOut]
    sales_notes: str
    sales_note_salesperson_id: Optional[int] = None
    sales_note_salesperson_name: Optional[str] = None
    drive_team: List[ServiceDriveTrafficAssignmentOut]
    created_ts: float
    updated_ts: float


class ServiceDriveTrafficListOut(BaseModel):
    month: str
    selected_date: Optional[str] = None
    total: int
    counts_by_date: Dict[str, int]
    entries: List[ServiceDriveTrafficOut]


class ServiceDriveTrafficImportOut(BaseModel):
    total_rows: int
    created: int
    updated: int
    skipped: int
    dates: List[str]


class ServiceDriveTrafficImportUndoOut(BaseModel):
    deleted: int
    preserved_with_notes: int = 0


class ServiceDriveTrafficDayClearOut(BaseModel):
    traffic_date: str
    deleted: int
    deleted_images: int = 0


class QuoteRateOut(BaseModel):
    brand: str
    tier: str
    apr: float


class QuoteRateListOut(BaseModel):
    entries: List[QuoteRateOut]


class QuoteRatesIn(BaseModel):
    rates: List[QuoteRateOut]


class MarketplaceTemplateOut(BaseModel):
    title_template: str
    description_template: str
    price_label: str = "Bert Ogden Price"
    cta_text: str = ""


class MarketplaceTemplateIn(BaseModel):
    title_template: str
    description_template: str
    price_label: str = "Bert Ogden Price"
    cta_text: str = ""


class TrafficPdfOut(BaseModel):
    id: int
    title: str
    original_filename: str
    file_url: str
    created_ts: float


class TrafficPdfListOut(BaseModel):
    entries: List[TrafficPdfOut]


class SpecialOut(BaseModel):
    id: int
    title: str
    tag: str
    original_filename: str
    image_url: str
    created_ts: float


class VehicleSpecialEntryOut(BaseModel):
    id: int
    source_key: str
    source_label: str
    source_url: str
    badge: str
    title: str
    subtitle: str
    price_text: str
    payment_text: str
    mileage_text: str
    note: str
    score: float
    score_label: str
    image_url: str
    link_url: str
    imported_ts: float


class VehicleSpecialSectionOut(BaseModel):
    key: str
    label: str
    source_url: str
    category: str
    imported_ts: float
    entries: List[VehicleSpecialEntryOut]


class SpecialsConfigOut(BaseModel):
    kia_new_url: str
    mazda_new_url: str
    used_srp_url: str


class SpecialsListOut(BaseModel):
    entries: List[SpecialOut]
    vehicle_sections: List[VehicleSpecialSectionOut] = []
    config: SpecialsConfigOut


class VehicleSpecialImportEntryIn(BaseModel):
    badge: str = ""
    title: str = ""
    subtitle: str = ""
    price_text: str = ""
    payment_text: str = ""
    mileage_text: str = ""
    note: str = ""
    score: Optional[float] = None
    score_label: str = ""
    image_url: str = ""
    link_url: str = ""


class VehicleSpecialImportIn(BaseModel):
    source_key: str
    source_url: str = ""
    entries: List[VehicleSpecialImportEntryIn]


class SpecialsConfigIn(BaseModel):
    used_srp_url: str = ""


class AgentLoopPresetOut(BaseModel):
    key: str
    label: str
    description: str
    starter_objective: str


class AgentLoopConfigOut(BaseModel):
    provider: str
    configured: bool
    model: str
    reasoning_effort: str
    max_steps: int
    presets: List[AgentLoopPresetOut]


class AgentLoopRunIn(BaseModel):
    preset_key: str
    objective: str = ""


class AgentLoopEventOut(BaseModel):
    id: int
    run_id: int
    step_index: int
    event_type: str
    title: str
    content: str
    payload: Dict[str, Any] = {}
    created_at: str
    created_ts: float


class AgentLoopRunOut(BaseModel):
    id: int
    preset_key: str
    preset_label: str
    objective: str
    status: str
    created_at: str
    created_ts: float
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    model: str
    reasoning_effort: str
    total_steps: int
    summary: str = ""
    latest_thinking: str = ""
    high_priority_actions: List[str] = []
    observations: List[str] = []
    error_message: str = ""


class AgentLoopRunDetailOut(AgentLoopRunOut):
    events: List[AgentLoopEventOut]


class AgentLoopRunListOut(BaseModel):
    total: int
    entries: List[AgentLoopRunOut]


def now_local() -> datetime:
    return datetime.now(ZoneInfo(RULES_TIMEZONE))


def now_iso() -> str:
    return now_local().replace(microsecond=0).isoformat()


def now_local_input_value() -> str:
    return now_local().replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


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


def normalize_optional_phone(value: str, field_name: str = "phone_number") -> str:
    return normalize_short_text(value, field_name, max_len=40)


def normalize_optional_email(value: str, field_name: str = "email") -> str:
    text = normalize_short_text(value, field_name, max_len=160).lower()
    if text and ("@" not in text or "." not in text.split("@", 1)[-1]):
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid email address")
    return text


def normalize_notes(value: str, field_name: str, max_len: int = 4000) -> str:
    text = str(value or "").replace("\r\n", "\n").strip()
    if len(text) > max_len:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return text


def parse_bdc_sales_tracker_dms_numbers(value: str) -> List[str]:
    raw = normalize_notes(value, "dms_numbers_text", max_len=4000)
    if not raw:
        return []
    seen: set[str] = set()
    numbers: List[str] = []
    for chunk in re.split(r"[\s,;|]+", raw):
        token = normalize_short_text(chunk, "dms_number", max_len=80)
        if not token:
            continue
        lowered = token.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        numbers.append(token)
    if len(numbers) > 250:
        raise HTTPException(status_code=400, detail="too many DMS numbers in one paste")
    return numbers


def normalize_tracker_rate(value: Any, field_name: str) -> float:
    try:
        rate = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a number") from exc
    if rate < 0 or rate > 1:
        raise HTTPException(status_code=400, detail=f"{field_name} must be between 0 and 1")
    return round(rate, 4)


def parse_bdc_sales_tracker_log_identity(value: str) -> Tuple[str, str, str]:
    raw = normalize_short_text(value, "customer_name", max_len=220)
    if not raw:
        raise HTTPException(status_code=400, detail="customer_name is required")
    parts = [normalize_short_text(part, "customer_name", max_len=220) for part in raw.split("/")]
    parts = [part for part in parts if part]
    if len(parts) >= 3:
        customer_name = normalize_short_text(parts[0], "customer_name", max_len=120)
        opportunity_id = normalize_short_text(parts[1], "opportunity_id", max_len=80)
        dms_number = normalize_short_text(parts[2], "dms_number", max_len=80)
        return customer_name, opportunity_id, dms_number
    return normalize_short_text(raw, "customer_name", max_len=120), "", ""


def normalize_tracker_focus_key(value: str) -> str:
    text = normalize_short_text(value, "focus_key", max_len=80).lower()
    if not re.fullmatch(r"[a-z0-9_:-]+", text):
        raise HTTPException(status_code=400, detail="focus_key must use letters, numbers, colons, underscores, or hyphens")
    return text


def normalize_dealership(value: str) -> str:
    mapping = {item.lower(): item for item in DEALERSHIPS}
    normalized = mapping.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="dealership must be Kia, Mazda, or Outlet")
    return normalized


def normalize_optional_dealership(value: Optional[str]) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    return normalize_dealership(text)


def normalize_sms_phone(value: str) -> Optional[str]:
    raw = str(value or "").strip()
    if not raw:
        return None
    digits = "".join(char for char in raw if char.isdigit())
    if raw.startswith("+") and 8 <= len(digits) <= 15:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return None


def mask_phone(value: str) -> str:
    digits = "".join(char for char in str(value or "") if char.isdigit())
    if len(digits) >= 4:
        return f"***{digits[-4:]}"
    return str(value or "").strip() or "unknown number"


def mask_email(value: str) -> str:
    text = str(value or "").strip()
    if "@" not in text:
        return text or "unknown email"
    local, domain = text.split("@", 1)
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


def compact_error_text(error: Exception) -> str:
    text = " ".join(str(error or "").strip().split())
    if len(text) > 120:
        return f"{text[:117]}..."
    return text or "unexpected error"


def sms_notifications_configured() -> bool:
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


def email_notifications_configured() -> bool:
    return bool(RESEND_API_KEY and BDC_NOTIFY_EMAIL_FROM)


def admin_credentials_configured() -> bool:
    return bool(ADMIN_USERNAME and ADMIN_PASSWORD)


def get_notification_config() -> NotificationConfigOut:
    return NotificationConfigOut(
        sms_configured=sms_notifications_configured(),
        email_configured=email_notifications_configured(),
    )


def build_test_notification_body() -> str:
    lines = [
        "Dealership Tool SMS test.",
        "If you received this message, Twilio is configured correctly.",
        f"Sent at: {now_iso()}",
        f"From: {TWILIO_FROM_NUMBER or 'Twilio sender'}",
    ]
    if APP_BASE_URL:
        lines.extend(["", f"Open the app: {APP_BASE_URL}"])
    return "\n".join(lines)


def send_notification_test_sms(raw_phone_number: str) -> NotificationTestSmsOut:
    if not sms_notifications_configured():
        raise HTTPException(status_code=400, detail="Twilio is not configured")
    sms_target = normalize_sms_phone(raw_phone_number)
    if not sms_target:
        raise HTTPException(status_code=400, detail="phone number must be a valid US or E.164 number")
    try:
        sid = send_twilio_sms(sms_target, build_test_notification_body())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=compact_error_text(exc)) from exc
    return NotificationTestSmsOut(
        phone_number=sms_target,
        status=(
            f"Twilio accepted a test text for {sms_target}. "
            f"Delivery may still be pending carrier confirmation. Message SID: {sid}"
        ),
    )


def build_test_notification_email_subject() -> str:
    return "Dealership Tool email test"


def build_test_notification_email_body() -> str:
    lines = [
        "Dealership Tool email test.",
        "If you received this email, Resend is configured correctly.",
        f"Sent at: {now_iso()}",
        f"From: {BDC_NOTIFY_EMAIL_FROM or 'Resend sender'}",
    ]
    if BDC_NOTIFY_EMAIL_REPLY_TO:
        lines.append(f"Reply-To: {BDC_NOTIFY_EMAIL_REPLY_TO}")
    if APP_BASE_URL:
        lines.extend(["", f"Open the app: {APP_BASE_URL}"])
    return "\n".join(lines)


def send_notification_test_email(raw_email: str) -> NotificationTestEmailOut:
    if not email_notifications_configured():
        raise HTTPException(status_code=400, detail="Resend is not configured")
    email_target = normalize_optional_email(raw_email, "email")
    if not email_target:
        raise HTTPException(status_code=400, detail="email is required")
    try:
        email_id = send_resend_email(email_target, build_test_notification_email_subject(), build_test_notification_email_body())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=compact_error_text(exc)) from exc
    return NotificationTestEmailOut(
        email=email_target,
        status=(
            f"Resend accepted a test email for {email_target}. "
            f"Delivery may still be pending mailbox provider confirmation. Email ID: {email_id}"
        ),
    )


def build_assignment_notification_subject(assignment_row: Dict[str, Any]) -> str:
    customer_name = str(assignment_row.get("customer_name") or "").strip() or "New customer"
    lead_store = str(assignment_row.get("lead_store") or assignment_row.get("salesperson_dealership") or "").strip() or "BDC"
    return f"New BDC lead: {customer_name} ({lead_store})"


def build_assignment_notification_body(assignment_row: Dict[str, Any]) -> str:
    customer_name = str(assignment_row.get("customer_name") or "").strip() or "No customer name entered"
    customer_phone = str(assignment_row.get("customer_phone") or "").strip() or "No customer phone entered"
    bdc_agent_name = str(assignment_row.get("bdc_agent_name") or "").strip() or "BDC"
    lead_store = str(assignment_row.get("lead_store") or assignment_row.get("salesperson_dealership") or "").strip() or "BDC"
    salesperson_name = str(assignment_row.get("salesperson_name") or "").strip() or "Salesperson"
    assigned_at = str(assignment_row.get("assigned_at") or now_iso())
    lines = [
        f"New BDC lead assigned to {salesperson_name}.",
        "",
        f"Store: {lead_store}",
        f"Customer: {customer_name}",
        f"Phone: {customer_phone}",
        f"Assigned by: {bdc_agent_name}",
        f"Assigned at: {assigned_at}",
    ]
    if APP_BASE_URL:
        lines.extend(["", f"Open the app: {APP_BASE_URL}"])
    return "\n".join(lines)


def send_twilio_sms(to_number: str, body: str) -> str:
    if not sms_notifications_configured():
        raise RuntimeError("Twilio is not configured")
    request_body = urllib.parse.urlencode(
        {
            "To": to_number,
            "From": TWILIO_FROM_NUMBER,
            "Body": body,
        }
    ).encode("utf-8")
    auth_token = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
        data=request_body,
        method="POST",
    )
    request.add_header("Authorization", f"Basic {auth_token}")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Twilio HTTP {exc.code}: {detail or exc.reason}") from exc
    except Exception as exc:
        raise RuntimeError(f"Twilio request failed: {compact_error_text(exc)}") from exc
    sid = str(payload.get("sid") or "").strip()
    if not sid:
        raise RuntimeError("Twilio response did not include a message SID")
    return sid


def send_resend_email(to_email: str, subject: str, text_body: str) -> str:
    if not email_notifications_configured():
        raise RuntimeError("Resend is not configured")
    payload: Dict[str, Any] = {
        "from": BDC_NOTIFY_EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    if BDC_NOTIFY_EMAIL_REPLY_TO:
        payload["reply_to"] = BDC_NOTIFY_EMAIL_REPLY_TO
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    request.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Resend HTTP {exc.code}: {detail or exc.reason}") from exc
    except Exception as exc:
        raise RuntimeError(f"Resend request failed: {compact_error_text(exc)}") from exc
    email_id = str(data.get("id") or "").strip()
    if not email_id:
        raise RuntimeError("Resend response did not include an email id")
    return email_id


def deliver_assignment_notifications(
    salesperson_row: Dict[str, Any],
    assignment_row: Dict[str, Any],
) -> Tuple[str, str]:
    sms_status = ""
    email_status = ""
    notify_sms = bool(int(salesperson_row.get("notify_sms") or 0))
    notify_email = bool(int(salesperson_row.get("notify_email") or 0))
    phone_number = str(salesperson_row.get("phone_number") or "").strip()
    email = str(salesperson_row.get("email") or "").strip()
    subject = build_assignment_notification_subject(assignment_row)
    body = build_assignment_notification_body(assignment_row)

    if notify_sms:
        if not phone_number:
            sms_status = "Text skipped: no phone number saved"
        elif not sms_notifications_configured():
            sms_status = "Text skipped: Twilio is not configured"
        else:
            sms_target = normalize_sms_phone(phone_number)
            if not sms_target:
                sms_status = "Text skipped: phone number must be a valid US or E.164 number"
            else:
                try:
                    send_twilio_sms(sms_target, body)
                    sms_status = f"Text sent to {mask_phone(phone_number)}"
                except Exception as exc:
                    sms_status = f"Text failed: {compact_error_text(exc)}"

    if notify_email:
        if not email:
            email_status = "Email skipped: no email saved"
        elif not email_notifications_configured():
            email_status = "Email skipped: Resend is not configured"
        else:
            try:
                send_resend_email(email, subject, body)
                email_status = f"Email sent to {mask_email(email)}"
            except Exception as exc:
                email_status = f"Email failed: {compact_error_text(exc)}"

    return sms_status, email_status


def normalize_freshup_event_type(value: str) -> str:
    text = normalize_short_text(value, "event_type", max_len=40).lower()
    if text not in ("page_view", "submit", "link_click"):
        raise HTTPException(status_code=400, detail="event_type must be page_view, submit, or link_click")
    return text


def normalize_brand(value: str) -> str:
    mapping = {item.lower(): item for item in SERVICE_BRANDS}
    normalized = mapping.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="brand must be Kia or Mazda")
    return normalized


def normalize_quote_brand(value: str) -> str:
    mapping = {item.lower(): item for item in QUOTE_BRANDS}
    normalized = mapping.get(str(value or "").strip().lower())
    if not normalized:
        raise HTTPException(status_code=400, detail="quote brand must be Kia New, Mazda New, or Used")
    return normalized


def normalize_bdc_distribution(value: str) -> str:
    text = str(value or "").strip().lower()
    if text in ("franchise", "by_franchise", "store"):
        return "franchise"
    if text in ("global", "all", "combined"):
        return "global"
    if text in ("universal", "kia_mazda", "kia-mazda", "shared"):
        return "universal"
    raise HTTPException(status_code=400, detail="distribution mode must be franchise, global, or universal")


def get_bdc_distribution_mode() -> str:
    saved = get_meta(BDC_DISTRIBUTION_META_KEY)
    if not saved:
        return "franchise"
    try:
        return normalize_bdc_distribution(saved)
    except HTTPException:
        return "franchise"


def get_bdc_undo_settings() -> BdcUndoSettingsOut:
    require_value = str(get_meta(BDC_UNDO_REQUIRE_META_KEY) or "1").strip().lower()
    require_password = require_value not in ("0", "false", "no", "off")
    password_hint = str(get_meta(BDC_UNDO_PASSWORD_META_KEY) or "bdc")
    return BdcUndoSettingsOut(require_password=require_password, password_hint="*" * len(password_hint))


def set_bdc_undo_settings(settings: BdcUndoSettingsIn) -> BdcUndoSettingsOut:
    require_password = bool(settings.require_password)
    password = str(settings.password or "").strip() or "bdc"
    set_meta(BDC_UNDO_REQUIRE_META_KEY, "1" if require_password else "0")
    set_meta(BDC_UNDO_PASSWORD_META_KEY, password)
    return get_bdc_undo_settings()


def default_tab_visibility() -> TabVisibilityOut:
    return TabVisibilityOut(
        entries=[TabVisibilityItem(tab_id=tab_id, visible=True, position=index) for index, tab_id in enumerate(TAB_VISIBILITY_IDS)]
    )


def normalize_tab_visibility_entries(entries: List[TabVisibilityItem]) -> TabVisibilityOut:
    incoming_visibility = {
        str(entry.tab_id): bool(entry.visible) for entry in entries if str(entry.tab_id) in TAB_VISIBILITY_IDS
    }
    order_weights: Dict[str, Tuple[int, int]] = {}
    for index, entry in enumerate(entries):
        tab_id = str(entry.tab_id)
        if tab_id not in TAB_VISIBILITY_IDS:
            continue
        try:
            position = int(entry.position)
        except (TypeError, ValueError):
            position = index
        order_weights[tab_id] = (position, index)
    default_index = {tab_id: index for index, tab_id in enumerate(TAB_VISIBILITY_IDS)}
    ordered_ids = sorted(
        TAB_VISIBILITY_IDS,
        key=lambda tab_id: order_weights.get(tab_id, (default_index[tab_id], default_index[tab_id])),
    )
    return TabVisibilityOut(
        entries=[
            TabVisibilityItem(tab_id=tab_id, visible=incoming_visibility.get(tab_id, True), position=index)
            for index, tab_id in enumerate(ordered_ids)
        ]
    )


def get_tab_visibility() -> TabVisibilityOut:
    raw = str(get_meta(TAB_VISIBILITY_META_KEY) or "").strip()
    if not raw:
        return default_tab_visibility()
    try:
        parsed = json.loads(raw)
    except Exception:
        return default_tab_visibility()
    if isinstance(parsed, list):
        try:
            return normalize_tab_visibility_entries([TabVisibilityItem(**entry) for entry in parsed if isinstance(entry, dict)])
        except Exception:
            return default_tab_visibility()
    if isinstance(parsed, dict) and isinstance(parsed.get("entries"), list):
        try:
            return normalize_tab_visibility_entries(
                [TabVisibilityItem(**entry) for entry in parsed["entries"] if isinstance(entry, dict)]
            )
        except Exception:
            return default_tab_visibility()
    if not isinstance(parsed, dict):
        return default_tab_visibility()
    return TabVisibilityOut(
        entries=[
            TabVisibilityItem(tab_id=tab_id, visible=bool(parsed.get(tab_id, True)), position=index)
            for index, tab_id in enumerate(TAB_VISIBILITY_IDS)
        ]
    )


def set_tab_visibility(payload: TabVisibilityIn) -> TabVisibilityOut:
    normalized = normalize_tab_visibility_entries(payload.entries or [])
    data = {"entries": [entry.model_dump() for entry in normalized.entries]}
    set_meta(TAB_VISIBILITY_META_KEY, json.dumps(data))
    return normalized


def default_freshup_links_config() -> FreshUpLinksConfigOut:
    return FreshUpLinksConfigOut(
        page_title="Start with Bert Ogden Mission",
        page_subtitle="Drop your info first, then choose the next step that fits you best.",
        form_title="Send us your contact info",
        form_subtitle="A sales specialist will follow up fast.",
        submit_label="Send My Info",
        stores=[
            FreshUpLinkStoreOut(
                dealership="Kia",
                display_name="Mission Kia",
                call_label="Call us now",
                call_url="tel:(956) 429 8898",
                maps_label="Google Maps",
                maps_url="https://www.google.com/maps/place/Bert+Ogden+Mission+Kia/@26.1969595,-98.2927102,17z/data=!3m1!4b1!4m6!3m5!1s0x8665a7eced82c205:0x3fe685adeab8c28e!8m2!3d26.1969595!4d-98.2901353!16s%2Fg%2F1tjdgmn5?entry=ttu&g_ep=EgoyMDI2MDIyMi4wIKXMDSoASAFQAw%3D%3D",
                instagram_url="https://www.instagram.com/bertogdenkiamission/",
                facebook_url="https://www.facebook.com/BertOgdenMissionKia",
                youtube_url="https://www.youtube.com/channel/UCGVeQ1vKWK3bLq396D8P_4A",
                soft_pull_label="Quick Qualify",
                soft_pull_url="https://www.700dealer.com/QuickQualify/fcb574d194ea477c945ec558b605c0f7-202061",
                hard_pull_label="Quick Application",
                hard_pull_url="https://www.700dealer.com/QuickQualify/efdbaaebf9444bf18a6e3ca931db75f3-2020120",
                inventory_label="View Kia New Inventory",
                inventory_url="https://www.bertogdenmissionkia.com/new-vehicles/",
            ),
            FreshUpLinkStoreOut(
                dealership="Mazda",
                display_name="Mission Mazda",
                call_label="",
                call_url="",
                maps_label="",
                maps_url="",
                instagram_url="",
                facebook_url="",
                youtube_url="",
                soft_pull_label="Quick Qualify",
                soft_pull_url="https://www.700dealer.com/QuickQualify/3019d192efae4e3684cc49a88095425a-202061",
                hard_pull_label="Quick Application",
                hard_pull_url="https://www.700dealer.com/QuickQualify/d303d5b01d0f44df9ca5aad9a8a408dd-2019930",
                inventory_label="View Mazda New Inventory",
                inventory_url="https://www.bertogdenmissionmazda.com/new-vehicles/",
            ),
            FreshUpLinkStoreOut(
                dealership="Outlet",
                display_name="Mission Auto Outlet",
                call_label="",
                call_url="",
                maps_label="",
                maps_url="",
                instagram_url="",
                facebook_url="",
                youtube_url="",
                soft_pull_label="Quick Qualify",
                soft_pull_url="https://www.700dealer.com/QuickQualify/88a0b45934bf4a4e8937c8ccb61c463f-202061",
                hard_pull_label="Quick Application",
                hard_pull_url="https://www.700dealer.com/QuickQualify/6d6d3105f3d3447a95e729875e0f248b-2020120",
                inventory_label="View Pre-Owned Inventory",
                inventory_url="https://www.bertogdenmissionautooutlet.com/inventory/used-2021-kia-forte-gt-line-fwd-4d-sedan-3kpf34ad7me310864/",
            ),
        ],
    )


def fetch_freshup_links_config() -> FreshUpLinksConfigOut:
    raw = str(get_meta(FRESHUP_LINKS_META_KEY) or "").strip()
    if not raw:
        return default_freshup_links_config()
    try:
        parsed = json.loads(raw)
        return FreshUpLinksConfigOut(**parsed)
    except Exception:
        return default_freshup_links_config()


def update_freshup_links_config(payload: FreshUpLinksConfigIn) -> FreshUpLinksConfigOut:
    normalized = FreshUpLinksConfigOut(
        page_title=normalize_short_text(payload.page_title, "page_title", max_len=160),
        page_subtitle=normalize_short_text(payload.page_subtitle, "page_subtitle", max_len=320),
        form_title=normalize_short_text(payload.form_title, "form_title", max_len=160),
        form_subtitle=normalize_short_text(payload.form_subtitle, "form_subtitle", max_len=320),
        submit_label=normalize_short_text(payload.submit_label, "submit_label", max_len=80),
        stores=[
            FreshUpLinkStoreOut(
                dealership=normalize_dealership(store.dealership),
                display_name=normalize_short_text(store.display_name, "display_name", max_len=120),
                call_label=normalize_short_text(store.call_label, "call_label", max_len=80),
                call_url=normalize_short_text(store.call_url, "call_url", max_len=500),
                maps_label=normalize_short_text(store.maps_label, "maps_label", max_len=80),
                maps_url=normalize_short_text(store.maps_url, "maps_url", max_len=500),
                instagram_url=normalize_short_text(store.instagram_url, "instagram_url", max_len=500),
                facebook_url=normalize_short_text(store.facebook_url, "facebook_url", max_len=500),
                youtube_url=normalize_short_text(store.youtube_url, "youtube_url", max_len=500),
                soft_pull_label=normalize_short_text(store.soft_pull_label, "soft_pull_label", max_len=80),
                soft_pull_url=normalize_short_text(store.soft_pull_url, "soft_pull_url", max_len=500),
                hard_pull_label=normalize_short_text(store.hard_pull_label, "hard_pull_label", max_len=80),
                hard_pull_url=normalize_short_text(store.hard_pull_url, "hard_pull_url", max_len=500),
                inventory_label=normalize_short_text(store.inventory_label, "inventory_label", max_len=80),
                inventory_url=normalize_short_text(store.inventory_url, "inventory_url", max_len=500),
            )
            for store in payload.stores
        ],
    )
    set_meta(FRESHUP_LINKS_META_KEY, normalized.model_dump_json())
    return normalized


def normalize_bdc_lead_store(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return "Kia"
    lowered = text.lower()
    if lowered in ("kia/mazda", "kia & mazda", "kia+mazda", "kiamazda"):
        return "Kia/Mazda"
    return normalize_dealership(text)


def bdc_pool_key_for_mode(distribution_mode: str, lead_store: str) -> Optional[str]:
    if distribution_mode == "global":
        return None
    if distribution_mode == "universal":
        return "Outlet" if lead_store == "Outlet" else "Kia/Mazda"
    return lead_store


def fetch_bdc_pool_salespeople(pool_key: Optional[str]) -> List[SalespersonOut]:
    query = "SELECT * FROM salespeople WHERE active = 1"
    params: List[Any] = []
    if pool_key == "Kia/Mazda":
        query += " AND dealership IN (?, ?)"
        params.extend(["Kia", "Mazda"])
    elif pool_key:
        query += " AND dealership = ?"
        params.append(pool_key)
    query += " ORDER BY id ASC"
    return [salesperson_out(row) for row in db_query_all(query, tuple(params))]


def bdc_pointer_key(pool_key: Optional[str]) -> str:
    if pool_key is None:
        return "bdc:pointer:all"
    if pool_key == "Kia/Mazda":
        return "bdc:pointer:kia-mazda"
    return f"bdc:pointer:{pool_key.lower()}"


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


def upload_url(folder_name: str, stored_name: str) -> str:
    return f"/uploads/{folder_name}/{stored_name}"


def save_upload_file(
    upload: UploadFile,
    *,
    folder_path: str,
    folder_name: str,
    allowed_exts: set[str],
    max_bytes: int,
) -> Tuple[str, str, str]:
    original_filename = str(upload.filename or "").strip()
    if not original_filename:
        raise HTTPException(status_code=400, detail="file is required")

    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="file type is not allowed")

    stored_name = f"{int(time.time())}-{secrets.token_hex(8)}{ext}"
    destination = os.path.join(folder_path, stored_name)
    total_bytes = 0

    with open(destination, "wb") as handle:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                handle.close()
                try:
                    os.remove(destination)
                except OSError:
                    pass
                raise HTTPException(status_code=400, detail="file is too large")
            handle.write(chunk)

    upload.file.close()
    return original_filename, stored_name, upload_url(folder_name, stored_name)


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


def is_sunday(day_value: date) -> bool:
    return day_value.weekday() == 6


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


def normalize_optional_url(value: str, field_name: str = "url", max_len: int = 500) -> str:
    text = normalize_short_text(value, field_name, max_len=max_len)
    if not text:
        return ""
    parsed = urllib.parse.urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a full http(s) URL")
    return text


def normalize_special_source_key(value: str) -> str:
    key = normalize_short_text(value, "source_key", max_len=40).lower()
    if key not in SPECIALS_SOURCE_DEFINITIONS:
        raise HTTPException(status_code=400, detail="unknown specials source")
    return key


def specials_source_definition(source_key: str) -> Dict[str, str]:
    return SPECIALS_SOURCE_DEFINITIONS[normalize_special_source_key(source_key)]


def get_specials_config() -> SpecialsConfigOut:
    used_srp_url = normalize_optional_url(str(get_meta(SPECIALS_USED_SOURCE_META_KEY) or ""), "used_srp_url") if str(get_meta(SPECIALS_USED_SOURCE_META_KEY) or "").strip() else ""
    return SpecialsConfigOut(
        kia_new_url=SPECIALS_KIA_NEW_URL,
        mazda_new_url=SPECIALS_MAZDA_NEW_URL,
        used_srp_url=used_srp_url,
    )


def save_specials_config(payload: SpecialsConfigIn) -> SpecialsConfigOut:
    used_srp_url = normalize_optional_url(payload.used_srp_url, "used_srp_url") if str(payload.used_srp_url or "").strip() else ""
    set_meta(SPECIALS_USED_SOURCE_META_KEY, used_srp_url)
    return get_specials_config()


def browser_fetch_text(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    json_payload: Optional[Dict[str, Any]] = None,
) -> str:
    request_headers = headers or {}
    try:
        if method.upper() == "POST":
            response = curl_requests.post(url, headers=request_headers, json=json_payload, impersonate="chrome124", timeout=30)
        else:
            response = curl_requests.get(url, headers=request_headers, impersonate="chrome124", timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as exc:  # pragma: no cover - surfaced as API detail
        raise HTTPException(status_code=502, detail=f"Could not load specials source: {exc}") from exc


def browser_fetch_json(
    url: str,
    *,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    json_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    raw = browser_fetch_text(url, method=method, headers=headers, json_payload=json_payload)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Specials source returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="Specials source returned an unexpected payload")
    return parsed


def parse_remote_iso_datetime(value: Any) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    candidate = text.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(candidate)
    except ValueError:
        return None


def collapse_whitespace(value: Any) -> str:
    return " ".join(str(value or "").split())


def numeric_token_from_text(value: str) -> float:
    text = str(value or "")
    match = re.search(r"(\d[\d,]*)(?:\.\d+)?", text)
    if not match:
        return 0.0
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return 0.0


def parse_vehicle_year(value: str) -> int:
    match = re.search(r"\b((?:19|20)\d{2})\b", str(value or ""))
    return int(match.group(1)) if match else 0


def score_used_special_candidate(title: str, price_text: str, mileage_text: str) -> Tuple[float, str]:
    current_year = now_local().year
    year_value = parse_vehicle_year(title)
    price_value = numeric_token_from_text(price_text)
    mileage_value = numeric_token_from_text(mileage_text)

    price_score = 0.0
    if price_value:
        if price_value <= 18000:
            price_score = 45.0
        elif price_value <= 24000:
            price_score = 36.0
        elif price_value <= 30000:
            price_score = 28.0
        elif price_value <= 36000:
            price_score = 20.0
        else:
            price_score = 12.0

    mileage_score = 0.0
    if mileage_value:
        if mileage_value <= 15000:
            mileage_score = 35.0
        elif mileage_value <= 30000:
            mileage_score = 28.0
        elif mileage_value <= 45000:
            mileage_score = 22.0
        elif mileage_value <= 60000:
            mileage_score = 16.0
        else:
            mileage_score = 8.0

    year_score = 0.0
    if year_value:
        age = max(0, current_year - year_value)
        if age <= 1:
            year_score = 20.0
        elif age <= 2:
            year_score = 16.0
        elif age <= 3:
            year_score = 12.0
        elif age <= 5:
            year_score = 8.0
        else:
            year_score = 4.0

    score = round(price_score + mileage_score + year_score, 1)
    if score >= 80:
        label = "Strong deal"
    elif score >= 60:
        label = "Solid value"
    elif score >= 40:
        label = "Watch list"
    else:
        label = "Needs review"
    return score, label


def format_currency_short(value: float) -> str:
    return f"${int(round(value)):,}"


def extract_special_end_label(*values: Any) -> str:
    for value in values:
        text = str(value or "")
        match = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", text)
        if match:
            return match.group(1)
    return ""


def summarize_kia_special_terms(disclaimer: str) -> Tuple[str, str, str, str]:
    text = collapse_whitespace(disclaimer)
    apr_match = re.search(r"(\d+(?:\.\d+)?)%\s*APR(?: financing)?[^.]*?(?:up to|for)\s*(\d+)\s*months?", text, re.IGNORECASE)
    monthly_match = re.search(r"\$([\d,]+)\s*/\s*month|\$([\d,]+)\s+month", text, re.IGNORECASE)
    due_match = re.search(r"\$([\d,]+)\s+due at signing", text, re.IGNORECASE)
    delivery_match = extract_special_end_label(text)

    apr_text = ""
    if apr_match:
        apr_value = apr_match.group(1)
        term_value = apr_match.group(2)
        apr_text = f"{apr_value}% APR / {term_value} mos"

    monthly_value = (monthly_match.group(1) or monthly_match.group(2)) if monthly_match else ""
    monthly_text = f"${monthly_value}/mo" if monthly_value else ""

    summary_line = monthly_text or apr_text or "Live Kia offer"
    chip_line = apr_text if monthly_text and apr_text else (monthly_text or "")
    note_parts: List[str] = []
    if due_match:
        due_value = due_match.group(1)
        note_parts.append(f"${due_value} due at signing")
    if delivery_match:
        note_parts.append(f"Ends {delivery_match}")
    note_line = " • ".join(note_parts) if note_parts else "See dealer for full disclaimer."
    score_label = apr_text or monthly_text or "Live offer"
    return summary_line, chip_line, note_line, score_label


def kia_specials_feed_url(page_id: str, source_url: str) -> str:
    params = urllib.parse.urlencode(
        {
            "jira_id": SPECIALS_KIA_JIRA_ID,
            "type": "new_car",
            "time": datetime.utcnow().isoformat() + "Z",
            "url": source_url,
            "pageid": page_id,
        }
    )
    return f"{SPECIALS_KIA_OFFERS_JS_URL}?{params}"


def build_kia_special_import(source_url: str) -> VehicleSpecialImportIn:
    page_html = browser_fetch_text(source_url)
    page_match = re.search(r'class=["\']nepenthe-new-specials["\'][^>]*data-pageid=["\']([^"\']+)["\']', page_html, re.IGNORECASE)
    if not page_match:
        raise HTTPException(status_code=502, detail="Could not find the Kia specials feed on the page")
    page_id = page_match.group(1).strip()
    feed = browser_fetch_json(kia_specials_feed_url(page_id, source_url))
    groups = feed.get("groups") or []
    if not groups:
        raise HTTPException(status_code=502, detail="Kia specials feed returned no groups")

    now_ts = time.time()
    entries: List[VehicleSpecialImportEntryIn] = []
    seen_links: set[str] = set()
    for group in groups:
        for special in group.get("specials") or []:
            if special.get("deleted") or not special.get("enabled", True):
                continue
            dates = special.get("dates") or {}
            start_at = parse_remote_iso_datetime(dates.get("start"))
            end_at = parse_remote_iso_datetime(dates.get("end"))
            if start_at and start_at.timestamp() > now_ts:
                continue
            if end_at and end_at.timestamp() < now_ts:
                continue

            car = special.get("car") or {}
            title = collapse_whitespace(
                " ".join(
                    [
                        str(car.get("year") or "").strip(),
                        str(car.get("make") or "").strip(),
                        str(car.get("model") or "").strip(),
                        str(car.get("trim") or "").strip(),
                    ]
                )
            )
            if not title:
                continue
            disclaimer = collapse_whitespace(special.get("disclaimer") or "")
            summary_line, chip_line, note_line, score_label = summarize_kia_special_terms(disclaimer)
            button_url = ""
            for button in special.get("buttons") or []:
                candidate = str(button.get("url") or "").strip()
                if candidate.startswith("http"):
                    button_url = candidate
                    break
            dedupe_key = f"{title.lower()}::{button_url.lower()}"
            if dedupe_key in seen_links:
                continue
            seen_links.add(dedupe_key)
            entries.append(
                VehicleSpecialImportEntryIn(
                    badge="Kia New Special",
                    title=title,
                    subtitle=collapse_whitespace((special.get("evergreen") or {}).get("description") or "Live Kia lease and APR offer"),
                    price_text=summary_line,
                    payment_text=chip_line,
                    mileage_text="",
                    note=note_line,
                    score_label=score_label,
                    image_url=str(special.get("header_image") or special.get("image") or "").strip(),
                    link_url=button_url or source_url,
                )
            )
    if not entries:
        raise HTTPException(status_code=502, detail="Kia specials feed returned no active offers")
    return VehicleSpecialImportIn(source_key="kia_new", source_url=source_url, entries=entries)


def extract_mvn_algolia_settings(page_html: str) -> Dict[str, Any]:
    match = re.search(r"var mvnAlgSettings = (\{.*?\});", page_html, re.DOTALL)
    if not match:
        raise HTTPException(status_code=502, detail="Could not find the Mazda inventory search settings on the page")
    try:
        parsed = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Mazda inventory settings returned invalid JSON") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="Mazda inventory settings returned an unexpected payload")
    return parsed


def build_mazda_special_import(source_url: str) -> VehicleSpecialImportIn:
    page_html = browser_fetch_text(source_url)
    settings = extract_mvn_algolia_settings(page_html)
    app_id = str(settings.get("appId") or "").strip()
    api_key = str(settings.get("apiKeySearch") or "").strip()
    inventory_index = str(settings.get("inventoryIndex") or "").strip()
    if not app_id or not api_key or not inventory_index:
        raise HTTPException(status_code=502, detail="Mazda inventory search settings are missing required values")

    algolia_url = f"https://{app_id}-dsn.algolia.net/1/indexes/{inventory_index}/query"
    algolia_headers = {
        "X-Algolia-Application-Id": app_id,
        "X-Algolia-API-Key": api_key,
        "Content-Type": "application/json",
        "Origin": "https://www.bertogdenmissionmazda.com",
        "Referer": source_url,
    }
    algolia_payload = {
        "query": "",
        "hitsPerPage": 36,
        "filters": "type:New",
    }
    result = browser_fetch_json(algolia_url, method="POST", headers=algolia_headers, json_payload=algolia_payload)
    hits = result.get("hits") or []
    if not hits:
        raise HTTPException(status_code=502, detail="Mazda inventory search returned no vehicles")

    candidates: List[Tuple[float, float, Dict[str, Any]]] = []
    for hit in hits:
        if not isinstance(hit, dict):
            continue
        title = collapse_whitespace(
            " ".join(
                [
                    str(hit.get("year") or "").strip(),
                    str(hit.get("make") or "").strip(),
                    str(hit.get("model") or "").strip(),
                    str(hit.get("trim") or "").strip(),
                ]
            )
        )
        link_url = str(hit.get("link") or "").strip()
        image_url = str(hit.get("thumbnail") or "").strip()
        if not title or not link_url or not image_url:
            continue
        msrp_value = numeric_token_from_text(str(hit.get("msrp") or ""))
        our_price_value = numeric_token_from_text(str(hit.get("our_price") or ""))
        savings_value = max(0.0, msrp_value - our_price_value) if msrp_value and our_price_value else 0.0
        savings_pct = (savings_value / msrp_value) if msrp_value else 0.0
        candidates.append((savings_value, savings_pct, hit))

    if not candidates:
        raise HTTPException(status_code=502, detail="Mazda inventory search returned no usable vehicles")

    candidates.sort(key=lambda item: (-item[0], -item[1], numeric_token_from_text(str(item[2].get("our_price") or ""))))
    entries: List[VehicleSpecialImportEntryIn] = []
    for savings_value, _, hit in candidates[:16]:
        title = collapse_whitespace(
            " ".join(
                [
                    str(hit.get("year") or "").strip(),
                    str(hit.get("make") or "").strip(),
                    str(hit.get("model") or "").strip(),
                    str(hit.get("trim") or "").strip(),
                ]
            )
        )
        ext_color = collapse_whitespace(hit.get("ext_color") or "")
        int_color = collapse_whitespace(hit.get("int_color") or "")
        drivetrain = collapse_whitespace(hit.get("drivetrain") or "")
        subtitle_parts = [part for part in (ext_color, int_color, drivetrain) if part]
        price_value = numeric_token_from_text(str(hit.get("our_price") or ""))
        msrp_value = numeric_token_from_text(str(hit.get("msrp") or ""))
        mileage_value = numeric_token_from_text(str(hit.get("miles") or ""))
        payment_text = f"Save {format_currency_short(savings_value)} vs MSRP" if savings_value > 0 else "Current new-inventory pick"
        note_parts = []
        if msrp_value:
            note_parts.append(f"MSRP {format_currency_short(msrp_value)}")
        stock_number = collapse_whitespace(hit.get("stock") or "")
        if stock_number:
            note_parts.append(f"Stock {stock_number}")
        entries.append(
            VehicleSpecialImportEntryIn(
                badge="Mazda New Pick",
                title=title,
                subtitle=" • ".join(subtitle_parts) if subtitle_parts else "Live Mazda new-inventory highlight",
                price_text=f"Bert Ogden Price {format_currency_short(price_value)}" if price_value else "",
                payment_text=payment_text,
                mileage_text=f"{int(mileage_value):,} miles" if mileage_value else "",
                note=" • ".join(note_parts) if note_parts else "Imported from the live Mazda new inventory feed.",
                score_label=payment_text if savings_value > 0 else "Live pick",
                image_url=str(hit.get("thumbnail") or "").strip(),
                link_url=str(hit.get("link") or "").strip(),
            )
        )
    return VehicleSpecialImportIn(source_key="mazda_new", source_url=source_url, entries=entries)


def import_auto_vehicle_special_source(source_key: str) -> SpecialsListOut:
    normalized_source_key = normalize_special_source_key(source_key)
    config = get_specials_config()
    if normalized_source_key == "kia_new":
        payload = build_kia_special_import(config.kia_new_url)
    elif normalized_source_key == "mazda_new":
        payload = build_mazda_special_import(config.mazda_new_url)
    else:
        raise HTTPException(status_code=400, detail="Automatic import is only available for Kia and Mazda website sources")
    return import_vehicle_special_feed(payload)


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
            phone_number TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            notify_sms INTEGER NOT NULL DEFAULT 0,
            notify_email INTEGER NOT NULL DEFAULT 0,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )
    ensure_column("salespeople", "phone_number", "TEXT NOT NULL DEFAULT ''")
    ensure_column("salespeople", "email", "TEXT NOT NULL DEFAULT ''")
    ensure_column("salespeople", "notify_sms", "INTEGER NOT NULL DEFAULT 0")
    ensure_column("salespeople", "notify_email", "INTEGER NOT NULL DEFAULT 0")
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
            lead_store TEXT NOT NULL DEFAULT '',
            salesperson_id INTEGER NOT NULL,
            salesperson_name TEXT NOT NULL,
            salesperson_dealership TEXT NOT NULL
        )
        """
    )
    ensure_column("bdc_assignment_log", "lead_store", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_assignment_log", "customer_name", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_assignment_log", "customer_phone", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_assignment_log", "distribution_mode", "TEXT NOT NULL DEFAULT 'franchise'")
    ensure_column("bdc_assignment_log", "notification_sms_status", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_assignment_log", "notification_email_status", "TEXT NOT NULL DEFAULT ''")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_sales_tracker_months (
            month_key TEXT PRIMARY KEY,
            goal REAL NOT NULL DEFAULT 252,
            appointment_set_rate_floor REAL NOT NULL DEFAULT 0.2,
            appointment_set_rate_target REAL NOT NULL DEFAULT 0.3,
            appointment_show_rate_floor REAL NOT NULL DEFAULT 0.5,
            appointment_show_rate_target REAL NOT NULL DEFAULT 0.6,
            sold_from_appointments_rate_floor REAL NOT NULL DEFAULT 0.1,
            sold_from_appointments_rate_target REAL NOT NULL DEFAULT 0.15,
            sold_from_appointments_rate_ceiling REAL NOT NULL DEFAULT 0.18,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "appointment_set_rate_floor",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_FLOOR}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "appointment_set_rate_target",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_TARGET}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "appointment_show_rate_floor",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_FLOOR}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "appointment_show_rate_target",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_TARGET}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "sold_from_appointments_rate_floor",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_FLOOR}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "sold_from_appointments_rate_target",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_TARGET}",
    )
    ensure_column(
        "bdc_sales_tracker_months",
        "sold_from_appointments_rate_ceiling",
        f"REAL NOT NULL DEFAULT {BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_CEILING}",
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_sales_tracker_agent_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT NOT NULL,
            agent_id INTEGER NOT NULL,
            agent_name TEXT NOT NULL,
            total_leads INTEGER NOT NULL DEFAULT 0,
            appointments_set INTEGER NOT NULL DEFAULT 0,
            appointments_shown INTEGER NOT NULL DEFAULT 0,
            actual_sold INTEGER NOT NULL DEFAULT 0,
            calls_mtd INTEGER NOT NULL DEFAULT 0,
            emails_mtd INTEGER NOT NULL DEFAULT 0,
            texts_mtd INTEGER NOT NULL DEFAULT 0,
            days_off INTEGER NOT NULL DEFAULT 0,
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL,
            UNIQUE(month_key, agent_id)
        )
        """
    )
    ensure_column("bdc_sales_tracker_agent_metrics", "appointments_shown", "INTEGER NOT NULL DEFAULT 0")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_sales_tracker_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT NOT NULL,
            agent_id INTEGER NOT NULL,
            agent_name TEXT NOT NULL,
            dms_number TEXT NOT NULL DEFAULT '',
            profile_name TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            sold INTEGER NOT NULL DEFAULT 0,
            sold_ts REAL,
            sold_at TEXT NOT NULL DEFAULT '',
            display_order INTEGER NOT NULL DEFAULT 0,
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_ts REAL NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    db_execute("CREATE INDEX IF NOT EXISTS idx_bdc_sales_tracker_entries_month ON bdc_sales_tracker_entries(month_key, agent_id, display_order, id)")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_sales_tracker_dms_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT NOT NULL,
            customer_name TEXT NOT NULL DEFAULT '',
            opportunity_id TEXT NOT NULL DEFAULT '',
            dms_number TEXT NOT NULL DEFAULT '',
            apt_set_under TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            logged INTEGER NOT NULL DEFAULT 0,
            logged_ts REAL,
            logged_at TEXT NOT NULL DEFAULT '',
            display_order INTEGER NOT NULL DEFAULT 0,
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_ts REAL NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    ensure_column("bdc_sales_tracker_dms_log", "opportunity_id", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_sales_tracker_dms_log", "dms_number", "TEXT NOT NULL DEFAULT ''")
    ensure_column("bdc_sales_tracker_dms_log", "notes", "TEXT NOT NULL DEFAULT ''")
    db_execute("CREATE INDEX IF NOT EXISTS idx_bdc_sales_tracker_dms_log_month ON bdc_sales_tracker_dms_log(month_key, logged, display_order, id)")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS bdc_sales_tracker_focus_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month_key TEXT NOT NULL,
            focus_key TEXT NOT NULL,
            focus_label TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL,
            updated_at TEXT NOT NULL DEFAULT '',
            UNIQUE(month_key, focus_key)
        )
        """
    )
    db_execute(
        "CREATE INDEX IF NOT EXISTS idx_bdc_sales_tracker_focus_notes_month ON bdc_sales_tracker_focus_notes(month_key, focus_key)"
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS freshup_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL DEFAULT '',
            salesperson_id INTEGER,
            salesperson_name TEXT NOT NULL DEFAULT '',
            salesperson_dealership TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT 'Desk'
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS freshup_analytics_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_ts REAL NOT NULL,
            event_at TEXT NOT NULL,
            salesperson_id INTEGER,
            salesperson_name TEXT NOT NULL DEFAULT '',
            salesperson_dealership TEXT NOT NULL DEFAULT '',
            store_dealership TEXT NOT NULL DEFAULT '',
            event_type TEXT NOT NULL,
            link_type TEXT NOT NULL DEFAULT '',
            target_url TEXT NOT NULL DEFAULT ''
        )
        """
    )
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
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS service_drive_traffic_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            traffic_date TEXT NOT NULL,
            brand TEXT NOT NULL DEFAULT 'Kia',
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL DEFAULT '',
            appointment_label TEXT NOT NULL DEFAULT '',
            appointment_ts REAL NOT NULL DEFAULT 0,
            vehicle_year TEXT NOT NULL DEFAULT '',
            odometer TEXT NOT NULL DEFAULT '',
            model_make TEXT NOT NULL DEFAULT '',
            offer_idea TEXT NOT NULL DEFAULT '',
            sales_notes TEXT NOT NULL DEFAULT '',
            source_system TEXT NOT NULL DEFAULT '',
            source_key TEXT NOT NULL DEFAULT '',
            created_ts REAL NOT NULL,
            updated_ts REAL NOT NULL
        )
        """
    )
    ensure_column("service_drive_traffic_entries", "brand", "TEXT NOT NULL DEFAULT 'Kia'")
    ensure_column("service_drive_traffic_entries", "customer_phone", "TEXT NOT NULL DEFAULT ''")
    ensure_column("service_drive_traffic_entries", "appointment_label", "TEXT NOT NULL DEFAULT ''")
    ensure_column("service_drive_traffic_entries", "appointment_ts", "REAL NOT NULL DEFAULT 0")
    ensure_column("service_drive_traffic_entries", "odometer", "TEXT NOT NULL DEFAULT ''")
    ensure_column("service_drive_traffic_entries", "sales_note_salesperson_id", "INTEGER")
    ensure_column("service_drive_traffic_entries", "sales_note_salesperson_name", "TEXT NOT NULL DEFAULT ''")
    ensure_column("service_drive_traffic_entries", "source_system", "TEXT NOT NULL DEFAULT ''")
    ensure_column("service_drive_traffic_entries", "source_key", "TEXT NOT NULL DEFAULT ''")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS service_drive_traffic_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            traffic_entry_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            image_url TEXT NOT NULL,
            created_ts REAL NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS traffic_pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            file_url TEXT NOT NULL,
            created_ts REAL NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS specials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            tag TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            image_url TEXT NOT NULL,
            created_ts REAL NOT NULL
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS special_feed_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_key TEXT NOT NULL,
            source_label TEXT NOT NULL DEFAULT '',
            source_url TEXT NOT NULL DEFAULT '',
            badge TEXT NOT NULL DEFAULT '',
            title TEXT NOT NULL,
            subtitle TEXT NOT NULL DEFAULT '',
            price_text TEXT NOT NULL DEFAULT '',
            payment_text TEXT NOT NULL DEFAULT '',
            mileage_text TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            score REAL NOT NULL DEFAULT 0,
            score_label TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL DEFAULT '',
            link_url TEXT NOT NULL DEFAULT '',
            imported_ts REAL NOT NULL
        )
        """
    )
    db_execute("CREATE INDEX IF NOT EXISTS idx_special_feed_entries_source_key ON special_feed_entries(source_key, id DESC)")
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS marketplace_template (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            title_template TEXT NOT NULL,
            description_template TEXT NOT NULL,
            price_label TEXT NOT NULL DEFAULT 'Bert Ogden Price',
            cta_text TEXT NOT NULL DEFAULT ''
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS quote_rate_tiers (
            brand TEXT NOT NULL,
            tier TEXT NOT NULL,
            apr REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (brand, tier)
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS agent_loop_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            preset_key TEXT NOT NULL,
            preset_label TEXT NOT NULL,
            objective TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'queued',
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL,
            started_ts REAL,
            started_at TEXT NOT NULL DEFAULT '',
            finished_ts REAL,
            finished_at TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL,
            reasoning_effort TEXT NOT NULL DEFAULT 'low',
            total_steps INTEGER NOT NULL DEFAULT 0,
            summary TEXT NOT NULL DEFAULT '',
            latest_thinking TEXT NOT NULL DEFAULT '',
            high_priority_actions_json TEXT NOT NULL DEFAULT '[]',
            observations_json TEXT NOT NULL DEFAULT '[]',
            error_message TEXT NOT NULL DEFAULT ''
        )
        """
    )
    db_execute(
        """
        CREATE TABLE IF NOT EXISTS agent_loop_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            step_index INTEGER NOT NULL DEFAULT 0,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL DEFAULT '',
            created_ts REAL NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    db_execute("CREATE INDEX IF NOT EXISTS idx_agent_loop_events_run_id ON agent_loop_events(run_id, id)")


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


def salesperson_admin_out(row: Dict[str, Any]) -> SalespersonAdminOut:
    return SalespersonAdminOut(
        id=int(row.get("id") or 0),
        name=str(row.get("name") or ""),
        dealership=str(row.get("dealership") or ""),
        weekly_days_off=text_to_days(row.get("weekly_days_off")),
        active=bool(int(row.get("active") or 0)),
        phone_number=str(row.get("phone_number") or ""),
        email=str(row.get("email") or ""),
        notify_sms=bool(int(row.get("notify_sms") or 0)),
        notify_email=bool(int(row.get("notify_email") or 0)),
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
        lead_store=str(row.get("lead_store") or ""),
        salesperson_id=int(row.get("salesperson_id") or 0),
        salesperson_name=str(row.get("salesperson_name") or ""),
        salesperson_dealership=str(row.get("salesperson_dealership") or ""),
        customer_name=str(row.get("customer_name") or ""),
        customer_phone=str(row.get("customer_phone") or ""),
        notification_sms_status=str(row.get("notification_sms_status") or ""),
        notification_email_status=str(row.get("notification_email_status") or ""),
    )


def bdc_sales_tracker_entry_out(row: Dict[str, Any]) -> BdcSalesTrackerEntryOut:
    return BdcSalesTrackerEntryOut(
        id=int(row.get("id") or 0),
        month=str(row.get("month_key") or ""),
        agent_id=int(row.get("agent_id") or 0),
        agent_name=str(row.get("agent_name") or ""),
        dms_number=str(row.get("dms_number") or ""),
        profile_name=str(row.get("profile_name") or ""),
        notes=str(row.get("notes") or ""),
        sold=bool(int(row.get("sold") or 0)),
        sold_at=str(row.get("sold_at") or ""),
        created_at=str(row.get("created_at") or ""),
        updated_at=str(row.get("updated_at") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def bdc_sales_tracker_dms_log_entry_out(row: Dict[str, Any]) -> BdcSalesTrackerDmsLogEntryOut:
    return BdcSalesTrackerDmsLogEntryOut(
        id=int(row.get("id") or 0),
        month=str(row.get("month_key") or ""),
        customer_name=str(row.get("customer_name") or ""),
        opportunity_id=str(row.get("opportunity_id") or ""),
        dms_number=str(row.get("dms_number") or ""),
        apt_set_under=str(row.get("apt_set_under") or ""),
        notes=str(row.get("notes") or ""),
        logged=bool(int(row.get("logged") or 0)),
        logged_at=str(row.get("logged_at") or ""),
        created_at=str(row.get("created_at") or ""),
        updated_at=str(row.get("updated_at") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def bdc_sales_tracker_focus_note_out(row: Dict[str, Any]) -> BdcSalesTrackerFocusNoteOut:
    return BdcSalesTrackerFocusNoteOut(
        focus_key=str(row.get("focus_key") or ""),
        focus_label=str(row.get("focus_label") or ""),
        notes=str(row.get("notes") or ""),
        updated_at=str(row.get("updated_at") or ""),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def freshup_log_out(row: Dict[str, Any]) -> FreshUpLogOut:
    return FreshUpLogOut(
        id=int(row.get("id") or 0),
        created_ts=float(row.get("created_ts") or 0.0),
        created_at=str(row.get("created_at") or ""),
        customer_name=str(row.get("customer_name") or ""),
        customer_phone=str(row.get("customer_phone") or ""),
        salesperson_id=int(row["salesperson_id"]) if row.get("salesperson_id") is not None else None,
        salesperson_name=str(row.get("salesperson_name") or ""),
        salesperson_dealership=str(row.get("salesperson_dealership") or ""),
        source=str(row.get("source") or "Desk"),
    )


def freshup_analytics_event_out(row: Dict[str, Any]) -> FreshUpAnalyticsEventOut:
    return FreshUpAnalyticsEventOut(
        id=int(row.get("id") or 0),
        event_at=str(row.get("event_at") or ""),
        event_type=str(row.get("event_type") or ""),
        link_type=str(row.get("link_type") or ""),
        salesperson_name=str(row.get("salesperson_name") or ""),
        salesperson_dealership=str(row.get("salesperson_dealership") or ""),
        store_dealership=str(row.get("store_dealership") or ""),
        target_url=str(row.get("target_url") or ""),
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


def traffic_offer_image_out(row: Dict[str, Any]) -> ServiceDriveTrafficImageOut:
    return ServiceDriveTrafficImageOut(
        id=int(row.get("id") or 0),
        original_filename=str(row.get("original_filename") or ""),
        image_url=str(row.get("image_url") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
    )


def fetch_traffic_offer_image_map(traffic_ids: List[int]) -> Dict[int, List[ServiceDriveTrafficImageOut]]:
    unique_ids = sorted({int(item) for item in traffic_ids if item})
    if not unique_ids:
        return {}
    placeholders = ",".join("?" for _ in unique_ids)
    rows = db_query_all(
        f"""
        SELECT *
        FROM service_drive_traffic_images
        WHERE traffic_entry_id IN ({placeholders})
        ORDER BY created_ts ASC, id ASC
        """,
        tuple(unique_ids),
    )
    grouped: Dict[int, List[ServiceDriveTrafficImageOut]] = {traffic_id: [] for traffic_id in unique_ids}
    for row in rows:
        traffic_id = int(row.get("traffic_entry_id") or 0)
        grouped.setdefault(traffic_id, []).append(traffic_offer_image_out(row))
    return grouped


def fetch_drive_team_map(date_values: List[str]) -> Dict[str, List[ServiceDriveTrafficAssignmentOut]]:
    unique_dates = sorted({value for value in date_values if value})
    if not unique_dates:
        return {}

    placeholders = ",".join("?" for _ in unique_dates)
    rows = db_query_all(
        f"""
        SELECT
            s.schedule_date,
            s.brand,
            s.salesperson_id,
            p.name AS salesperson_name,
            p.dealership AS salesperson_dealership
        FROM service_drive_assignments s
        LEFT JOIN salespeople p ON p.id = s.salesperson_id
        WHERE s.schedule_date IN ({placeholders})
        ORDER BY s.schedule_date ASC,
                 CASE s.brand WHEN 'Kia' THEN 0 WHEN 'Mazda' THEN 1 ELSE 9 END ASC
        """,
        tuple(unique_dates),
    )
    grouped: Dict[str, List[ServiceDriveTrafficAssignmentOut]] = {value: [] for value in unique_dates}
    for row in rows:
        schedule_date = str(row.get("schedule_date") or "")
        grouped.setdefault(schedule_date, []).append(
            ServiceDriveTrafficAssignmentOut(
                brand=str(row.get("brand") or ""),
                salesperson_id=int(row["salesperson_id"]) if row.get("salesperson_id") is not None else None,
                salesperson_name=str(row.get("salesperson_name") or "") or None,
                salesperson_dealership=str(row.get("salesperson_dealership") or "") or None,
            )
    )
    return grouped


def offer_idea_line_value(text: str, label: str) -> str:
    prefix = f"{label}:"
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if stripped.lower().startswith(prefix.lower()):
            return stripped[len(prefix) :].strip()
    return ""


def service_drive_traffic_out(
    row: Dict[str, Any],
    drive_team_map: Optional[Dict[str, List[ServiceDriveTrafficAssignmentOut]]] = None,
    offer_image_map: Optional[Dict[int, List[ServiceDriveTrafficImageOut]]] = None,
) -> ServiceDriveTrafficOut:
    traffic_date = str(row.get("traffic_date") or "")
    team = (drive_team_map or {}).get(traffic_date, [])
    traffic_id = int(row.get("id") or 0)
    offer_idea = str(row.get("offer_idea") or "")
    appointment_label = str(row.get("appointment_label") or "")
    appointment_ts = float(row.get("appointment_ts") or 0.0)
    if not appointment_label:
        imported_appointment = offer_idea_line_value(offer_idea, "Appointment")
        parsed_appointment = parse_reynolds_datetime_text(imported_appointment)
        if parsed_appointment:
            appointment_label = format_clock_label(parsed_appointment)
            appointment_ts = parsed_appointment.replace(tzinfo=ZoneInfo(RULES_TIMEZONE)).timestamp()
    odometer = str(row.get("odometer") or "")
    if not odometer:
        odometer = offer_idea_line_value(offer_idea, "Odometer")
    return ServiceDriveTrafficOut(
        id=traffic_id,
        traffic_date=traffic_date,
        brand=normalize_brand(str(row.get("brand") or "Kia")),
        customer_name=str(row.get("customer_name") or ""),
        customer_phone=str(row.get("customer_phone") or ""),
        appointment_label=appointment_label,
        appointment_ts=appointment_ts,
        vehicle_year=str(row.get("vehicle_year") or ""),
        odometer=odometer,
        model_make=str(row.get("model_make") or ""),
        offer_idea=offer_idea,
        offer_images=(offer_image_map or {}).get(traffic_id, []),
        sales_notes=str(row.get("sales_notes") or ""),
        sales_note_salesperson_id=int(row["sales_note_salesperson_id"])
        if row.get("sales_note_salesperson_id") is not None
        else None,
        sales_note_salesperson_name=str(row.get("sales_note_salesperson_name") or "") or None,
        drive_team=team,
        created_ts=float(row.get("created_ts") or 0.0),
        updated_ts=float(row.get("updated_ts") or 0.0),
    )


def traffic_pdf_out(row: Dict[str, Any]) -> TrafficPdfOut:
    return TrafficPdfOut(
        id=int(row.get("id") or 0),
        title=str(row.get("title") or ""),
        original_filename=str(row.get("original_filename") or ""),
        file_url=str(row.get("file_url") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
    )


def special_out(row: Dict[str, Any]) -> SpecialOut:
    return SpecialOut(
        id=int(row.get("id") or 0),
        title=str(row.get("title") or ""),
        tag=str(row.get("tag") or ""),
        original_filename=str(row.get("original_filename") or ""),
        image_url=str(row.get("image_url") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
    )


def vehicle_special_entry_out(row: Dict[str, Any]) -> VehicleSpecialEntryOut:
    return VehicleSpecialEntryOut(
        id=int(row.get("id") or 0),
        source_key=str(row.get("source_key") or ""),
        source_label=str(row.get("source_label") or ""),
        source_url=str(row.get("source_url") or ""),
        badge=str(row.get("badge") or ""),
        title=str(row.get("title") or ""),
        subtitle=str(row.get("subtitle") or ""),
        price_text=str(row.get("price_text") or ""),
        payment_text=str(row.get("payment_text") or ""),
        mileage_text=str(row.get("mileage_text") or ""),
        note=str(row.get("note") or ""),
        score=float(row.get("score") or 0.0),
        score_label=str(row.get("score_label") or ""),
        image_url=str(row.get("image_url") or ""),
        link_url=str(row.get("link_url") or ""),
        imported_ts=float(row.get("imported_ts") or 0.0),
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


def fetch_salespeople_admin(include_inactive: bool = False) -> List[SalespersonAdminOut]:
    query = "SELECT * FROM salespeople"
    if not include_inactive:
        query += " WHERE active = 1"
    query += " ORDER BY active DESC, dealership ASC, name ASC, id ASC"
    return [salesperson_admin_out(row) for row in db_query_all(query)]


def fetch_round_robin_salespeople(dealership: Optional[str] = None) -> List[SalespersonOut]:
    query = "SELECT * FROM salespeople WHERE active = 1"
    params: List[Any] = []
    normalized_store = normalize_optional_dealership(dealership)
    if normalized_store:
        query += " AND dealership = ?"
        params.append(normalized_store)
    query += " ORDER BY id ASC"
    return [salesperson_out(row) for row in db_query_all(query, tuple(params))]


def fetch_bdc_agents(include_inactive: bool = False) -> List[BdcAgentOut]:
    query = "SELECT * FROM bdc_agents"
    if not include_inactive:
        query += " WHERE active = 1"
    query += " ORDER BY active DESC, name ASC, id ASC"
    return [bdc_agent_out(row) for row in db_query_all(query)]


def normalize_tracker_goal(value: Any) -> float:
    try:
        goal = float(value or 0)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="goal must be a number") from exc
    if goal < 0:
        raise HTTPException(status_code=400, detail="goal cannot be negative")
    return round(goal, 2)


def normalize_tracker_count(value: Any, field_name: str) -> int:
    try:
        count = int(float(value or 0))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a whole number") from exc
    if count < 0:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be negative")
    return count


def tracker_working_days(month_key: str) -> int:
    return sum(1 for day in month_dates(month_key) if not is_sunday(day))


def tracker_days_worked(month_key: str) -> int:
    dates = month_dates(month_key)
    if not dates:
        return 0
    today_local = now_local().date()
    if today_local <= dates[0]:
        return 0
    if today_local > dates[-1]:
        return tracker_working_days(month_key)
    return sum(1 for day in dates if day < today_local and not is_sunday(day))


def tracker_average_activity_label(calls: int, emails: int, texts: int, working_days_value: int, days_off: int) -> str:
    effective_days = max(working_days_value - days_off, 0)
    if effective_days <= 0:
        return "0 / 0 / 0"
    return (
        f"{round(calls / effective_days)} / "
        f"{round(emails / effective_days)} / "
        f"{round(texts / effective_days)}"
    )


def fetch_bdc_sales_tracker_goal(month_key: str) -> float:
    row = db_query_one("SELECT goal FROM bdc_sales_tracker_months WHERE month_key = ?", (month_key,))
    if not row:
        return BDC_SALES_TRACKER_DEFAULT_GOAL
    return float(row.get("goal") or BDC_SALES_TRACKER_DEFAULT_GOAL)


def fetch_bdc_sales_tracker_benchmarks(month_key: str) -> BdcSalesTrackerBenchmarksOut:
    row = db_query_one(
        """
        SELECT
            appointment_set_rate_floor,
            appointment_set_rate_target,
            appointment_show_rate_floor,
            appointment_show_rate_target,
            sold_from_appointments_rate_floor,
            sold_from_appointments_rate_target,
            sold_from_appointments_rate_ceiling
        FROM bdc_sales_tracker_months
        WHERE month_key = ?
        """,
        (month_key,),
    )
    return BdcSalesTrackerBenchmarksOut(
        appointment_set_rate_floor=float(
            row.get("appointment_set_rate_floor") if row else BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_FLOOR
        ),
        appointment_set_rate_target=float(
            row.get("appointment_set_rate_target") if row else BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SET_RATE_TARGET
        ),
        appointment_show_rate_floor=float(
            row.get("appointment_show_rate_floor") if row else BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_FLOOR
        ),
        appointment_show_rate_target=float(
            row.get("appointment_show_rate_target") if row else BDC_SALES_TRACKER_DEFAULT_APPOINTMENT_SHOW_RATE_TARGET
        ),
        sold_from_appointments_rate_floor=float(
            row.get("sold_from_appointments_rate_floor")
            if row
            else BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_FLOOR
        ),
        sold_from_appointments_rate_target=float(
            row.get("sold_from_appointments_rate_target")
            if row
            else BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_TARGET
        ),
        sold_from_appointments_rate_ceiling=float(
            row.get("sold_from_appointments_rate_ceiling")
            if row
            else BDC_SALES_TRACKER_DEFAULT_SOLD_FROM_APPOINTMENTS_RATE_CEILING
        ),
    )


def upsert_bdc_sales_tracker_month(payload: BdcSalesTrackerMonthIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    goal = normalize_tracker_goal(payload.goal)
    now_ts = time.time()
    db_execute(
        """
        INSERT INTO bdc_sales_tracker_months (month_key, goal, created_ts, updated_ts)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(month_key) DO UPDATE
        SET goal = excluded.goal,
            updated_ts = excluded.updated_ts
        """,
        (month_key, goal, now_ts, now_ts),
    )
    return fetch_bdc_sales_tracker(month_key)


def upsert_bdc_sales_tracker_benchmarks(payload: BdcSalesTrackerBenchmarksIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    appointment_set_rate_floor = normalize_tracker_rate(
        payload.appointment_set_rate_floor, "appointment_set_rate_floor"
    )
    appointment_set_rate_target = normalize_tracker_rate(
        payload.appointment_set_rate_target, "appointment_set_rate_target"
    )
    appointment_show_rate_floor = normalize_tracker_rate(
        payload.appointment_show_rate_floor, "appointment_show_rate_floor"
    )
    appointment_show_rate_target = normalize_tracker_rate(
        payload.appointment_show_rate_target, "appointment_show_rate_target"
    )
    sold_from_appointments_rate_floor = normalize_tracker_rate(
        payload.sold_from_appointments_rate_floor, "sold_from_appointments_rate_floor"
    )
    sold_from_appointments_rate_target = normalize_tracker_rate(
        payload.sold_from_appointments_rate_target, "sold_from_appointments_rate_target"
    )
    sold_from_appointments_rate_ceiling = normalize_tracker_rate(
        payload.sold_from_appointments_rate_ceiling, "sold_from_appointments_rate_ceiling"
    )
    if appointment_set_rate_floor > appointment_set_rate_target:
        raise HTTPException(status_code=400, detail="appointment set floor cannot be above the target")
    if appointment_show_rate_floor > appointment_show_rate_target:
        raise HTTPException(status_code=400, detail="appointment show floor cannot be above the target")
    if sold_from_appointments_rate_floor > sold_from_appointments_rate_target:
        raise HTTPException(status_code=400, detail="sold from appointments floor cannot be above the target")
    if sold_from_appointments_rate_target > sold_from_appointments_rate_ceiling:
        raise HTTPException(status_code=400, detail="sold from appointments target cannot be above the ceiling")
    now_ts = time.time()
    db_execute(
        """
        INSERT INTO bdc_sales_tracker_months (
            month_key,
            goal,
            appointment_set_rate_floor,
            appointment_set_rate_target,
            appointment_show_rate_floor,
            appointment_show_rate_target,
            sold_from_appointments_rate_floor,
            sold_from_appointments_rate_target,
            sold_from_appointments_rate_ceiling,
            created_ts,
            updated_ts
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(month_key) DO UPDATE
        SET appointment_set_rate_floor = excluded.appointment_set_rate_floor,
            appointment_set_rate_target = excluded.appointment_set_rate_target,
            appointment_show_rate_floor = excluded.appointment_show_rate_floor,
            appointment_show_rate_target = excluded.appointment_show_rate_target,
            sold_from_appointments_rate_floor = excluded.sold_from_appointments_rate_floor,
            sold_from_appointments_rate_target = excluded.sold_from_appointments_rate_target,
            sold_from_appointments_rate_ceiling = excluded.sold_from_appointments_rate_ceiling,
            updated_ts = excluded.updated_ts
        """,
        (
            month_key,
            fetch_bdc_sales_tracker_goal(month_key),
            appointment_set_rate_floor,
            appointment_set_rate_target,
            appointment_show_rate_floor,
            appointment_show_rate_target,
            sold_from_appointments_rate_floor,
            sold_from_appointments_rate_target,
            sold_from_appointments_rate_ceiling,
            now_ts,
            now_ts,
        ),
    )
    return fetch_bdc_sales_tracker(month_key)


def get_bdc_sales_tracker_entry_row(entry_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM bdc_sales_tracker_entries WHERE id = ?", (int(entry_id),))


def get_bdc_sales_tracker_dms_log_row(entry_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM bdc_sales_tracker_dms_log WHERE id = ?", (int(entry_id),))


def upsert_bdc_sales_tracker_focus_note(payload: BdcSalesTrackerFocusNoteIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    focus_key = normalize_tracker_focus_key(payload.focus_key)
    focus_label = normalize_short_text(payload.focus_label, "focus_label", max_len=120)
    notes = normalize_notes(payload.notes, "notes", max_len=3000)
    now_ts = time.time()
    now_at = now_iso()
    db_execute(
        """
        INSERT INTO bdc_sales_tracker_focus_notes (
            month_key, focus_key, focus_label, notes, created_ts, updated_ts, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(month_key, focus_key) DO UPDATE
        SET focus_label = excluded.focus_label,
            notes = excluded.notes,
            updated_ts = excluded.updated_ts,
            updated_at = excluded.updated_at
        """,
        (month_key, focus_key, focus_label, notes, now_ts, now_ts, now_at),
    )
    return fetch_bdc_sales_tracker(month_key)


def fetch_bdc_sales_tracker(month_key: str) -> BdcSalesTrackerOut:
    month_key = parse_month_key(month_key)
    goal = fetch_bdc_sales_tracker_goal(month_key)
    benchmarks = fetch_bdc_sales_tracker_benchmarks(month_key)
    working_days = tracker_working_days(month_key)
    days_worked = tracker_days_worked(month_key)
    days_left = max(working_days - days_worked, 0)
    daily_goal = goal / working_days if working_days else 0.0

    roster = fetch_bdc_agents(include_inactive=True)
    order_map = {agent.id: index for index, agent in enumerate(roster)}
    agent_rows: Dict[int, Dict[str, Any]] = {
        agent.id: {"agent_id": agent.id, "agent_name": agent.name, "active": agent.active}
        for agent in roster
    }
    metrics_rows = db_query_all(
        """
        SELECT *
        FROM bdc_sales_tracker_agent_metrics
        WHERE month_key = ?
        ORDER BY agent_name COLLATE NOCASE ASC, agent_id ASC
        """,
        (month_key,),
    )
    entry_rows = db_query_all(
        """
        SELECT *
        FROM bdc_sales_tracker_entries
        WHERE month_key = ?
        ORDER BY agent_id ASC, display_order ASC, id ASC
        """,
        (month_key,),
    )
    dms_log_rows = db_query_all(
        """
        SELECT *
        FROM bdc_sales_tracker_dms_log
        WHERE month_key = ?
        ORDER BY logged ASC, CASE WHEN logged = 0 THEN display_order ELSE 0 END ASC, logged_ts DESC, id DESC
        """,
        (month_key,),
    )
    focus_note_rows = db_query_all(
        """
        SELECT *
        FROM bdc_sales_tracker_focus_notes
        WHERE month_key = ?
        ORDER BY focus_label COLLATE NOCASE ASC, focus_key ASC
        """,
        (month_key,),
    )
    metrics_by_agent = {int(row.get("agent_id") or 0): row for row in metrics_rows if row.get("agent_id") is not None}
    entries_by_agent: Dict[int, List[BdcSalesTrackerEntryOut]] = {}
    for row in entry_rows:
        agent_id = int(row.get("agent_id") or 0)
        if agent_id not in agent_rows:
            agent_rows[agent_id] = {
                "agent_id": agent_id,
                "agent_name": str(row.get("agent_name") or f"Agent {agent_id}"),
                "active": False,
            }
        entries_by_agent.setdefault(agent_id, []).append(bdc_sales_tracker_entry_out(row))
    for row in metrics_rows:
        agent_id = int(row.get("agent_id") or 0)
        if agent_id not in agent_rows:
            agent_rows[agent_id] = {
                "agent_id": agent_id,
                "agent_name": str(row.get("agent_name") or f"Agent {agent_id}"),
                "active": False,
            }

    sorted_agent_ids = sorted(
        agent_rows.keys(),
        key=lambda agent_id: (
            order_map.get(agent_id, 9999),
            str(agent_rows[agent_id].get("agent_name") or "").lower(),
            agent_id,
        ),
    )

    agents: List[BdcSalesTrackerAgentOut] = []
    mtd_tracked = 0
    for agent_id in sorted_agent_ids:
        agent_meta = agent_rows[agent_id]
        metrics = metrics_by_agent.get(agent_id) or {}
        entries = entries_by_agent.get(agent_id, [])
        sold_count = sum(1 for entry in entries if entry.sold)
        total_leads = normalize_tracker_count(metrics.get("total_leads") or 0, "total_leads")
        appointments_set = normalize_tracker_count(metrics.get("appointments_set") or 0, "appointments_set")
        appointments_shown = normalize_tracker_count(metrics.get("appointments_shown") or 0, "appointments_shown")
        actual_sold = normalize_tracker_count(metrics.get("actual_sold") or 0, "actual_sold")
        calls_mtd = normalize_tracker_count(metrics.get("calls_mtd") or 0, "calls_mtd")
        emails_mtd = normalize_tracker_count(metrics.get("emails_mtd") or 0, "emails_mtd")
        texts_mtd = normalize_tracker_count(metrics.get("texts_mtd") or 0, "texts_mtd")
        days_off = normalize_tracker_count(metrics.get("days_off") or 0, "days_off")
        appointment_set_rate = (appointments_set / total_leads) if total_leads else 0.0
        appointment_show_rate = (appointments_shown / appointments_set) if appointments_set else 0.0
        actual_sold_rate = (actual_sold / appointments_set) if appointments_set else 0.0
        sold_from_shown_rate = (actual_sold / appointments_shown) if appointments_shown else 0.0
        avg_appointments_per_day = (appointments_set / days_worked) if days_worked else 0.0
        avg_shown_per_day = (appointments_shown / days_worked) if days_worked else 0.0
        avg_sold_per_day = (actual_sold / days_worked) if days_worked else 0.0
        tracking_projection = (sold_count / days_worked * working_days) if days_worked else 0.0
        mtd_tracked += sold_count
        agents.append(
            BdcSalesTrackerAgentOut(
                agent_id=agent_id,
                agent_name=str(agent_meta.get("agent_name") or f"Agent {agent_id}"),
                active=bool(agent_meta.get("active")),
                sold_count=sold_count,
                tracking_projection=tracking_projection,
                total_leads=total_leads,
                appointments_set=appointments_set,
                appointment_set_rate=appointment_set_rate,
                appointments_shown=appointments_shown,
                appointment_show_rate=appointment_show_rate,
                actual_sold=actual_sold,
                actual_sold_rate=actual_sold_rate,
                sold_from_shown_rate=sold_from_shown_rate,
                avg_appointments_per_day=avg_appointments_per_day,
                avg_shown_per_day=avg_shown_per_day,
                avg_sold_per_day=avg_sold_per_day,
                calls_mtd=calls_mtd,
                emails_mtd=emails_mtd,
                texts_mtd=texts_mtd,
                average_activity_label=tracker_average_activity_label(calls_mtd, emails_mtd, texts_mtd, days_worked, days_off),
                days_off=days_off,
                entries=entries,
            )
        )

    tracking_projection = (mtd_tracked / days_worked * working_days) if days_worked else 0.0
    should_be_at_sold = daily_goal * days_worked
    return BdcSalesTrackerOut(
        month=month_key,
        goal=goal,
        summary=BdcSalesTrackerSummaryOut(
            goal=goal,
            mtd_tracked=mtd_tracked,
            tracking_projection=tracking_projection,
            daily_goal=daily_goal,
            working_days=working_days,
            days_worked=days_worked,
            days_left=days_left,
            should_be_at_sold=should_be_at_sold,
            behind_by=should_be_at_sold - mtd_tracked,
        ),
        benchmarks=benchmarks,
        agents=agents,
        dms_log=BdcSalesTrackerDmsLogOut(
            current_entries=[bdc_sales_tracker_dms_log_entry_out(row) for row in dms_log_rows if not bool(int(row.get("logged") or 0))],
            log_entries=[bdc_sales_tracker_dms_log_entry_out(row) for row in dms_log_rows if bool(int(row.get("logged") or 0))],
        ),
        focus_notes=[bdc_sales_tracker_focus_note_out(row) for row in focus_note_rows],
    )


def update_bdc_sales_tracker_agent_metrics(agent_id: int, payload: BdcSalesTrackerAgentMetricsIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    agent_row = get_bdc_agent_row(agent_id)
    if not agent_row:
        raise HTTPException(status_code=404, detail="BDC agent not found")
    total_leads = normalize_tracker_count(payload.total_leads, "total_leads")
    appointments_set = normalize_tracker_count(payload.appointments_set, "appointments_set")
    appointments_shown = normalize_tracker_count(payload.appointments_shown, "appointments_shown")
    actual_sold = normalize_tracker_count(payload.actual_sold, "actual_sold")
    calls_mtd = normalize_tracker_count(payload.calls_mtd, "calls_mtd")
    emails_mtd = normalize_tracker_count(payload.emails_mtd, "emails_mtd")
    texts_mtd = normalize_tracker_count(payload.texts_mtd, "texts_mtd")
    days_off = normalize_tracker_count(payload.days_off, "days_off")
    now_ts = time.time()
    db_execute(
        """
        INSERT INTO bdc_sales_tracker_agent_metrics (
            month_key, agent_id, agent_name, total_leads, appointments_set, appointments_shown, actual_sold,
            calls_mtd, emails_mtd, texts_mtd, days_off, created_ts, updated_ts
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(month_key, agent_id) DO UPDATE
        SET agent_name = excluded.agent_name,
            total_leads = excluded.total_leads,
            appointments_set = excluded.appointments_set,
            appointments_shown = excluded.appointments_shown,
            actual_sold = excluded.actual_sold,
            calls_mtd = excluded.calls_mtd,
            emails_mtd = excluded.emails_mtd,
            texts_mtd = excluded.texts_mtd,
            days_off = excluded.days_off,
            updated_ts = excluded.updated_ts
        """,
        (
            month_key,
            int(agent_row.get("id") or 0),
            str(agent_row.get("name") or ""),
            total_leads,
            appointments_set,
            appointments_shown,
            actual_sold,
            calls_mtd,
            emails_mtd,
            texts_mtd,
            days_off,
            now_ts,
            now_ts,
        ),
    )
    return fetch_bdc_sales_tracker(month_key)


def create_bdc_sales_tracker_entry(payload: BdcSalesTrackerEntryIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    agent_row = get_bdc_agent_row(payload.agent_id)
    if not agent_row:
        raise HTTPException(status_code=404, detail="BDC agent not found")
    dms_numbers = parse_bdc_sales_tracker_dms_numbers(payload.dms_numbers_text)
    single_dms_number = normalize_short_text(payload.dms_number, "dms_number", max_len=80)
    if single_dms_number and single_dms_number.lower() not in {item.lower() for item in dms_numbers}:
        dms_numbers.append(single_dms_number)
    profile_name = normalize_short_text(payload.profile_name, "profile_name", max_len=180)
    notes = normalize_notes(payload.notes, "notes", max_len=1000)
    if not dms_numbers and not profile_name:
        raise HTTPException(status_code=400, detail="enter a DMS number or profile name")
    now_ts = time.time()
    now_at = now_iso()
    sold = bool(payload.sold)
    order_row = db_query_one(
        "SELECT COALESCE(MAX(display_order), -1) AS max_order FROM bdc_sales_tracker_entries WHERE month_key = ? AND agent_id = ?",
        (month_key, int(agent_row.get("id") or 0)),
    ) or {}
    display_order = int(order_row.get("max_order") or -1) + 1
    rows_to_insert = dms_numbers or [""]
    for index, dms_number in enumerate(rows_to_insert):
        db_insert(
            """
            INSERT INTO bdc_sales_tracker_entries (
                month_key, agent_id, agent_name, dms_number, profile_name, notes, sold,
                sold_ts, sold_at, display_order, created_ts, created_at, updated_ts, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                month_key,
                int(agent_row.get("id") or 0),
                str(agent_row.get("name") or ""),
                dms_number,
                profile_name,
                notes,
                1 if sold else 0,
                now_ts if sold else None,
                now_at if sold else "",
                display_order + index,
                now_ts,
                now_at,
                now_ts,
                now_at,
            ),
        )
    return fetch_bdc_sales_tracker(month_key)


def update_bdc_sales_tracker_entry(entry_id: int, payload: BdcSalesTrackerEntryUpdateIn) -> BdcSalesTrackerOut:
    row = get_bdc_sales_tracker_entry_row(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="tracker row not found")
    dms_number = normalize_short_text(payload.dms_number, "dms_number", max_len=80)
    profile_name = normalize_short_text(payload.profile_name, "profile_name", max_len=180)
    notes = normalize_notes(payload.notes, "notes", max_len=1000)
    if not dms_number and not profile_name:
        raise HTTPException(status_code=400, detail="enter a DMS number or profile name")
    sold = bool(payload.sold)
    now_ts = time.time()
    now_at = now_iso()
    sold_ts = float(row.get("sold_ts") or 0.0) if row.get("sold_ts") is not None else None
    sold_at = str(row.get("sold_at") or "")
    was_sold = bool(int(row.get("sold") or 0))
    if sold and not was_sold:
        sold_ts = now_ts
        sold_at = now_at
    if not sold:
        sold_ts = None
        sold_at = ""
    db_execute(
        """
        UPDATE bdc_sales_tracker_entries
        SET dms_number = ?,
            profile_name = ?,
            notes = ?,
            sold = ?,
            sold_ts = ?,
            sold_at = ?,
            updated_ts = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            dms_number,
            profile_name,
            notes,
            1 if sold else 0,
            sold_ts,
            sold_at,
            now_ts,
            now_at,
            int(entry_id),
        ),
    )
    return fetch_bdc_sales_tracker(str(row.get("month_key") or ""))


def delete_bdc_sales_tracker_entry(entry_id: int) -> BdcSalesTrackerOut:
    row = get_bdc_sales_tracker_entry_row(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="tracker row not found")
    month_key = str(row.get("month_key") or "")
    db_execute("DELETE FROM bdc_sales_tracker_entries WHERE id = ?", (int(entry_id),))
    return fetch_bdc_sales_tracker(month_key)


def create_bdc_sales_tracker_dms_log_entry(payload: BdcSalesTrackerDmsLogEntryIn) -> BdcSalesTrackerOut:
    month_key = parse_month_key(payload.month)
    customer_name, opportunity_id, dms_number = parse_bdc_sales_tracker_log_identity(payload.customer_name)
    apt_set_under = normalize_short_text(payload.apt_set_under, "apt_set_under", max_len=120)
    notes = normalize_notes(payload.notes, "notes", max_len=1000)
    now_ts = time.time()
    now_at = now_local_input_value()
    db_insert(
        """
        INSERT INTO bdc_sales_tracker_dms_log (
            month_key, customer_name, opportunity_id, dms_number, apt_set_under, notes, logged, logged_ts, logged_at,
            display_order, created_ts, created_at, updated_ts, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?, ?)
        """,
        (
            month_key,
            customer_name,
            opportunity_id,
            dms_number,
            apt_set_under,
            notes,
            now_ts,
            now_at,
            now_ts,
            now_at,
            now_ts,
            now_at,
        ),
    )
    return fetch_bdc_sales_tracker(month_key)


def update_bdc_sales_tracker_dms_log_entry(entry_id: int, payload: BdcSalesTrackerDmsLogEntryUpdateIn) -> BdcSalesTrackerOut:
    row = get_bdc_sales_tracker_dms_log_row(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="DMS log row not found")
    customer_name = normalize_short_text(payload.customer_name, "customer_name", max_len=120)
    opportunity_id = normalize_short_text(payload.opportunity_id, "opportunity_id", max_len=80)
    dms_number = normalize_short_text(payload.dms_number, "dms_number", max_len=80)
    apt_set_under = normalize_short_text(payload.apt_set_under, "apt_set_under", max_len=120)
    notes = normalize_notes(payload.notes, "notes", max_len=1000)
    if not customer_name:
        raise HTTPException(status_code=400, detail="customer_name is required")
    logged = bool(payload.logged)
    now_ts = time.time()
    now_at = now_local_input_value()
    logged_ts = float(row.get("logged_ts") or 0.0) if row.get("logged_ts") is not None else None
    logged_at = str(row.get("logged_at") or "")
    if logged:
        if payload.logged_at:
            parsed_logged_at, _, parsed_logged_ts = parse_local_datetime(payload.logged_at, "logged_at")
            logged_at = parsed_logged_at
            logged_ts = parsed_logged_ts
        elif not bool(int(row.get("logged") or 0)):
            logged_at = now_at
            logged_ts = now_ts
    else:
        logged_at = ""
        logged_ts = None
    db_execute(
        """
        UPDATE bdc_sales_tracker_dms_log
        SET customer_name = ?,
            opportunity_id = ?,
            dms_number = ?,
            apt_set_under = ?,
            notes = ?,
            logged = ?,
            logged_ts = ?,
            logged_at = ?,
            updated_ts = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (
            customer_name,
            opportunity_id,
            dms_number,
            apt_set_under,
            notes,
            1 if logged else 0,
            logged_ts,
            logged_at,
            now_ts,
            now_at,
            int(entry_id),
        ),
    )
    return fetch_bdc_sales_tracker(str(row.get("month_key") or ""))


def delete_bdc_sales_tracker_dms_log_entry(entry_id: int) -> BdcSalesTrackerOut:
    row = get_bdc_sales_tracker_dms_log_row(entry_id)
    if not row:
        raise HTTPException(status_code=404, detail="DMS log row not found")
    month_key = str(row.get("month_key") or "")
    db_execute("DELETE FROM bdc_sales_tracker_dms_log WHERE id = ?", (int(entry_id),))
    return fetch_bdc_sales_tracker(month_key)


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


def replace_days_off_month(payload: DaysOffMonthBulkIn) -> DaysOffMonthOut:
    month_key = parse_month_key(payload.month)
    valid_dates = {item.isoformat() for item in month_dates(month_key)}
    normalized_by_salesperson: Dict[int, List[str]] = {}

    for entry in payload.entries:
        person = get_salesperson_row(int(entry.salesperson_id))
        if not person:
            raise HTTPException(status_code=404, detail="salesperson not found")
        dates: List[str] = []
        for value in entry.off_dates:
            off_day = parse_iso_date(value, "off_dates")
            off_date = off_day.isoformat()
            if off_date not in valid_dates:
                raise HTTPException(status_code=400, detail="off_dates must stay within the selected month")
            if off_date not in dates:
                dates.append(off_date)
        dates.sort()
        normalized_by_salesperson[int(entry.salesperson_id)] = dates

    start_date, end_date = month_date_bounds(month_key)
    db_execute(
        "DELETE FROM salesperson_days_off WHERE off_date >= ? AND off_date < ?",
        (start_date, end_date),
    )

    now_ts = time.time()
    for salesperson_id, off_dates in normalized_by_salesperson.items():
        for off_date in off_dates:
            db_execute(
                """
                INSERT INTO salesperson_days_off (salesperson_id, off_date, created_ts)
                VALUES (?, ?, ?)
                ON CONFLICT(salesperson_id, off_date) DO NOTHING
                """,
                (salesperson_id, off_date, now_ts),
            )

    return fetch_days_off_month(month_key)


def create_salesperson(payload: SalespersonIn) -> SalespersonAdminOut:
    name = normalize_name(payload.name, "name")
    dealership = normalize_dealership(payload.dealership)
    phone_number = normalize_optional_phone(payload.phone_number)
    email = normalize_optional_email(payload.email)
    assert_unique_name("salespeople", name)
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO salespeople (
            name, dealership, weekly_days_off, active, phone_number, email, notify_sms, notify_email, created_ts, updated_ts
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            dealership,
            days_to_text(payload.weekly_days_off),
            1 if payload.active else 0,
            phone_number,
            email,
            1 if payload.notify_sms else 0,
            1 if payload.notify_email else 0,
            now_ts,
            now_ts,
        ),
    )
    row = get_salesperson_row(created_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to create salesperson")
    return salesperson_admin_out(row)


def update_salesperson(salesperson_id: int, payload: SalespersonIn) -> SalespersonAdminOut:
    if not get_salesperson_row(salesperson_id):
        raise HTTPException(status_code=404, detail="salesperson not found")
    name = normalize_name(payload.name, "name")
    dealership = normalize_dealership(payload.dealership)
    phone_number = normalize_optional_phone(payload.phone_number)
    email = normalize_optional_email(payload.email)
    assert_unique_name("salespeople", name, exclude_id=salesperson_id)
    db_execute(
        """
        UPDATE salespeople
        SET
            name = ?,
            dealership = ?,
            weekly_days_off = ?,
            active = ?,
            phone_number = ?,
            email = ?,
            notify_sms = ?,
            notify_email = ?,
            updated_ts = ?
        WHERE id = ?
        """,
        (
            name,
            dealership,
            days_to_text(payload.weekly_days_off),
            1 if payload.active else 0,
            phone_number,
            email,
            1 if payload.notify_sms else 0,
            1 if payload.notify_email else 0,
            time.time(),
            salesperson_id,
        ),
    )
    row = get_salesperson_row(salesperson_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update salesperson")
    return salesperson_admin_out(row)


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
    if is_sunday(working_day):
        return None, cursor, []
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
            if is_sunday(service_day):
                db_execute(
                    """
                    UPDATE service_drive_assignments
                    SET salesperson_id = ?, updated_ts = ?
                    WHERE schedule_date = ? AND brand = ?
                    """,
                    (None, time.time(), service_day.isoformat(), brand),
                )
                continue
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
    month_days = month_dates(month_key)
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

    active_salespeople = fetch_salespeople(include_inactive=False)
    off_lookup = fetch_days_off_lookup(month_days[0], month_days[-1]) if month_days else set()

    slots_by_day: Dict[str, Dict[str, ServiceSlotOut]] = {}
    people_off_by_day: Dict[str, List[str]] = {}
    for service_day in month_days:
        slots_by_day[service_day.isoformat()] = {
            "Kia": ServiceSlotOut(brand="Kia"),
            "Mazda": ServiceSlotOut(brand="Mazda"),
        }
        off_names = [
            person.name
            for person in active_salespeople
            if (person.id, service_day.isoformat()) in off_lookup
        ]
        people_off_by_day[service_day.isoformat()] = sorted(
            off_names,
            key=lambda value: value.lower(),
        )

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
    for service_day in month_days:
        service_date = service_day.isoformat()
        if is_sunday(service_day):
            kia = ServiceSlotOut(brand="Kia")
            mazda = ServiceSlotOut(brand="Mazda")
        else:
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
                people_off=people_off_by_day.get(service_date, []),
            )
        )

    total_days = len(days)
    open_service_days = sum(1 for service_day in month_days if not is_sunday(service_day))
    return ServiceMonthOut(
        month=month_key,
        total_days=total_days,
        total_slots=open_service_days * len(SERVICE_BRANDS),
        assigned_slots=assigned_slots,
        days=days,
    )


def update_service_assignment(schedule_date: str, brand: str, salesperson_id: Optional[int]) -> ServiceMonthOut:
    service_day = parse_iso_date(schedule_date, "schedule_date")
    month_key = service_day.strftime("%Y-%m")
    ensure_month_slots(month_key)
    brand_name = normalize_brand(brand)
    if is_sunday(service_day) and salesperson_id is not None:
        raise HTTPException(status_code=400, detail="service drive is closed on Sundays")
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


# NOTE: legacy placeholder replaced by bdc_pointer_key(pool_key) above.


def build_bdc_state(dealership: Optional[str] = None) -> BdcStateOut:
    distribution_mode = get_bdc_distribution_mode()
    lead_store = normalize_bdc_lead_store(dealership or ("Kia/Mazda" if distribution_mode == "universal" else "Kia"))
    pool_key = bdc_pool_key_for_mode(distribution_mode, lead_store)
    queue = fetch_bdc_pool_salespeople(pool_key)
    if not queue:
        return BdcStateOut(dealership=pool_key, next_index=0, next_salesperson=None, queue=[])
    try:
        pointer = int(get_meta(bdc_pointer_key(pool_key)) or 0)
    except Exception:
        pointer = 0
    next_index = pointer % len(queue)
    picked, _, available_queue = pick_round_robin_person(queue, now_local().date(), pointer)
    return BdcStateOut(
        dealership=pool_key,
        next_index=next_index,
        next_salesperson=picked,
        queue=available_queue,
    )


def assign_next_lead(payload: BdcLeadAssignIn) -> BdcAssignmentOut:
    if is_sunday(now_local().date()):
        raise HTTPException(status_code=400, detail="BDC round robin is closed on Sundays")
    distribution_mode = get_bdc_distribution_mode()
    lead_store = normalize_bdc_lead_store(payload.lead_store or "Kia")
    if distribution_mode == "franchise" and lead_store == "Kia/Mazda":
        raise HTTPException(status_code=400, detail="lead store must be Kia, Mazda, or Outlet")
    pool_key = bdc_pool_key_for_mode(distribution_mode, lead_store)
    salespeople = fetch_bdc_pool_salespeople(pool_key)
    if not salespeople:
        store_label = "salespeople" if pool_key is None else f"{lead_store} salespeople"
        raise HTTPException(status_code=400, detail=f"no active {store_label} available")
    try:
        pointer = int(get_meta(bdc_pointer_key(pool_key)) or 0)
    except Exception:
        pointer = 0
    salesperson, next_pointer, _ = pick_round_robin_person(salespeople, now_local().date(), pointer)
    if not salesperson:
        store_label = "salespeople" if pool_key is None else f"{lead_store} salespeople"
        raise HTTPException(status_code=400, detail=f"no active {store_label} available for today's rotation")
    log_lead_store = "Kia/Mazda" if pool_key == "Kia/Mazda" else lead_store
    bdc_agent_id, bdc_agent_name = resolve_bdc_agent(payload.bdc_agent_id, payload.bdc_agent_name)
    customer_name = normalize_short_text(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    created_id = db_insert(
        """
        INSERT INTO bdc_assignment_log (
            assigned_ts, assigned_at, bdc_agent_id, bdc_agent_name, lead_store, salesperson_id, salesperson_name,
            salesperson_dealership, customer_name, customer_phone, distribution_mode, notification_sms_status,
            notification_email_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            now_iso(),
            bdc_agent_id,
            bdc_agent_name,
            log_lead_store,
            salesperson.id,
            salesperson.name,
            salesperson.dealership,
            customer_name,
            customer_phone,
            distribution_mode,
            "",
            "",
        ),
    )
    set_meta(bdc_pointer_key(pool_key), str(next_pointer))
    row = db_query_one("SELECT * FROM bdc_assignment_log WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to create assignment log")
    salesperson_row = get_salesperson_row(salesperson.id)
    if salesperson_row:
        sms_status, email_status = deliver_assignment_notifications(salesperson_row, row)
        if sms_status or email_status:
            db_execute(
                """
                UPDATE bdc_assignment_log
                SET notification_sms_status = ?, notification_email_status = ?
                WHERE id = ?
                """,
                (sms_status, email_status, created_id),
            )
            row = db_query_one("SELECT * FROM bdc_assignment_log WHERE id = ?", (created_id,)) or row
    return bdc_log_out(row)


def build_log_filter(
    salesperson_id: Optional[int] = None,
    lead_store: Optional[str] = None,
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

    if lead_store:
        normalized_store = normalize_bdc_lead_store(lead_store)
        if normalized_store:
            clauses.append("lead_store = ?")
            params.append(normalized_store)

    where_sql = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    return where_sql, tuple(params), start_norm, end_norm


def fetch_bdc_log(
    salesperson_id: Optional[int] = None,
    lead_store: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 200,
) -> BdcLogOut:
    where_sql, params, _, _ = build_log_filter(salesperson_id, lead_store, start_date, end_date)
    safe_limit = max(1, min(int(limit or 200), 500))
    count_row = db_query_one(f"SELECT COUNT(*) AS count FROM bdc_assignment_log{where_sql}", params) or {}
    rows = db_query_all(
        f"SELECT * FROM bdc_assignment_log{where_sql} ORDER BY assigned_ts DESC, id DESC LIMIT ?",
        params + (safe_limit,),
    )
    return BdcLogOut(total=int(count_row.get("count") or 0), entries=[bdc_log_out(row) for row in rows])


def create_freshup_log(payload: FreshUpLogCreateIn) -> FreshUpLogOut:
    customer_name = normalize_name(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    if not customer_phone:
        raise HTTPException(status_code=400, detail="customer_phone is required")
    source = normalize_short_text(payload.source or "Desk", "source", max_len=40) or "Desk"

    salesperson_id: Optional[int] = None
    salesperson_name = ""
    salesperson_dealership = ""
    if payload.salesperson_id is not None:
        row = get_salesperson_row(int(payload.salesperson_id))
        if not row:
            raise HTTPException(status_code=404, detail="salesperson not found")
        salesperson_id = int(row.get("id") or 0)
        salesperson_name = str(row.get("name") or "")
        salesperson_dealership = str(row.get("dealership") or "")

    created_id = db_insert(
        """
        INSERT INTO freshup_log (
            created_ts, created_at, customer_name, customer_phone, salesperson_id, salesperson_name,
            salesperson_dealership, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            now_iso(),
            customer_name,
            customer_phone,
            salesperson_id,
            salesperson_name,
            salesperson_dealership,
            source,
        ),
    )
    row = db_query_one("SELECT * FROM freshup_log WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to create freshup log")
    if source.lower() == "nfc card":
        create_freshup_analytics_event(
            FreshUpAnalyticsEventIn(
                salesperson_id=salesperson_id,
                store_dealership=salesperson_dealership,
                event_type="submit",
                link_type="contact_form",
            )
        )
    return freshup_log_out(row)


def fetch_freshup_log(salesperson_id: Optional[int] = None, limit: int = 100) -> FreshUpLogListOut:
    clauses: List[str] = []
    params: List[Any] = []
    if salesperson_id is not None:
        clauses.append("salesperson_id = ?")
        params.append(int(salesperson_id))
    where_sql = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    safe_limit = max(1, min(int(limit or 100), 250))
    count_row = db_query_one(f"SELECT COUNT(*) AS count FROM freshup_log{where_sql}", tuple(params)) or {}
    rows = db_query_all(
        f"SELECT * FROM freshup_log{where_sql} ORDER BY created_ts DESC, id DESC LIMIT ?",
        tuple(params + [safe_limit]),
    )
    return FreshUpLogListOut(total=int(count_row.get("count") or 0), entries=[freshup_log_out(row) for row in rows])


def create_freshup_analytics_event(payload: FreshUpAnalyticsEventIn) -> FreshUpAnalyticsEventOut:
    event_type = normalize_freshup_event_type(payload.event_type)
    link_type = normalize_short_text(payload.link_type, "link_type", max_len=80)
    target_url = normalize_short_text(payload.target_url, "target_url", max_len=500)

    salesperson_id: Optional[int] = None
    salesperson_name = ""
    salesperson_dealership = ""
    if payload.salesperson_id is not None:
        row = get_salesperson_row(int(payload.salesperson_id))
        if row:
            salesperson_id = int(row.get("id") or 0)
            salesperson_name = str(row.get("name") or "")
            salesperson_dealership = str(row.get("dealership") or "")

    store_dealership = normalize_optional_dealership(payload.store_dealership) or salesperson_dealership or ""
    created_id = db_insert(
        """
        INSERT INTO freshup_analytics_events (
            event_ts, event_at, salesperson_id, salesperson_name, salesperson_dealership,
            store_dealership, event_type, link_type, target_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            now_iso(),
            salesperson_id,
            salesperson_name,
            salesperson_dealership,
            store_dealership,
            event_type,
            link_type,
            target_url,
        ),
    )
    row = db_query_one("SELECT * FROM freshup_analytics_events WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to create analytics event")
    return freshup_analytics_event_out(row)


def fetch_freshup_analytics(days: int = 30, salesperson_id: Optional[int] = None) -> FreshUpAnalyticsSummaryOut:
    safe_days = max(1, min(int(days or 30), 365))
    cutoff_ts = time.time() - (safe_days * 86400)
    clauses = ["event_ts >= ?"]
    params: List[Any] = [cutoff_ts]
    if salesperson_id is not None:
        clauses.append("salesperson_id = ?")
        params.append(int(salesperson_id))
    where_sql = f" WHERE {' AND '.join(clauses)}"

    total_row = db_query_one(
        f"""
        SELECT
            COUNT(*) AS total_events,
            SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
            SUM(CASE WHEN event_type = 'submit' THEN 1 ELSE 0 END) AS submissions,
            SUM(CASE WHEN event_type = 'link_click' THEN 1 ELSE 0 END) AS link_clicks
        FROM freshup_analytics_events
        {where_sql}
        """,
        tuple(params),
    ) or {}

    link_rows = db_query_all(
        f"""
        SELECT COALESCE(NULLIF(link_type, ''), 'other') AS label, COUNT(*) AS count
        FROM freshup_analytics_events
        {where_sql} AND event_type = 'link_click'
        GROUP BY COALESCE(NULLIF(link_type, ''), 'other')
        ORDER BY count DESC, label ASC
        """,
        tuple(params),
    )
    store_rows = db_query_all(
        f"""
        SELECT COALESCE(NULLIF(store_dealership, ''), 'Unknown') AS label, COUNT(*) AS count
        FROM freshup_analytics_events
        {where_sql} AND event_type = 'link_click'
        GROUP BY COALESCE(NULLIF(store_dealership, ''), 'Unknown')
        ORDER BY count DESC, label ASC
        """,
        tuple(params),
    )
    recent_rows = db_query_all(
        f"""
        SELECT *
        FROM freshup_analytics_events
        {where_sql}
        ORDER BY event_ts DESC, id DESC
        LIMIT 20
        """,
        tuple(params),
    )
    return FreshUpAnalyticsSummaryOut(
        total_events=int(total_row.get("total_events") or 0),
        page_views=int(total_row.get("page_views") or 0),
        submissions=int(total_row.get("submissions") or 0),
        link_clicks=int(total_row.get("link_clicks") or 0),
        clicks_by_link_type=[
            FreshUpAnalyticsCountOut(label=str(row.get("label") or "other"), count=int(row.get("count") or 0))
            for row in link_rows
        ],
        clicks_by_store=[
            FreshUpAnalyticsCountOut(label=str(row.get("label") or "Unknown"), count=int(row.get("count") or 0))
            for row in store_rows
        ],
        recent=[freshup_analytics_event_out(row) for row in recent_rows],
    )


def fetch_bdc_report(
    salesperson_id: Optional[int] = None,
    lead_store: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BdcReportOut:
    normalized_store = normalize_optional_dealership(lead_store)
    base_where_sql, base_params, start_norm, end_norm = build_log_filter(None, normalized_store, start_date, end_date)
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

    active_salespeople = fetch_round_robin_salespeople(normalized_store)
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
        lead_store=normalized_store,
        total_assignments=total_assignments,
        filtered_assignments=filtered_assignments,
        active_salespeople=active_count,
        expected_min=expected_min,
        expected_max=expected_max,
        selected_salesperson_actual=selected_actual,
        rows=rows,
    )


def clear_bdc_history() -> BdcHistoryClearOut:
    count_row = db_query_one("SELECT COUNT(*) AS count FROM bdc_assignment_log") or {}
    cleared = int(count_row.get("count") or 0)
    db_execute("DELETE FROM bdc_assignment_log")
    return BdcHistoryClearOut(cleared=cleared)


def undo_last_bdc_assignment() -> BdcUndoOut:
    row = db_query_one("SELECT * FROM bdc_assignment_log ORDER BY assigned_ts DESC, id DESC LIMIT 1")
    if not row:
        return BdcUndoOut(removed=None, pointer=0)
    removed = bdc_log_out(row)
    distribution_mode = normalize_bdc_distribution(str(row.get("distribution_mode") or "franchise"))
    lead_store = normalize_bdc_lead_store(str(row.get("lead_store") or "Kia"))
    pool_key = bdc_pool_key_for_mode(distribution_mode, lead_store)
    salespeople = fetch_bdc_pool_salespeople(pool_key)
    try:
        pointer = int(get_meta(bdc_pointer_key(pool_key)) or 0)
    except Exception:
        pointer = 0
    if salespeople:
        pointer = (pointer - 1) % len(salespeople)
        set_meta(bdc_pointer_key(pool_key), str(pointer))
    db_execute("DELETE FROM bdc_assignment_log WHERE id = ?", (int(row.get("id") or 0),))
    return BdcUndoOut(removed=removed, pointer=pointer)


def ensure_bdc_undo_authorized(password: str) -> None:
    settings = get_bdc_undo_settings()
    if not settings.require_password:
        return
    expected = str(get_meta(BDC_UNDO_PASSWORD_META_KEY) or "bdc")
    if str(password or "").strip() != expected:
        raise HTTPException(status_code=403, detail="invalid undo password")


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


def get_service_drive_traffic_row(traffic_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM service_drive_traffic_entries WHERE id = ?", (int(traffic_id),))


def get_service_drive_traffic_row_by_source(source_system: str, source_key: str) -> Optional[Dict[str, Any]]:
    return db_query_one(
        "SELECT * FROM service_drive_traffic_entries WHERE source_system = ? AND source_key = ?",
        (source_system, source_key),
    )


def fetch_service_drive_traffic(
    *,
    month_key: Optional[str] = None,
    traffic_date: Optional[str] = None,
) -> ServiceDriveTrafficListOut:
    resolved_date = parse_iso_date(traffic_date, "traffic_date").isoformat() if traffic_date else None
    resolved_month = parse_month_key(month_key or (resolved_date[:7] if resolved_date else now_local().strftime("%Y-%m")))
    start_date, end_date_exclusive = month_date_bounds(resolved_month)

    month_rows = db_query_all(
        """
        SELECT *
        FROM service_drive_traffic_entries
        WHERE traffic_date >= ? AND traffic_date < ?
        ORDER BY traffic_date ASC,
                 CASE WHEN appointment_ts > 0 THEN appointment_ts ELSE 32503680000 END ASC,
                 created_ts ASC,
                 id ASC
        """,
        (start_date, end_date_exclusive),
    )
    counts_by_date: Dict[str, int] = {}
    for row in month_rows:
        day = str(row.get("traffic_date") or "")
        counts_by_date[day] = counts_by_date.get(day, 0) + 1

    selected_rows = [row for row in month_rows if not resolved_date or str(row.get("traffic_date") or "") == resolved_date]
    drive_team_map = fetch_drive_team_map([str(row.get("traffic_date") or "") for row in selected_rows])
    offer_image_map = fetch_traffic_offer_image_map([int(row.get("id") or 0) for row in selected_rows])
    return ServiceDriveTrafficListOut(
        month=resolved_month,
        selected_date=resolved_date,
        total=len(selected_rows),
        counts_by_date=counts_by_date,
        entries=[service_drive_traffic_out(row, drive_team_map, offer_image_map) for row in selected_rows],
    )


def fetch_quote_rates() -> List[QuoteRateOut]:
    rows = db_query_all("SELECT brand, tier, apr FROM quote_rate_tiers ORDER BY brand, tier")
    return [
        QuoteRateOut(
            brand=str(row.get("brand") or ""),
            tier=str(row.get("tier") or ""),
            apr=float(row.get("apr") or 0.0),
        )
        for row in rows
    ]


def upsert_quote_rates(rates: List[QuoteRateOut]) -> None:
    if not rates:
        return
    with db_lock:
        conn = get_db()
        try:
            for rate in rates:
                brand = normalize_quote_brand(rate.brand)
                tier = normalize_short_text(rate.tier, "tier", max_len=12)
                apr = float(rate.apr or 0.0)
                conn.execute(
                    """
                    INSERT INTO quote_rate_tiers (brand, tier, apr)
                    VALUES (?, ?, ?)
                    ON CONFLICT(brand, tier) DO UPDATE SET apr = excluded.apr
                    """,
                    (brand, tier, apr),
                )
            conn.commit()
        except Exception as exc:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"failed to save quote rates: {exc}") from exc


def default_marketplace_template() -> MarketplaceTemplateOut:
    return MarketplaceTemplateOut(
        title_template="{year} {make} {model}",
        description_template=(
            "{year} {make} {model}\n"
            "{price_label}: {price}\n"
            "Mileage: {mileage}\n"
            "VIN: {vin}\n"
            "{cta_text}\n"
            "{url}"
        ),
        price_label="Price",
        cta_text="Message us today for availability, trade value, and financing options.",
    )


MARKETPLACE_TITLE_TOKEN = "{year} {make} {model}"
MARKETPLACE_PRICE_LINE = "{price_label}: {price}"
MARKETPLACE_MILEAGE_LINE = "Mileage: {mileage}"
MARKETPLACE_VIN_LINE = "VIN: {vin}"
MARKETPLACE_CTA_LINE = "{cta_text}"
MARKETPLACE_URL_LINE = "{url}"


def normalize_marketplace_title_template(value: str) -> str:
    title_template = normalize_short_text(value or MARKETPLACE_TITLE_TOKEN, "title_template", max_len=200)
    if MARKETPLACE_TITLE_TOKEN not in title_template:
        return MARKETPLACE_TITLE_TOKEN
    return title_template


def normalize_marketplace_price_label(value: str) -> str:
    text = normalize_short_text(value or default_marketplace_template().price_label, "price_label", max_len=60)
    if not text:
        return default_marketplace_template().price_label
    lowered = text.lower()
    if any(char.isdigit() for char in text) or "$" in text or "{" in text or "}" in text or "http" in lowered:
        return default_marketplace_template().price_label
    return text


def normalize_marketplace_cta_text(value: str) -> str:
    text = " ".join(normalize_notes(value or "", "cta_text", max_len=500).split())
    if not text:
        return ""
    lowered = text.lower()
    digit_count = len(re.sub(r"\D", "", text))
    if digit_count >= 7 or "http" in lowered or "www." in lowered or "{" in text or "}" in text:
        return default_marketplace_template().cta_text
    return text


def normalize_marketplace_description_template(value: str, cta_text: str) -> str:
    lines = [line.strip() for line in str(value or "").replace("\r\n", "\n").split("\n") if line.strip()]
    include_vehicle_line = any(line == MARKETPLACE_TITLE_TOKEN for line in lines)
    include_mileage = any("{mileage}" in line for line in lines)
    include_vin = any("{vin}" in line for line in lines)
    include_url = any("{url}" in line for line in lines)

    normalized_lines = []
    if include_vehicle_line:
        normalized_lines.append(MARKETPLACE_TITLE_TOKEN)
    normalized_lines.append(MARKETPLACE_PRICE_LINE)
    if include_mileage:
        normalized_lines.append(MARKETPLACE_MILEAGE_LINE)
    if include_vin:
        normalized_lines.append(MARKETPLACE_VIN_LINE)
    if cta_text:
        normalized_lines.append(MARKETPLACE_CTA_LINE)
    if include_url:
        normalized_lines.append(MARKETPLACE_URL_LINE)
    return "\n".join(normalized_lines)


def fetch_marketplace_template() -> MarketplaceTemplateOut:
    row = db_query_one("SELECT * FROM marketplace_template WHERE id = 1")
    if not row:
        return default_marketplace_template()
    defaults = default_marketplace_template()
    price_label = normalize_marketplace_price_label(str(row.get("price_label") or defaults.price_label))
    cta_text = normalize_marketplace_cta_text(str(row.get("cta_text") or ""))
    return MarketplaceTemplateOut(
        title_template=normalize_marketplace_title_template(str(row.get("title_template") or defaults.title_template)),
        description_template=normalize_marketplace_description_template(
            str(row.get("description_template") or defaults.description_template),
            cta_text,
        ),
        price_label=price_label,
        cta_text=cta_text,
    )


def update_marketplace_template(payload: MarketplaceTemplateIn) -> MarketplaceTemplateOut:
    title_template = normalize_marketplace_title_template(payload.title_template)
    price_label = normalize_marketplace_price_label(payload.price_label or default_marketplace_template().price_label)
    cta_text = normalize_marketplace_cta_text(payload.cta_text or "")
    description_template = normalize_marketplace_description_template(
        normalize_notes(payload.description_template, "description_template", max_len=4000),
        cta_text,
    )
    db_execute(
        """
        INSERT INTO marketplace_template (id, title_template, description_template, price_label, cta_text)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title_template = excluded.title_template,
            description_template = excluded.description_template,
            price_label = excluded.price_label,
            cta_text = excluded.cta_text
        """,
        (title_template, description_template, price_label, cta_text),
    )
    return fetch_marketplace_template()


def normalize_agent_reasoning_effort(value: str) -> str:
    text = str(value or "").strip().lower()
    if text in {"none", "low", "medium", "high", "xhigh"}:
        return text
    return "low"


def openai_agent_configured() -> bool:
    return bool(OPENAI_API_KEY)


def trim_agent_text(value: Any, *, max_len: int = 4000) -> str:
    text = str(value or "").replace("\r\n", "\n").strip()
    if len(text) > max_len:
        return f"{text[: max_len - 3]}..."
    return text


def normalize_agent_string_list(value: Any, *, max_items: int = 8, max_len: int = 280) -> List[str]:
    items: List[str] = []
    for raw_item in value if isinstance(value, list) else []:
        text = trim_agent_text(raw_item, max_len=max_len)
        if text:
            items.append(text)
        if len(items) >= max_items:
            break
    return items


def safe_json_dumps(value: Any, default: str = "{}") -> str:
    try:
        return json.dumps(value, ensure_ascii=True)
    except Exception:
        return default


def safe_json_loads(value: str, default: Any) -> Any:
    try:
        return json.loads(str(value or "").strip())
    except Exception:
        return default


def agent_loop_presets_out() -> List[AgentLoopPresetOut]:
    return [AgentLoopPresetOut(**preset) for preset in AGENT_LOOP_PRESETS]


def get_agent_loop_config() -> AgentLoopConfigOut:
    return AgentLoopConfigOut(
        provider="OpenAI",
        configured=openai_agent_configured(),
        model=OPENAI_AGENT_MODEL,
        reasoning_effort=normalize_agent_reasoning_effort(OPENAI_AGENT_REASONING_EFFORT),
        max_steps=OPENAI_AGENT_MAX_STEPS,
        presets=agent_loop_presets_out(),
    )


def get_agent_loop_preset(preset_key: str) -> Dict[str, str]:
    normalized = str(preset_key or "").strip()
    for preset in AGENT_LOOP_PRESETS:
        if preset["key"] == normalized:
            return preset
    raise HTTPException(status_code=400, detail="unknown agent loop preset")


def agent_loop_event_out(row: Dict[str, Any]) -> AgentLoopEventOut:
    payload = safe_json_loads(str(row.get("payload_json") or ""), {})
    if not isinstance(payload, dict):
        payload = {}
    return AgentLoopEventOut(
        id=int(row.get("id") or 0),
        run_id=int(row.get("run_id") or 0),
        step_index=int(row.get("step_index") or 0),
        event_type=str(row.get("event_type") or ""),
        title=str(row.get("title") or ""),
        content=str(row.get("content") or ""),
        payload=payload,
        created_at=str(row.get("created_at") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
    )


def agent_loop_run_out(row: Dict[str, Any]) -> AgentLoopRunOut:
    actions = safe_json_loads(str(row.get("high_priority_actions_json") or "[]"), [])
    observations = safe_json_loads(str(row.get("observations_json") or "[]"), [])
    return AgentLoopRunOut(
        id=int(row.get("id") or 0),
        preset_key=str(row.get("preset_key") or ""),
        preset_label=str(row.get("preset_label") or ""),
        objective=str(row.get("objective") or ""),
        status=str(row.get("status") or "queued"),
        created_at=str(row.get("created_at") or ""),
        created_ts=float(row.get("created_ts") or 0.0),
        started_at=str(row.get("started_at") or "").strip() or None,
        finished_at=str(row.get("finished_at") or "").strip() or None,
        model=str(row.get("model") or OPENAI_AGENT_MODEL),
        reasoning_effort=str(row.get("reasoning_effort") or normalize_agent_reasoning_effort(OPENAI_AGENT_REASONING_EFFORT)),
        total_steps=int(row.get("total_steps") or 0),
        summary=str(row.get("summary") or ""),
        latest_thinking=str(row.get("latest_thinking") or ""),
        high_priority_actions=normalize_agent_string_list(actions),
        observations=normalize_agent_string_list(observations),
        error_message=str(row.get("error_message") or ""),
    )


def get_agent_loop_run_row(run_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM agent_loop_runs WHERE id = ?", (int(run_id),))


def fetch_agent_loop_runs(limit: int = 20) -> AgentLoopRunListOut:
    safe_limit = max(1, min(int(limit or 20), 50))
    count_row = db_query_one("SELECT COUNT(*) AS count FROM agent_loop_runs") or {}
    rows = db_query_all(
        "SELECT * FROM agent_loop_runs ORDER BY created_ts DESC, id DESC LIMIT ?",
        (safe_limit,),
    )
    return AgentLoopRunListOut(
        total=int(count_row.get("count") or 0),
        entries=[agent_loop_run_out(row) for row in rows],
    )


def fetch_agent_loop_detail(run_id: int, event_limit: int = 120) -> AgentLoopRunDetailOut:
    row = get_agent_loop_run_row(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="agent loop run not found")
    safe_limit = max(1, min(int(event_limit or 120), 200))
    event_rows = db_query_all(
        """
        SELECT *
        FROM agent_loop_events
        WHERE run_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (int(run_id), safe_limit),
    )
    event_rows.reverse()
    return AgentLoopRunDetailOut(
        **agent_loop_run_out(row).model_dump(),
        events=[agent_loop_event_out(event_row) for event_row in event_rows],
    )


def record_agent_loop_event(
    run_id: int,
    step_index: int,
    event_type: str,
    title: str,
    *,
    content: str = "",
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    created_ts = time.time()
    db_insert(
        """
        INSERT INTO agent_loop_events (
            run_id, step_index, event_type, title, content, payload_json, created_ts, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            int(run_id),
            int(step_index),
            trim_agent_text(event_type, max_len=80) or "note",
            trim_agent_text(title, max_len=200) or "Agent loop event",
            trim_agent_text(content, max_len=12000),
            safe_json_dumps(payload or {}, default="{}"),
            created_ts,
            now_iso(),
        ),
    )


def update_agent_loop_run(
    run_id: int,
    *,
    status: Optional[str] = None,
    set_started: bool = False,
    set_finished: bool = False,
    total_steps: Optional[int] = None,
    summary: Optional[str] = None,
    latest_thinking: Optional[str] = None,
    high_priority_actions: Optional[List[str]] = None,
    observations: Optional[List[str]] = None,
    error_message: Optional[str] = None,
) -> None:
    assignments: List[str] = []
    params: List[Any] = []
    if status is not None:
        assignments.append("status = ?")
        params.append(status)
    if set_started:
        now_value = now_iso()
        assignments.extend(["started_ts = ?", "started_at = ?"])
        params.extend([time.time(), now_value])
    if set_finished:
        now_value = now_iso()
        assignments.extend(["finished_ts = ?", "finished_at = ?"])
        params.extend([time.time(), now_value])
    if total_steps is not None:
        assignments.append("total_steps = ?")
        params.append(max(0, int(total_steps)))
    if summary is not None:
        assignments.append("summary = ?")
        params.append(trim_agent_text(summary, max_len=8000))
    if latest_thinking is not None:
        assignments.append("latest_thinking = ?")
        params.append(trim_agent_text(latest_thinking, max_len=4000))
    if high_priority_actions is not None:
        assignments.append("high_priority_actions_json = ?")
        params.append(safe_json_dumps(normalize_agent_string_list(high_priority_actions), default="[]"))
    if observations is not None:
        assignments.append("observations_json = ?")
        params.append(safe_json_dumps(normalize_agent_string_list(observations), default="[]"))
    if error_message is not None:
        assignments.append("error_message = ?")
        params.append(trim_agent_text(error_message, max_len=2000))
    if not assignments:
        return
    params.append(int(run_id))
    db_execute(f"UPDATE agent_loop_runs SET {', '.join(assignments)} WHERE id = ?", tuple(params))


def agent_loop_is_stopped(run_id: int) -> bool:
    row = get_agent_loop_run_row(run_id)
    status = str(row.get("status") or "") if row else ""
    return status in {"canceled", "failed", "completed", "blocked"}


def parse_agent_json_response(text: str) -> Dict[str, Any]:
    raw = str(text or "").strip()
    if raw.startswith("```"):
        first_newline = raw.find("\n")
        last_fence = raw.rfind("```")
        if first_newline >= 0 and last_fence > first_newline:
            raw = raw[first_newline + 1 : last_fence].strip()
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        candidate = raw[first_brace : last_brace + 1]
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("model did not return valid JSON")


def extract_openai_response_text(payload: Dict[str, Any]) -> str:
    output_text = trim_agent_text(payload.get("output_text"), max_len=12000)
    if output_text:
        return output_text
    parts: List[str] = []
    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        if item.get("type") == "message":
            for content in item.get("content", []):
                if not isinstance(content, dict):
                    continue
                text_value = content.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    parts.append(text_value.strip())
                elif isinstance(text_value, dict):
                    candidate = trim_agent_text(text_value.get("value"), max_len=12000)
                    if candidate:
                        parts.append(candidate)
    if parts:
        return "\n".join(parts)
    raise RuntimeError("OpenAI response did not include output text")


def request_openai_agent(messages: List[Dict[str, str]]) -> str:
    if not openai_agent_configured():
        raise RuntimeError("OPENAI_API_KEY is not configured")
    payload: Dict[str, Any] = {
        "model": OPENAI_AGENT_MODEL,
        "input": messages,
    }
    effort = normalize_agent_reasoning_effort(OPENAI_AGENT_REASONING_EFFORT)
    if effort:
        payload["reasoning"] = {"effort": effort}
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    request.add_header("Authorization", f"Bearer {OPENAI_API_KEY}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI HTTP {exc.code}: {detail or exc.reason}") from exc
    except Exception as exc:
        raise RuntimeError(f"OpenAI request failed: {compact_error_text(exc)}") from exc
    return extract_openai_response_text(data)


def call_agent_decision(messages: List[Dict[str, str]]) -> Tuple[Dict[str, Any], str]:
    raw_text = request_openai_agent(messages)
    try:
        return parse_agent_json_response(raw_text), raw_text
    except Exception:
        repair_messages = messages + [
            {"role": "assistant", "content": raw_text},
            {
                "role": "user",
                "content": "Return the same answer again as strict JSON only. No markdown fences, no prose, and no explanation outside the JSON object.",
            },
        ]
        repaired_text = request_openai_agent(repair_messages)
        return parse_agent_json_response(repaired_text), repaired_text


def agent_date_range(days: int) -> Tuple[str, str]:
    safe_days = max(1, min(int(days or 1), 365))
    end_date = now_local().date()
    start_date = end_date - timedelta(days=safe_days - 1)
    return start_date.isoformat(), end_date.isoformat()


def agent_int_arg(args: Dict[str, Any], key: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(args.get(key) if key in args else default)
    except Exception:
        value = default
    return max(minimum, min(maximum, value))


def agent_optional_int_arg(args: Dict[str, Any], key: str) -> Optional[int]:
    raw = args.get(key)
    if raw in (None, ""):
        return None
    try:
        return int(raw)
    except Exception:
        raise HTTPException(status_code=400, detail=f"{key} must be an integer")


def agent_optional_month_arg(args: Dict[str, Any], key: str = "month") -> Optional[str]:
    raw = str(args.get(key) or "").strip()
    if not raw:
        return None
    return parse_month_key(raw)


def agent_optional_date_arg(args: Dict[str, Any], key: str) -> Optional[str]:
    raw = str(args.get(key) or "").strip()
    if not raw:
        return None
    return parse_iso_date(raw, key).isoformat()


def build_agent_overview_tool_output() -> Dict[str, Any]:
    today_value = now_local().date().isoformat()
    month_value = now_local().strftime("%Y-%m")
    active_by_store = db_query_all(
        """
        SELECT dealership, COUNT(*) AS count
        FROM salespeople
        WHERE active = 1
        GROUP BY dealership
        ORDER BY dealership ASC
        """
    )
    notify_row = db_query_one(
        """
        SELECT
            SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_salespeople,
            SUM(CASE WHEN active = 1 AND notify_sms = 1 THEN 1 ELSE 0 END) AS sms_enabled,
            SUM(CASE WHEN active = 1 AND notify_email = 1 THEN 1 ELSE 0 END) AS email_enabled
        FROM salespeople
        """
    ) or {}
    bdc_start, bdc_end = agent_date_range(14)
    bdc_report = fetch_bdc_report(start_date=bdc_start, end_date=bdc_end).model_dump()
    bdc_report["rows"] = bdc_report.get("rows", [])[:6]
    freshup_summary = fetch_freshup_analytics(days=14).model_dump()
    freshup_summary["recent"] = freshup_summary.get("recent", [])[:8]
    traffic_month = fetch_service_drive_traffic(month_key=month_value).model_dump()
    traffic_today = fetch_service_drive_traffic(month_key=month_value, traffic_date=today_value).model_dump()
    missing_service_notes = db_query_one(
        """
        SELECT COUNT(*) AS count
        FROM service_drive_notes
        WHERE appointment_date >= ? AND TRIM(COALESCE(sales_notes, '')) = ''
        """,
        (today_value,),
    ) or {}
    missing_traffic_notes = db_query_one(
        """
        SELECT COUNT(*) AS count
        FROM service_drive_traffic_entries
        WHERE traffic_date >= ? AND TRIM(COALESCE(sales_notes, '')) = ''
        """,
        (today_value,),
    ) or {}
    busiest_days = sorted(
        [
            {"date": day, "count": int(count or 0)}
            for day, count in (traffic_month.get("counts_by_date") or {}).items()
        ],
        key=lambda item: (-item["count"], item["date"]),
    )[:6]
    return {
        "timestamp": now_iso(),
        "month": month_value,
        "today": today_value,
        "distribution_mode": get_bdc_distribution_mode(),
        "notifications": get_notification_config().model_dump(),
        "staffing": {
            "active_salespeople": int(notify_row.get("active_salespeople") or 0),
            "sms_enabled": int(notify_row.get("sms_enabled") or 0),
            "email_enabled": int(notify_row.get("email_enabled") or 0),
            "active_by_store": [
                {"dealership": str(row.get("dealership") or ""), "count": int(row.get("count") or 0)}
                for row in active_by_store
            ],
        },
        "bdc_last_14_days": bdc_report,
        "freshups_last_14_days": freshup_summary,
        "traffic_month": {
            "month": traffic_month.get("month"),
            "total": int(traffic_month.get("total") or 0),
            "busiest_days": busiest_days,
        },
        "traffic_today": {
            "selected_date": traffic_today.get("selected_date"),
            "total": int(traffic_today.get("total") or 0),
            "entries": (traffic_today.get("entries") or [])[:8],
        },
        "follow_up_gaps": {
            "service_notes_missing_sales_notes": int(missing_service_notes.get("count") or 0),
            "traffic_rows_missing_sales_notes": int(missing_traffic_notes.get("count") or 0),
        },
    }


def build_agent_sales_team_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    include_inactive = bool(args.get("include_inactive"))
    rows = db_query_all(
        """
        SELECT id, name, dealership, active, phone_number, email, notify_sms, notify_email
        FROM salespeople
        {where_sql}
        ORDER BY active DESC, dealership ASC, name ASC, id ASC
        """.format(where_sql="" if include_inactive else "WHERE active = 1")
    )
    bdc_rows = db_query_all(
        """
        SELECT id, name, active
        FROM bdc_agents
        ORDER BY active DESC, name ASC, id ASC
        """
    )
    return {
        "salespeople": [
            {
                "id": int(row.get("id") or 0),
                "name": str(row.get("name") or ""),
                "dealership": str(row.get("dealership") or ""),
                "active": bool(int(row.get("active") or 0)),
                "phone_number": str(row.get("phone_number") or ""),
                "email": str(row.get("email") or ""),
                "notify_sms": bool(int(row.get("notify_sms") or 0)),
                "notify_email": bool(int(row.get("notify_email") or 0)),
            }
            for row in rows[:20]
        ],
        "bdc_agents": [
            {
                "id": int(row.get("id") or 0),
                "name": str(row.get("name") or ""),
                "active": bool(int(row.get("active") or 0)),
            }
            for row in bdc_rows[:20]
        ],
    }


def build_agent_bdc_report_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    days = agent_int_arg(args, "days", 30, 1, 90)
    start_date, end_date = agent_date_range(days)
    lead_store = normalize_optional_dealership(args.get("lead_store"))
    salesperson_id = agent_optional_int_arg(args, "salesperson_id")
    data = fetch_bdc_report(
        salesperson_id=salesperson_id,
        lead_store=lead_store,
        start_date=start_date,
        end_date=end_date,
    ).model_dump()
    data["rows"] = data.get("rows", [])[:12]
    data["days"] = days
    return data


def build_agent_bdc_log_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    days = agent_int_arg(args, "days", 14, 1, 60)
    limit = agent_int_arg(args, "limit", 12, 1, 25)
    start_date, end_date = agent_date_range(days)
    lead_store = normalize_optional_dealership(args.get("lead_store"))
    salesperson_id = agent_optional_int_arg(args, "salesperson_id")
    data = fetch_bdc_log(
        salesperson_id=salesperson_id,
        lead_store=lead_store,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    ).model_dump()
    data["days"] = days
    return data


def build_agent_freshup_log_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    limit = agent_int_arg(args, "limit", 12, 1, 25)
    salesperson_id = agent_optional_int_arg(args, "salesperson_id")
    return fetch_freshup_log(salesperson_id=salesperson_id, limit=limit).model_dump()


def build_agent_freshup_analytics_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    days = agent_int_arg(args, "days", 30, 1, 180)
    salesperson_id = agent_optional_int_arg(args, "salesperson_id")
    data = fetch_freshup_analytics(days=days, salesperson_id=salesperson_id).model_dump()
    data["recent"] = data.get("recent", [])[:12]
    return data


def build_agent_service_notes_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    limit = agent_int_arg(args, "limit", 12, 1, 25)
    salesperson_id = agent_optional_int_arg(args, "salesperson_id")
    brand = str(args.get("brand") or "").strip() or None
    start_date = agent_optional_date_arg(args, "start_date")
    end_date = agent_optional_date_arg(args, "end_date")
    if not start_date or not end_date:
        start_date, end_date = agent_date_range(agent_int_arg(args, "days", 14, 1, 60))
    data = fetch_service_notes(
        salesperson_id=salesperson_id,
        start_date=start_date,
        end_date=end_date,
        brand=brand,
        limit=limit,
    ).model_dump()
    return data


def build_agent_service_traffic_tool_output(args: Dict[str, Any]) -> Dict[str, Any]:
    month_value = agent_optional_month_arg(args, "month")
    traffic_date = agent_optional_date_arg(args, "traffic_date")
    data = fetch_service_drive_traffic(month_key=month_value, traffic_date=traffic_date).model_dump()
    counts_by_date = data.get("counts_by_date") or {}
    busiest_days = sorted(
        [{"date": day, "count": int(count or 0)} for day, count in counts_by_date.items()],
        key=lambda item: (-item["count"], item["date"]),
    )[:8]
    data["busiest_days"] = busiest_days
    data["entries"] = data.get("entries", [])[:12]
    data.pop("counts_by_date", None)
    return data


def build_agent_quote_rates_tool_output() -> Dict[str, Any]:
    return {"entries": [entry.model_dump() for entry in fetch_quote_rates()]}


def build_agent_marketplace_template_tool_output() -> Dict[str, Any]:
    return fetch_marketplace_template().model_dump()


def execute_agent_tool_call(tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    normalized_args = args if isinstance(args, dict) else {}
    if tool_name == "get_overview":
        return build_agent_overview_tool_output()
    if tool_name == "get_sales_team":
        return build_agent_sales_team_tool_output(normalized_args)
    if tool_name == "get_bdc_report":
        return build_agent_bdc_report_tool_output(normalized_args)
    if tool_name == "get_bdc_log":
        return build_agent_bdc_log_tool_output(normalized_args)
    if tool_name == "get_freshup_log":
        return build_agent_freshup_log_tool_output(normalized_args)
    if tool_name == "get_freshup_analytics":
        return build_agent_freshup_analytics_tool_output(normalized_args)
    if tool_name == "get_service_notes":
        return build_agent_service_notes_tool_output(normalized_args)
    if tool_name == "get_service_drive_traffic":
        return build_agent_service_traffic_tool_output(normalized_args)
    if tool_name == "get_quote_rates":
        return build_agent_quote_rates_tool_output()
    if tool_name == "get_marketplace_template":
        return build_agent_marketplace_template_tool_output()
    raise HTTPException(status_code=400, detail=f"unknown agent tool: {tool_name}")


def agent_tool_catalog_text() -> str:
    return "\n".join(
        [
            "- get_overview {}: cross-system dealership snapshot with staffing, BDC, freshup, and service-drive signals.",
            "- get_sales_team { include_inactive?: boolean }: sales roster and BDC-agent notification setup.",
            "- get_bdc_report { days?: int, lead_store?: 'Kia'|'Mazda'|'Outlet', salesperson_id?: int }: BDC summary and fairness view.",
            "- get_bdc_log { days?: int, limit?: int, lead_store?: 'Kia'|'Mazda'|'Outlet', salesperson_id?: int }: recent BDC assignments.",
            "- get_freshup_log { limit?: int, salesperson_id?: int }: newest freshups.",
            "- get_freshup_analytics { days?: int, salesperson_id?: int }: tap-page analytics and conversions.",
            "- get_service_notes { days?: int, start_date?: 'YYYY-MM-DD', end_date?: 'YYYY-MM-DD', brand?: 'Kia'|'Mazda', salesperson_id?: int, limit?: int }: service appointment notes.",
            "- get_service_drive_traffic { month?: 'YYYY-MM', traffic_date?: 'YYYY-MM-DD' }: traffic rows and busiest days.",
            "- get_quote_rates {}: current quote-rate tiers.",
            "- get_marketplace_template {}: current marketplace template wording.",
        ]
    )


def build_agent_loop_messages(run_row: Dict[str, Any]) -> List[Dict[str, str]]:
    preset = get_agent_loop_preset(str(run_row.get("preset_key") or ""))
    instructions = (
        "You are the internal operations agent for a dealership management dashboard. "
        "Work in bounded loops. Never invent metrics or store activity. "
        "Prefer the smallest number of tool calls that can answer the objective. "
        "You may request at most 2 tool calls in a step. "
        "If the available data is enough, finish with concrete next actions. "
        "If the objective is blocked by missing setup or missing data, return status blocked. "
        "Return JSON only with this exact shape: "
        "{"
        "\"status\":\"continue|complete|blocked\","
        "\"thinking\":\"short operational reasoning\","
        "\"tool_calls\":[{\"tool\":\"tool_name\",\"reason\":\"why\",\"args\":{}}],"
        "\"final_summary\":\"filled when complete or blocked\","
        "\"high_priority_actions\":[\"action 1\"],"
        "\"observations\":[\"observation 1\"]"
        "}. "
        "When status is continue, keep final_summary short or empty. "
        "When status is complete or blocked, tool_calls must be empty."
    )
    user_prompt = (
        f"Preset: {preset['label']}\n"
        f"Preset description: {preset['description']}\n"
        f"Objective: {str(run_row.get('objective') or '').strip()}\n"
        f"Current local time: {now_iso()}\n"
        f"Timezone: {RULES_TIMEZONE}\n"
        "Available tools:\n"
        f"{agent_tool_catalog_text()}\n\n"
        "Start the loop. If you need a broad snapshot first, call get_overview."
    )
    return [
        {"role": "developer", "content": instructions},
        {"role": "user", "content": user_prompt},
    ]


def finalize_agent_loop_run(
    run_id: int,
    parsed: Dict[str, Any],
    *,
    step_index: int,
    blocked: bool = False,
) -> None:
    summary = trim_agent_text(parsed.get("final_summary") or parsed.get("thinking") or "Agent loop finished.")
    thinking = trim_agent_text(parsed.get("thinking"), max_len=4000)
    actions = normalize_agent_string_list(parsed.get("high_priority_actions"))
    observations = normalize_agent_string_list(parsed.get("observations"))
    update_agent_loop_run(
        run_id,
        status="blocked" if blocked else "completed",
        set_finished=True,
        total_steps=step_index,
        summary=summary,
        latest_thinking=thinking,
        high_priority_actions=actions,
        observations=observations,
        error_message="",
    )
    record_agent_loop_event(
        run_id,
        step_index,
        "final",
        "Loop finished",
        content=summary,
        payload={
            "status": "blocked" if blocked else "completed",
            "high_priority_actions": actions,
            "observations": observations,
        },
    )


def run_agent_loop_worker(run_id: int) -> None:
    try:
        run_row = get_agent_loop_run_row(run_id)
        if not run_row:
            return
        update_agent_loop_run(
            run_id,
            status="running",
            set_started=True,
            latest_thinking="Starting agent loop.",
        )
        record_agent_loop_event(
            run_id,
            0,
            "status",
            "Loop started",
            content=f"{run_row.get('preset_label') or 'Agent loop'} started with model {OPENAI_AGENT_MODEL}.",
        )
        messages = build_agent_loop_messages(run_row)
        final_parsed: Optional[Dict[str, Any]] = None
        final_step = 0
        for step_index in range(1, OPENAI_AGENT_MAX_STEPS + 1):
            if agent_loop_is_stopped(run_id):
                return
            parsed, raw_text = call_agent_decision(messages)
            status = str(parsed.get("status") or "continue").strip().lower()
            if status not in {"continue", "complete", "blocked"}:
                status = "continue"
            thinking = trim_agent_text(parsed.get("thinking"), max_len=4000)
            tool_calls = parsed.get("tool_calls") if isinstance(parsed.get("tool_calls"), list) else []
            normalized_tool_calls: List[Dict[str, Any]] = []
            for tool_call in tool_calls[:2]:
                if not isinstance(tool_call, dict):
                    continue
                tool_name = trim_agent_text(tool_call.get("tool"), max_len=80)
                if not tool_name:
                    continue
                normalized_tool_calls.append(
                    {
                        "tool": tool_name,
                        "reason": trim_agent_text(tool_call.get("reason"), max_len=240),
                        "args": tool_call.get("args") if isinstance(tool_call.get("args"), dict) else {},
                    }
                )
            update_agent_loop_run(
                run_id,
                total_steps=step_index,
                latest_thinking=thinking or f"Processed step {step_index}.",
            )
            record_agent_loop_event(
                run_id,
                step_index,
                "analysis",
                f"Loop step {step_index}",
                content=thinking or trim_agent_text(raw_text, max_len=1200),
                payload={"status": status, "tool_calls": normalized_tool_calls},
            )
            messages.append({"role": "assistant", "content": raw_text})
            if status in {"complete", "blocked"} and not normalized_tool_calls:
                finalize_agent_loop_run(run_id, parsed, step_index=step_index, blocked=status == "blocked")
                return
            if not normalized_tool_calls:
                final_parsed = parsed
                final_step = step_index
                break
            tool_result_messages: List[str] = []
            for tool_call in normalized_tool_calls:
                if agent_loop_is_stopped(run_id):
                    return
                record_agent_loop_event(
                    run_id,
                    step_index,
                    "tool_call",
                    tool_call["tool"],
                    content=tool_call.get("reason") or f"Calling {tool_call['tool']}.",
                    payload={"args": tool_call.get("args") or {}},
                )
                try:
                    tool_result = execute_agent_tool_call(tool_call["tool"], tool_call.get("args") or {})
                except Exception as exc:
                    tool_result = {"error": compact_error_text(exc)}
                record_agent_loop_event(
                    run_id,
                    step_index,
                    "tool_result",
                    tool_call["tool"],
                    content=trim_agent_text(json.dumps(tool_result, ensure_ascii=True, indent=2), max_len=3000),
                    payload=tool_result if isinstance(tool_result, dict) else {"result": tool_result},
                )
                tool_result_messages.append(
                    f"Tool `{tool_call['tool']}` result:\n{json.dumps(tool_result, ensure_ascii=True, indent=2)}"
                )
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Here are the tool results from the last step. Continue the loop and either call more tools or finish.\n\n"
                        + "\n\n".join(tool_result_messages)
                    ),
                }
            )
        if final_parsed is None:
            messages.append(
                {
                    "role": "user",
                    "content": "You have reached the tool-step limit. Return a final JSON answer now with no further tool calls.",
                }
            )
            final_parsed, _ = call_agent_decision(messages)
            final_step = OPENAI_AGENT_MAX_STEPS
        finalize_agent_loop_run(
            run_id,
            final_parsed,
            step_index=max(1, final_step),
            blocked=str(final_parsed.get("status") or "").strip().lower() == "blocked",
        )
    except Exception as exc:
        error_text = compact_error_text(exc)
        update_agent_loop_run(
            run_id,
            status="failed",
            set_finished=True,
            error_message=error_text,
            latest_thinking="Agent loop failed.",
        )
        record_agent_loop_event(run_id, 0, "error", "Loop failed", content=error_text)
    finally:
        with agent_run_threads_lock:
            agent_run_threads.pop(int(run_id), None)


def start_agent_loop_worker(run_id: int) -> None:
    thread = threading.Thread(target=run_agent_loop_worker, args=(int(run_id),), daemon=True)
    with agent_run_threads_lock:
        existing = agent_run_threads.get(int(run_id))
        if existing and existing.is_alive():
            return
        agent_run_threads[int(run_id)] = thread
    thread.start()


def create_agent_loop_run(payload: AgentLoopRunIn) -> AgentLoopRunDetailOut:
    if not openai_agent_configured():
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is not configured")
    preset = get_agent_loop_preset(payload.preset_key)
    objective = trim_agent_text(
        normalize_notes(payload.objective or preset["starter_objective"], "objective", max_len=2000),
        max_len=2000,
    )
    created_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO agent_loop_runs (
            preset_key, preset_label, objective, status, created_ts, created_at,
            model, reasoning_effort, total_steps, summary, latest_thinking,
            high_priority_actions_json, observations_json, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '', '', '[]', '[]', '')
        """,
        (
            preset["key"],
            preset["label"],
            objective,
            "queued",
            created_ts,
            now_iso(),
            OPENAI_AGENT_MODEL,
            normalize_agent_reasoning_effort(OPENAI_AGENT_REASONING_EFFORT),
        ),
    )
    record_agent_loop_event(
        created_id,
        0,
        "queued",
        "Loop queued",
        content=f"{preset['label']} queued with objective: {objective}",
    )
    start_agent_loop_worker(created_id)
    return fetch_agent_loop_detail(created_id)


def cancel_agent_loop_run(run_id: int) -> AgentLoopRunDetailOut:
    row = get_agent_loop_run_row(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="agent loop run not found")
    current_status = str(row.get("status") or "queued")
    if current_status in {"completed", "blocked", "failed", "canceled"}:
        return fetch_agent_loop_detail(run_id)
    update_agent_loop_run(
        run_id,
        status="canceled",
        set_finished=True,
        latest_thinking="Loop canceled by admin.",
    )
    record_agent_loop_event(run_id, int(row.get("total_steps") or 0), "canceled", "Loop canceled", content="Admin canceled this loop.")
    return fetch_agent_loop_detail(run_id)


def reynolds_text(row: Dict[str, Any], key: str) -> str:
    return str(row.get(key) or "").strip()


def first_nonempty(*values: str) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def decode_csv_upload(file: UploadFile) -> List[Dict[str, Any]]:
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="csv file is empty")

    decoded: Optional[str] = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            decoded = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        raise HTTPException(status_code=400, detail="could not decode csv file")

    rows = list(csv.DictReader(io.StringIO(decoded)))
    if not rows:
        raise HTTPException(status_code=400, detail="csv file did not contain any rows")
    return rows


def parse_reynolds_datetime_text(value: str) -> Optional[datetime]:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in (
        "%m/%d/%y %H:%M",
        "%m/%d/%y %I:%M",
        "%m/%d/%y %I:%M %p",
        "%m/%d/%y %I:%M:%S %p",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def format_clock_label(value: datetime) -> str:
    return value.strftime("%I:%M %p").lstrip("0")


def reynolds_brand(row: Dict[str, Any]) -> Optional[str]:
    make_code = reynolds_text(row, "Make").upper()
    mapping = {
        "K1": "Kia",
        "KIA": "Kia",
        "MA": "Mazda",
        "MAZDA": "Mazda",
    }
    if make_code in mapping:
        return mapping[make_code]
    if make_code.startswith("K"):
        return "Kia"
    if make_code.startswith("MA"):
        return "Mazda"
    model = reynolds_text(row, "Model").lower()
    if "mazda" in model or model.startswith("cx-"):
        return "Mazda"
    if model:
        return "Kia"
    return None


def reynolds_model_make(row: Dict[str, Any], brand: str) -> str:
    model = first_nonempty(reynolds_text(row, "Model"), reynolds_text(row, "Style"))
    if not model:
        return ""
    if brand.lower() in model.lower():
        return model
    return f"{brand} {model}"


def reynolds_source_key(row: Dict[str, Any], traffic_date: str, brand: str) -> str:
    ro_appt = first_nonempty(reynolds_text(row, "RO#/Appt#"), reynolds_text(row, "Tag#"))
    customer_name = reynolds_text(row, "Customer Name")
    appointment_text = first_nonempty(reynolds_text(row, "Appt Date/Time"), reynolds_text(row, "Date/Time"))
    if ro_appt:
        return f"reynolds:{brand}:{ro_appt}:{traffic_date}"
    return f"reynolds:{brand}:{traffic_date}:{customer_name}:{appointment_text}"


def reynolds_offer_idea(row: Dict[str, Any]) -> str:
    details = [
        ("Imported", "Reynolds SERVICEAPPTS.csv"),
        ("Record type", reynolds_text(row, "Record Type")),
        ("Appointment", first_nonempty(reynolds_text(row, "Appt Date/Time"), reynolds_text(row, "Date/Time"))),
        ("Promise", reynolds_text(row, "Promise Date/Time")),
        ("Status", reynolds_text(row, "Status")),
        ("Overall status", reynolds_text(row, "Overall Status")),
        ("Advisor", reynolds_text(row, "Advisor Name")),
        ("Appointment taker", reynolds_text(row, "Appointment Taker Name")),
        ("Greeter", reynolds_text(row, "Greeter Name")),
        ("RO / Appt #", reynolds_text(row, "RO#/Appt#")),
        ("Transportation", reynolds_text(row, "Transportation Type")),
        ("Odometer", reynolds_text(row, "Odometer")),
        ("Stock #", reynolds_text(row, "Stock#")),
        ("VIN", reynolds_text(row, "VIN")),
        ("Email", reynolds_text(row, "Email")),
        ("City / State", reynolds_text(row, "City, State")),
        ("Address", reynolds_text(row, "Address")),
    ]
    lines = [f"{label}: {value}" for label, value in details if str(value or "").strip()]
    return normalize_notes("\n".join(lines), "offer_idea", max_len=4000)


def mastermind_text(row: Dict[str, Any], key: str) -> str:
    return reynolds_text(row, key)


def parse_mastermind_appointment_datetime(date_value: str, time_value: str) -> Optional[datetime]:
    date_text = str(date_value or "").strip()
    time_text = str(time_value or "").strip()
    if not date_text:
        return None

    parsed_date: Optional[datetime] = None
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %I:%M %p"):
        try:
            parsed_date = datetime.strptime(date_text, fmt)
            break
        except ValueError:
            continue
    if parsed_date is None:
        return None

    if not time_text:
        return parsed_date

    parsed_time: Optional[datetime] = None
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p"):
        try:
            parsed_time = datetime.strptime(time_text, fmt)
            break
        except ValueError:
            continue
    if parsed_time is None:
        return parsed_date
    return datetime.combine(parsed_date.date(), parsed_time.time())


def mastermind_brand(row: Dict[str, Any]) -> Optional[str]:
    dealer_id = mastermind_text(row, "Dealer Id").upper()
    if dealer_id.startswith("KI"):
        return "Kia"
    if dealer_id.startswith("MZ"):
        return "Mazda"
    if dealer_id.startswith("OB") or dealer_id.startswith("OUT"):
        return None

    make_value = first_nonempty(
        mastermind_text(row, "Current Vehicle Make"),
        mastermind_text(row, "Replacement Vehicle Make"),
    ).lower()
    mapping = {
        "kia": "Kia",
        "mazda": "Mazda",
    }
    return mapping.get(make_value)


def mastermind_customer_name(row: Dict[str, Any]) -> str:
    return " ".join(
        part
        for part in (
            mastermind_text(row, "First Name"),
            mastermind_text(row, "Last Name"),
        )
        if part
    ).strip()


def mastermind_vehicle_summary(row: Dict[str, Any], *, replacement: bool = False) -> str:
    prefix = "Replacement Vehicle" if replacement else "Current Vehicle"
    year = mastermind_text(row, f"{prefix} Year")
    make = mastermind_text(row, f"{prefix} Make")
    model = mastermind_text(row, f"{prefix} Model")
    trim = mastermind_text(row, f"{prefix} Trim")

    detail = trim or model
    if trim and model and model.lower() not in trim.lower():
        detail = f"{model} {trim}".strip()

    if detail:
        value = detail if make and make.lower() in detail.lower() else " ".join(part for part in (make, detail) if part).strip()
    else:
        value = make

    return " ".join(part for part in (year, value) if part).strip()


def mastermind_model_make(row: Dict[str, Any], brand: str) -> str:
    current_summary = mastermind_vehicle_summary(row, replacement=False)
    if current_summary:
        return current_summary
    replacement_summary = mastermind_vehicle_summary(row, replacement=True)
    if replacement_summary:
        return replacement_summary
    return brand


def mastermind_source_key(row: Dict[str, Any], traffic_date: str, brand: str) -> str:
    dealer_id = mastermind_text(row, "Dealer Id")
    closed_deal_id = mastermind_text(row, "Closed Deal Id")
    appointment_time = mastermind_text(row, "Appointment Time")
    customer_name = mastermind_customer_name(row)
    if closed_deal_id:
        return f"mastermind:{brand}:{dealer_id}:{closed_deal_id}:{traffic_date}:{appointment_time}"
    return f"mastermind:{brand}:{dealer_id}:{traffic_date}:{appointment_time}:{customer_name}"


def mastermind_offer_idea(row: Dict[str, Any]) -> str:
    current_vehicle = mastermind_vehicle_summary(row, replacement=False)
    replacement_vehicle = mastermind_vehicle_summary(row, replacement=True)
    details = [
        ("Imported", "Mastermind Service Appointments CSV"),
        ("Dealer Id", mastermind_text(row, "Dealer Id")),
        (
            "Appointment",
            " ".join(
                part
                for part in (
                    mastermind_text(row, "Appointment Date"),
                    mastermind_text(row, "Appointment Time"),
                )
                if part
            ).strip(),
        ),
        ("Assignee", mastermind_text(row, "Assignee")),
        ("Deal Status", mastermind_text(row, "Deal Status")),
        ("Customer Type", mastermind_text(row, "Customer Type")),
        ("Outreach", mastermind_text(row, "Outreach")),
        ("Current Vehicle", current_vehicle),
        ("Current Mileage", mastermind_text(row, "Current Vehicle Mileage")),
        ("Current VIN", mastermind_text(row, "Current Vehicle Vin")),
        ("Replacement Vehicle", replacement_vehicle if replacement_vehicle and replacement_vehicle != current_vehicle else ""),
        ("Email", mastermind_text(row, "Email Address")),
        ("Showroom Link", mastermind_text(row, "Showroom Link")),
    ]
    lines = [f"{label}: {value}" for label, value in details if str(value or "").strip()]
    return normalize_notes("\n".join(lines), "offer_idea", max_len=4000)


def import_reynolds_service_traffic(file: UploadFile) -> ServiceDriveTrafficImportOut:
    rows = decode_csv_upload(file)

    created = 0
    updated = 0
    skipped = 0
    imported_dates: List[str] = []
    seen_keys: set[str] = set()
    now_ts = time.time()

    with db_lock:
        conn = get_db()
        try:
            for row in rows:
                department = reynolds_text(row, "Department").upper()
                if department and department != "SERVICE":
                    skipped += 1
                    continue

                appointment_dt = parse_reynolds_datetime_text(
                    first_nonempty(reynolds_text(row, "Appt Date/Time"), reynolds_text(row, "Date/Time"))
                )
                if not appointment_dt:
                    skipped += 1
                    continue
                traffic_date = appointment_dt.strftime("%Y-%m-%d")

                brand = reynolds_brand(row)
                if not brand:
                    skipped += 1
                    continue

                customer_name_raw = reynolds_text(row, "Customer Name")
                if not customer_name_raw:
                    skipped += 1
                    continue

                source_key = reynolds_source_key(row, traffic_date, brand)
                if source_key in seen_keys:
                    skipped += 1
                    continue
                seen_keys.add(source_key)

                customer_name = normalize_name(customer_name_raw, "customer_name")
                customer_phone = normalize_short_text(
                    first_nonempty(
                        reynolds_text(row, "Cell Phone"),
                        reynolds_text(row, "Home Phone"),
                        reynolds_text(row, "Business Phone"),
                    ),
                    "customer_phone",
                    max_len=40,
                )
                appointment_label = normalize_short_text(format_clock_label(appointment_dt), "appointment_label", max_len=24)
                appointment_ts = appointment_dt.replace(tzinfo=ZoneInfo(RULES_TIMEZONE)).timestamp()
                vehicle_year = normalize_short_text(reynolds_text(row, "Year"), "vehicle_year", max_len=16)
                odometer = normalize_short_text(reynolds_text(row, "Odometer"), "odometer", max_len=32)
                model_make = normalize_short_text(reynolds_model_make(row, brand), "model_make", max_len=120)
                offer_idea = reynolds_offer_idea(row)

                existing = conn.execute(
                    "SELECT id FROM service_drive_traffic_entries WHERE source_system = ? AND source_key = ?",
                    ("reynolds_csv", source_key),
                ).fetchone()

                if existing:
                    conn.execute(
                        """
                        UPDATE service_drive_traffic_entries
                        SET traffic_date = ?, brand = ?, customer_name = ?, customer_phone = ?, appointment_label = ?,
                            appointment_ts = ?, vehicle_year = ?, odometer = ?, model_make = ?, offer_idea = ?, updated_ts = ?
                        WHERE id = ?
                        """,
                        (
                            traffic_date,
                            brand,
                            customer_name,
                            customer_phone,
                            appointment_label,
                            appointment_ts,
                            vehicle_year,
                            odometer,
                            model_make,
                            offer_idea,
                            now_ts,
                            int(existing["id"]),
                        ),
                    )
                    updated += 1
                else:
                    conn.execute(
                        """
                        INSERT INTO service_drive_traffic_entries (
                            traffic_date, brand, customer_name, customer_phone, appointment_label, appointment_ts,
                            vehicle_year, odometer, model_make, offer_idea, sales_notes, source_system, source_key,
                            created_ts, updated_ts
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            traffic_date,
                            brand,
                            customer_name,
                            customer_phone,
                            appointment_label,
                            appointment_ts,
                            vehicle_year,
                            odometer,
                            model_make,
                            offer_idea,
                            "",
                            "reynolds_csv",
                            source_key,
                            now_ts,
                            now_ts,
                        ),
                    )
                    created += 1

                if traffic_date not in imported_dates:
                    imported_dates.append(traffic_date)

            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except Exception as exc:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"failed to import reynolds csv: {exc}") from exc

    return ServiceDriveTrafficImportOut(
        total_rows=len(rows),
        created=created,
        updated=updated,
        skipped=skipped,
        dates=sorted(imported_dates),
    )


def import_mastermind_service_traffic(file: UploadFile) -> ServiceDriveTrafficImportOut:
    rows = decode_csv_upload(file)

    created = 0
    updated = 0
    skipped = 0
    imported_dates: List[str] = []
    seen_keys: set[str] = set()
    now_ts = time.time()

    with db_lock:
        conn = get_db()
        try:
            for row in rows:
                appointment_dt = parse_mastermind_appointment_datetime(
                    mastermind_text(row, "Appointment Date"),
                    mastermind_text(row, "Appointment Time"),
                )
                if not appointment_dt:
                    skipped += 1
                    continue
                traffic_date = appointment_dt.strftime("%Y-%m-%d")

                brand = mastermind_brand(row)
                if not brand:
                    skipped += 1
                    continue

                customer_name_raw = mastermind_customer_name(row)
                if not customer_name_raw:
                    skipped += 1
                    continue

                source_key = mastermind_source_key(row, traffic_date, brand)
                if source_key in seen_keys:
                    skipped += 1
                    continue
                seen_keys.add(source_key)

                appointment_time_text = mastermind_text(row, "Appointment Time")
                customer_name = normalize_name(customer_name_raw, "customer_name")
                customer_phone = normalize_short_text(
                    first_nonempty(
                        mastermind_text(row, "Mobile Phone"),
                        mastermind_text(row, "Home Phone"),
                        mastermind_text(row, "Work Phone"),
                    ),
                    "customer_phone",
                    max_len=40,
                )
                appointment_label = normalize_short_text(
                    format_clock_label(appointment_dt) if appointment_time_text else "",
                    "appointment_label",
                    max_len=24,
                )
                appointment_ts = (
                    appointment_dt.replace(tzinfo=ZoneInfo(RULES_TIMEZONE)).timestamp() if appointment_time_text else 0
                )
                vehicle_year = normalize_short_text(
                    first_nonempty(
                        mastermind_text(row, "Current Vehicle Year"),
                        mastermind_text(row, "Replacement Vehicle Year"),
                    ),
                    "vehicle_year",
                    max_len=16,
                )
                odometer = normalize_short_text(mastermind_text(row, "Current Vehicle Mileage"), "odometer", max_len=32)
                model_make = normalize_short_text(mastermind_model_make(row, brand), "model_make", max_len=120)
                offer_idea = mastermind_offer_idea(row)

                existing = conn.execute(
                    "SELECT id FROM service_drive_traffic_entries WHERE source_system = ? AND source_key = ?",
                    ("mastermind_csv", source_key),
                ).fetchone()

                if existing:
                    conn.execute(
                        """
                        UPDATE service_drive_traffic_entries
                        SET traffic_date = ?, brand = ?, customer_name = ?, customer_phone = ?, appointment_label = ?,
                            appointment_ts = ?, vehicle_year = ?, odometer = ?, model_make = ?, offer_idea = ?, updated_ts = ?
                        WHERE id = ?
                        """,
                        (
                            traffic_date,
                            brand,
                            customer_name,
                            customer_phone,
                            appointment_label,
                            appointment_ts,
                            vehicle_year,
                            odometer,
                            model_make,
                            offer_idea,
                            now_ts,
                            int(existing["id"]),
                        ),
                    )
                    updated += 1
                else:
                    conn.execute(
                        """
                        INSERT INTO service_drive_traffic_entries (
                            traffic_date, brand, customer_name, customer_phone, appointment_label, appointment_ts,
                            vehicle_year, odometer, model_make, offer_idea, sales_notes, source_system, source_key,
                            created_ts, updated_ts
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            traffic_date,
                            brand,
                            customer_name,
                            customer_phone,
                            appointment_label,
                            appointment_ts,
                            vehicle_year,
                            odometer,
                            model_make,
                            offer_idea,
                            "",
                            "mastermind_csv",
                            source_key,
                            now_ts,
                            now_ts,
                        ),
                    )
                    created += 1

                if traffic_date not in imported_dates:
                    imported_dates.append(traffic_date)

            conn.commit()
        except HTTPException:
            conn.rollback()
            raise
        except Exception as exc:
            conn.rollback()
            raise HTTPException(status_code=400, detail=f"failed to import mastermind csv: {exc}") from exc

    return ServiceDriveTrafficImportOut(
        total_rows=len(rows),
        created=created,
        updated=updated,
        skipped=skipped,
        dates=sorted(imported_dates),
    )


def undo_service_drive_traffic_import(source_system: str) -> ServiceDriveTrafficImportUndoOut:
    preserved_row = db_query_one(
        """
        SELECT COUNT(*) AS count
        FROM service_drive_traffic_entries
        WHERE source_system = ?
          AND (TRIM(sales_notes) <> '' OR TRIM(sales_note_salesperson_name) <> '')
        """,
        (source_system,),
    ) or {}
    deleted_row = db_query_one(
        """
        SELECT COUNT(*) AS count
        FROM service_drive_traffic_entries
        WHERE source_system = ?
          AND TRIM(sales_notes) = ''
          AND TRIM(sales_note_salesperson_name) = ''
        """,
        (source_system,),
    ) or {}
    deleted = int(deleted_row.get("count") or 0)
    preserved_with_notes = int(preserved_row.get("count") or 0)
    if deleted:
        db_execute(
            """
            DELETE FROM service_drive_traffic_entries
            WHERE source_system = ?
              AND TRIM(sales_notes) = ''
              AND TRIM(sales_note_salesperson_name) = ''
            """,
            (source_system,),
        )
    return ServiceDriveTrafficImportUndoOut(deleted=deleted, preserved_with_notes=preserved_with_notes)


def undo_reynolds_service_traffic_import() -> ServiceDriveTrafficImportUndoOut:
    return undo_service_drive_traffic_import("reynolds_csv")


def undo_mastermind_service_traffic_import() -> ServiceDriveTrafficImportUndoOut:
    return undo_service_drive_traffic_import("mastermind_csv")


def clear_service_drive_traffic_day(traffic_date: str) -> ServiceDriveTrafficDayClearOut:
    resolved_date = parse_iso_date(traffic_date, "traffic_date").isoformat()
    traffic_rows = db_query_all(
        """
        SELECT id
        FROM service_drive_traffic_entries
        WHERE traffic_date = ?
        ORDER BY id ASC
        """,
        (resolved_date,),
    )
    traffic_ids = [int(row.get("id") or 0) for row in traffic_rows if row.get("id")]
    if not traffic_ids:
        return ServiceDriveTrafficDayClearOut(traffic_date=resolved_date, deleted=0, deleted_images=0)

    placeholders = ",".join("?" for _ in traffic_ids)
    image_rows = db_query_all(
        f"""
        SELECT stored_filename
        FROM service_drive_traffic_images
        WHERE traffic_entry_id IN ({placeholders})
        ORDER BY id ASC
        """,
        tuple(traffic_ids),
    )
    for row in image_rows:
        remove_uploaded_file(TRAFFIC_OFFER_ROOT, row.get("stored_filename"))

    db_execute(
        f"DELETE FROM service_drive_traffic_images WHERE traffic_entry_id IN ({placeholders})",
        tuple(traffic_ids),
    )
    db_execute("DELETE FROM service_drive_traffic_entries WHERE traffic_date = ?", (resolved_date,))
    return ServiceDriveTrafficDayClearOut(
        traffic_date=resolved_date,
        deleted=len(traffic_ids),
        deleted_images=len(image_rows),
    )


def create_service_drive_traffic_entry(payload: ServiceDriveTrafficIn) -> ServiceDriveTrafficOut:
    traffic_date = parse_iso_date(payload.traffic_date, "traffic_date").isoformat()
    brand = normalize_brand(payload.brand)
    customer_name = normalize_name(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    vehicle_year = normalize_short_text(payload.vehicle_year, "vehicle_year", max_len=16)
    model_make = normalize_short_text(payload.model_make, "model_make", max_len=120)
    offer_idea = normalize_notes(payload.offer_idea, "offer_idea", max_len=1000)
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO service_drive_traffic_entries (
            traffic_date, brand, customer_name, customer_phone, vehicle_year, model_make, offer_idea, sales_notes, created_ts, updated_ts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (traffic_date, brand, customer_name, customer_phone, vehicle_year, model_make, offer_idea, "", now_ts, now_ts),
    )
    row = get_service_drive_traffic_row(created_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to create service drive traffic entry")
    return service_drive_traffic_out(
        row,
        fetch_drive_team_map([traffic_date]),
        fetch_traffic_offer_image_map([created_id]),
    )


def update_service_drive_traffic_entry(traffic_id: int, payload: ServiceDriveTrafficIn) -> ServiceDriveTrafficOut:
    existing = get_service_drive_traffic_row(traffic_id)
    if not existing:
        raise HTTPException(status_code=404, detail="service drive traffic entry not found")
    traffic_date = parse_iso_date(payload.traffic_date, "traffic_date").isoformat()
    brand = normalize_brand(payload.brand)
    customer_name = normalize_name(payload.customer_name, "customer_name")
    customer_phone = normalize_short_text(payload.customer_phone, "customer_phone", max_len=40)
    vehicle_year = normalize_short_text(payload.vehicle_year, "vehicle_year", max_len=16)
    model_make = normalize_short_text(payload.model_make, "model_make", max_len=120)
    offer_idea = normalize_notes(payload.offer_idea, "offer_idea", max_len=1000)
    db_execute(
        """
        UPDATE service_drive_traffic_entries
        SET traffic_date = ?, brand = ?, customer_name = ?, customer_phone = ?, vehicle_year = ?, model_make = ?, offer_idea = ?, updated_ts = ?
        WHERE id = ?
        """,
        (traffic_date, brand, customer_name, customer_phone, vehicle_year, model_make, offer_idea, time.time(), traffic_id),
    )
    row = get_service_drive_traffic_row(traffic_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update service drive traffic entry")
    return service_drive_traffic_out(
        row,
        fetch_drive_team_map([traffic_date]),
        fetch_traffic_offer_image_map([traffic_id]),
    )


def update_service_drive_traffic_sales_note(traffic_id: int, payload: ServiceDriveTrafficSalesNoteIn) -> ServiceDriveTrafficOut:
    row = get_service_drive_traffic_row(traffic_id)
    if not row:
        raise HTTPException(status_code=404, detail="service drive traffic entry not found")
    salesperson_id: Optional[int] = None
    salesperson_name = ""
    if payload.salesperson_id is not None:
        salesperson_row = get_salesperson_row(int(payload.salesperson_id))
        if not salesperson_row:
            raise HTTPException(status_code=404, detail="salesperson not found")
        salesperson_id = int(payload.salesperson_id)
        salesperson_name = str(salesperson_row.get("name") or "")

    traffic_date = str(row.get("traffic_date") or "")
    team = fetch_drive_team_map([traffic_date]).get(traffic_date, [])
    sales_notes = normalize_notes(payload.sales_notes, "sales_notes")
    db_execute(
        """
        UPDATE service_drive_traffic_entries
        SET sales_notes = ?, sales_note_salesperson_id = ?, sales_note_salesperson_name = ?, updated_ts = ?
        WHERE id = ?
        """,
        (
            sales_notes,
            salesperson_id,
            salesperson_name,
            time.time(),
            traffic_id,
        ),
    )
    saved = get_service_drive_traffic_row(traffic_id)
    if not saved:
        raise HTTPException(status_code=500, detail="failed to update traffic notes")
    return service_drive_traffic_out(
        saved,
        {traffic_date: team},
        fetch_traffic_offer_image_map([traffic_id]),
    )


def add_service_drive_traffic_images(traffic_id: int, uploads: List[UploadFile]) -> ServiceDriveTrafficOut:
    row = get_service_drive_traffic_row(traffic_id)
    if not row:
        raise HTTPException(status_code=404, detail="service drive traffic entry not found")
    files = [upload for upload in uploads if str(upload.filename or "").strip()]
    if not files:
        raise HTTPException(status_code=400, detail="at least one image file is required")
    now_ts = time.time()
    for upload in files:
        original_filename, stored_name, image_url = save_upload_file(
            upload,
            folder_path=TRAFFIC_OFFER_ROOT,
            folder_name="traffic-offers",
            allowed_exts={".png", ".jpg", ".jpeg", ".webp", ".gif"},
            max_bytes=12 * 1024 * 1024,
        )
        db_insert(
            """
            INSERT INTO service_drive_traffic_images (
                traffic_entry_id, original_filename, stored_filename, image_url, created_ts
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (traffic_id, original_filename, stored_name, image_url, now_ts),
        )
        now_ts += 0.001
    saved = get_service_drive_traffic_row(traffic_id)
    if not saved:
        raise HTTPException(status_code=500, detail="failed to refresh service drive traffic entry")
    traffic_date = str(saved.get("traffic_date") or "")
    return service_drive_traffic_out(
        saved,
        fetch_drive_team_map([traffic_date]),
        fetch_traffic_offer_image_map([traffic_id]),
    )


def fetch_traffic_pdfs() -> TrafficPdfListOut:
    rows = db_query_all("SELECT * FROM traffic_pdfs ORDER BY created_ts DESC, id DESC")
    return TrafficPdfListOut(entries=[traffic_pdf_out(row) for row in rows])


def create_traffic_pdf(title: str, upload: UploadFile) -> TrafficPdfOut:
    original_filename, stored_name, file_url = save_upload_file(
        upload,
        folder_path=TRAFFIC_PDF_ROOT,
        folder_name="traffic-pdfs",
        allowed_exts={".pdf"},
        max_bytes=25 * 1024 * 1024,
    )
    resolved_title = normalize_short_text(title or os.path.splitext(original_filename)[0], "title", max_len=120)
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO traffic_pdfs (title, original_filename, stored_filename, file_url, created_ts)
        VALUES (?, ?, ?, ?, ?)
        """,
        (resolved_title, original_filename, stored_name, file_url, now_ts),
    )
    row = db_query_one("SELECT * FROM traffic_pdfs WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to save traffic pdf")
    return traffic_pdf_out(row)


def fetch_vehicle_special_sections() -> List[VehicleSpecialSectionOut]:
    config = get_specials_config()
    rows = db_query_all("SELECT * FROM special_feed_entries ORDER BY source_key ASC, score DESC, id DESC")
    grouped: Dict[str, List[VehicleSpecialEntryOut]] = {}
    imported_at_map: Dict[str, float] = {}
    for row in rows:
        item = vehicle_special_entry_out(row)
        grouped.setdefault(item.source_key, []).append(item)
        imported_at_map[item.source_key] = max(imported_at_map.get(item.source_key, 0.0), item.imported_ts)

    config_map = {
        "kia_new": config.kia_new_url,
        "mazda_new": config.mazda_new_url,
        "used_srp": config.used_srp_url,
    }
    sections: List[VehicleSpecialSectionOut] = []
    for source_key, definition in SPECIALS_SOURCE_DEFINITIONS.items():
        entries = grouped.get(source_key, [])
        if source_key == "used_srp" and entries:
            entries = sorted(entries, key=lambda item: (-float(item.score or 0.0), -float(item.imported_ts or 0.0), -item.id))[:8]
        elif entries:
            entries = entries[:8]
        sections.append(
            VehicleSpecialSectionOut(
                key=source_key,
                label=definition["label"],
                source_url=config_map.get(source_key) or definition.get("default_url", ""),
                category=definition["category"],
                imported_ts=float(imported_at_map.get(source_key, 0.0)),
                entries=entries,
            )
        )
    return sections


def fetch_specials() -> SpecialsListOut:
    rows = db_query_all("SELECT * FROM specials ORDER BY created_ts DESC, id DESC")
    return SpecialsListOut(
        entries=[special_out(row) for row in rows],
        vehicle_sections=fetch_vehicle_special_sections(),
        config=get_specials_config(),
    )


def import_vehicle_special_feed(payload: VehicleSpecialImportIn) -> SpecialsListOut:
    source_key = normalize_special_source_key(payload.source_key)
    source_definition = specials_source_definition(source_key)
    config = get_specials_config()
    config_url_map = {
        "kia_new": config.kia_new_url,
        "mazda_new": config.mazda_new_url,
        "used_srp": config.used_srp_url,
    }
    resolved_source_url = (
        normalize_optional_url(payload.source_url, "source_url")
        if str(payload.source_url or "").strip()
        else str(config_url_map.get(source_key) or source_definition.get("default_url") or "")
    )

    now_ts = time.time()
    dedupe_keys: set[Tuple[str, str, str, str]] = set()
    normalized_rows: List[Tuple[Any, ...]] = []
    for item in payload.entries:
        raw_title = str(item.title or "").strip()
        raw_link = str(item.link_url or "").strip()
        if not raw_title and not raw_link:
            continue
        title = normalize_short_text(raw_title or raw_link, "title", max_len=180)
        badge = normalize_short_text(item.badge or source_definition["label"], "badge", max_len=80)
        subtitle = normalize_short_text(item.subtitle or "", "subtitle", max_len=220)
        price_text = normalize_short_text(item.price_text or "", "price_text", max_len=80)
        payment_text = normalize_short_text(item.payment_text or "", "payment_text", max_len=120)
        mileage_text = normalize_short_text(item.mileage_text or "", "mileage_text", max_len=80)
        note = normalize_short_text(item.note or "", "note", max_len=260)
        image_url = normalize_optional_url(item.image_url, "image_url") if str(item.image_url or "").strip() else ""
        link_url = normalize_optional_url(item.link_url, "link_url") if str(item.link_url or "").strip() else ""
        score = float(item.score or 0.0)
        score_label = normalize_short_text(item.score_label or "", "score_label", max_len=80)
        if source_key == "used_srp":
            auto_score, auto_label = score_used_special_candidate(title, price_text, mileage_text)
            score = auto_score
            score_label = auto_label
        dedupe_key = (title.lower(), link_url.lower(), price_text.lower(), mileage_text.lower())
        if dedupe_key in dedupe_keys:
            continue
        dedupe_keys.add(dedupe_key)
        normalized_rows.append(
            (
                source_key,
                source_definition["label"],
                resolved_source_url,
                badge,
                title,
                subtitle,
                price_text,
                payment_text,
                mileage_text,
                note,
                score,
                score_label,
                image_url,
                link_url,
                now_ts,
            )
        )

    db_execute("DELETE FROM special_feed_entries WHERE source_key = ?", (source_key,))
    for row in normalized_rows[:24]:
        db_insert(
            """
            INSERT INTO special_feed_entries (
                source_key,
                source_label,
                source_url,
                badge,
                title,
                subtitle,
                price_text,
                payment_text,
                mileage_text,
                note,
                score,
                score_label,
                image_url,
                link_url,
                imported_ts
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            row,
        )
    return fetch_specials()


def create_special(title: str, tag: str, upload: UploadFile) -> SpecialOut:
    original_filename, stored_name, image_url = save_upload_file(
        upload,
        folder_path=SPECIALS_ROOT,
        folder_name="specials",
        allowed_exts={".png", ".jpg", ".jpeg", ".webp"},
        max_bytes=12 * 1024 * 1024,
    )
    resolved_title = normalize_short_text(title or os.path.splitext(original_filename)[0], "title", max_len=120)
    resolved_tag = normalize_short_text(tag or resolved_title, "tag", max_len=80)
    now_ts = time.time()
    created_id = db_insert(
        """
        INSERT INTO specials (title, tag, original_filename, stored_filename, image_url, created_ts)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (resolved_title, resolved_tag, original_filename, stored_name, image_url, now_ts),
    )
    row = db_query_one("SELECT * FROM specials WHERE id = ?", (created_id,))
    if not row:
        raise HTTPException(status_code=500, detail="failed to save special")
    return special_out(row)


def get_special_row(special_id: int) -> Optional[Dict[str, Any]]:
    return db_query_one("SELECT * FROM specials WHERE id = ?", (int(special_id),))


def remove_uploaded_file(folder_path: str, stored_filename: Optional[str]) -> None:
    if not stored_filename:
        return
    try:
        os.remove(os.path.join(folder_path, stored_filename))
    except OSError:
        pass


def update_special(special_id: int, title: str, tag: str, upload: Optional[UploadFile]) -> SpecialOut:
    existing = get_special_row(special_id)
    if not existing:
        raise HTTPException(status_code=404, detail="special not found")

    resolved_title = normalize_short_text(title or existing.get("title") or "", "title", max_len=120)
    resolved_tag = normalize_short_text(tag or existing.get("tag") or resolved_title, "tag", max_len=80)
    original_filename = str(existing.get("original_filename") or "")
    stored_filename = str(existing.get("stored_filename") or "")
    image_url = str(existing.get("image_url") or "")

    if upload and str(upload.filename or "").strip():
        original_filename, stored_filename, image_url = save_upload_file(
            upload,
            folder_path=SPECIALS_ROOT,
            folder_name="specials",
            allowed_exts={".png", ".jpg", ".jpeg", ".webp"},
            max_bytes=12 * 1024 * 1024,
        )
        remove_uploaded_file(SPECIALS_ROOT, existing.get("stored_filename"))
    elif upload:
        upload.file.close()

    db_execute(
        """
        UPDATE specials
        SET title = ?, tag = ?, original_filename = ?, stored_filename = ?, image_url = ?
        WHERE id = ?
        """,
        (resolved_title, resolved_tag, original_filename, stored_filename, image_url, int(special_id)),
    )
    row = get_special_row(special_id)
    if not row:
        raise HTTPException(status_code=500, detail="failed to update special")
    return special_out(row)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/admin/login", response_model=AdminSessionOut)
def admin_login(payload: AdminLoginIn) -> AdminSessionOut:
    if not admin_credentials_configured():
        raise HTTPException(
            status_code=503,
            detail="admin credentials are not configured on the server",
        )
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


@app.get("/api/admin/agent-loops/config", response_model=AgentLoopConfigOut)
def get_admin_agent_loops_config(x_admin_token: Optional[str] = Header(default=None)) -> AgentLoopConfigOut:
    require_admin(x_admin_token)
    return get_agent_loop_config()


@app.get("/api/admin/agent-loops/runs", response_model=AgentLoopRunListOut)
def get_admin_agent_loop_runs(
    limit: int = 20,
    x_admin_token: Optional[str] = Header(default=None),
) -> AgentLoopRunListOut:
    require_admin(x_admin_token)
    return fetch_agent_loop_runs(limit=limit)


@app.get("/api/admin/agent-loops/runs/{run_id}", response_model=AgentLoopRunDetailOut)
def get_admin_agent_loop_run(
    run_id: int,
    x_admin_token: Optional[str] = Header(default=None),
) -> AgentLoopRunDetailOut:
    require_admin(x_admin_token)
    return fetch_agent_loop_detail(run_id)


@app.post("/api/admin/agent-loops/runs", response_model=AgentLoopRunDetailOut)
def post_admin_agent_loop_run(
    payload: AgentLoopRunIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> AgentLoopRunDetailOut:
    require_admin(x_admin_token)
    return create_agent_loop_run(payload)


@app.post("/api/admin/agent-loops/runs/{run_id}/cancel", response_model=AgentLoopRunDetailOut)
def post_admin_agent_loop_cancel(
    run_id: int,
    x_admin_token: Optional[str] = Header(default=None),
) -> AgentLoopRunDetailOut:
    require_admin(x_admin_token)
    return cancel_agent_loop_run(run_id)


@app.get("/api/salespeople", response_model=List[SalespersonOut])
def get_salespeople(include_inactive: bool = False) -> List[SalespersonOut]:
    return fetch_salespeople(include_inactive=include_inactive)


@app.get("/api/admin/salespeople", response_model=List[SalespersonAdminOut])
def get_admin_salespeople(
    include_inactive: bool = False,
    x_admin_token: Optional[str] = Header(default=None),
) -> List[SalespersonAdminOut]:
    require_admin(x_admin_token)
    return fetch_salespeople_admin(include_inactive=include_inactive)


@app.get("/api/admin/notifications/config", response_model=NotificationConfigOut)
def get_admin_notification_config(x_admin_token: Optional[str] = Header(default=None)) -> NotificationConfigOut:
    require_admin(x_admin_token)
    return get_notification_config()


@app.post("/api/admin/notifications/test-sms", response_model=NotificationTestSmsOut)
def post_admin_notification_test_sms(
    payload: NotificationTestSmsIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> NotificationTestSmsOut:
    require_admin(x_admin_token)
    return send_notification_test_sms(payload.phone_number)


@app.post("/api/admin/notifications/test-email", response_model=NotificationTestEmailOut)
def post_admin_notification_test_email(
    payload: NotificationTestEmailIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> NotificationTestEmailOut:
    require_admin(x_admin_token)
    return send_notification_test_email(payload.email)


@app.post("/api/admin/salespeople", response_model=SalespersonAdminOut)
def post_salesperson(payload: SalespersonIn, x_admin_token: Optional[str] = Header(default=None)) -> SalespersonAdminOut:
    require_admin(x_admin_token)
    return create_salesperson(payload)


@app.put("/api/admin/salespeople/{salesperson_id}", response_model=SalespersonAdminOut)
def put_salesperson(
    salesperson_id: int,
    payload: SalespersonIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> SalespersonAdminOut:
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


@app.put("/api/admin/days-off/bulk", response_model=DaysOffMonthOut)
def put_admin_days_off_bulk(
    payload: DaysOffMonthBulkIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> DaysOffMonthOut:
    require_admin(x_admin_token)
    return replace_days_off_month(payload)


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


@app.get("/api/service-drive/traffic", response_model=ServiceDriveTrafficListOut)
def get_service_drive_traffic(
    month: Optional[str] = None,
    traffic_date: Optional[str] = None,
) -> ServiceDriveTrafficListOut:
    return fetch_service_drive_traffic(month_key=month, traffic_date=traffic_date)


@app.get("/api/traffic/pdfs", response_model=TrafficPdfListOut)
def get_traffic_pdfs() -> TrafficPdfListOut:
    return fetch_traffic_pdfs()


@app.get("/api/specials", response_model=SpecialsListOut)
def get_specials() -> SpecialsListOut:
    return fetch_specials()


@app.post("/api/admin/specials/config", response_model=SpecialsConfigOut)
def post_specials_config(payload: SpecialsConfigIn, x_admin_token: Optional[str] = Header(default=None)) -> SpecialsConfigOut:
    require_admin(x_admin_token)
    return save_specials_config(payload)


@app.post("/api/admin/specials/import-feed", response_model=SpecialsListOut)
def post_specials_import_feed(
    payload: VehicleSpecialImportIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> SpecialsListOut:
    require_admin(x_admin_token)
    return import_vehicle_special_feed(payload)


@app.post("/api/admin/specials/import-source/{source_key}", response_model=SpecialsListOut)
def post_specials_import_source(
    source_key: str,
    x_admin_token: Optional[str] = Header(default=None),
) -> SpecialsListOut:
    require_admin(x_admin_token)
    return import_auto_vehicle_special_source(source_key)


@app.get("/api/quote/rates", response_model=QuoteRateListOut)
def get_quote_rates() -> QuoteRateListOut:
    return QuoteRateListOut(entries=fetch_quote_rates())


@app.get("/api/marketplace/template", response_model=MarketplaceTemplateOut)
def get_marketplace_template() -> MarketplaceTemplateOut:
    return fetch_marketplace_template()


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


@app.post("/api/admin/service-drive/traffic", response_model=ServiceDriveTrafficOut)
def post_service_drive_traffic(
    payload: ServiceDriveTrafficIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficOut:
    require_admin(x_admin_token)
    return create_service_drive_traffic_entry(payload)


@app.put("/api/admin/service-drive/traffic/{traffic_id}", response_model=ServiceDriveTrafficOut)
def put_service_drive_traffic(
    traffic_id: int,
    payload: ServiceDriveTrafficIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficOut:
    require_admin(x_admin_token)
    return update_service_drive_traffic_entry(traffic_id, payload)


@app.delete("/api/admin/service-drive/traffic/day/{traffic_date}", response_model=ServiceDriveTrafficDayClearOut)
def delete_service_drive_traffic_day(
    traffic_date: str,
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficDayClearOut:
    require_admin(x_admin_token)
    return clear_service_drive_traffic_day(traffic_date)


@app.post("/api/admin/service-drive/traffic/import/reynolds", response_model=ServiceDriveTrafficImportOut)
def post_service_drive_traffic_reynolds_import(
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficImportOut:
    require_admin(x_admin_token)
    return import_reynolds_service_traffic(file)


@app.delete("/api/admin/service-drive/traffic/import/reynolds", response_model=ServiceDriveTrafficImportUndoOut)
def delete_service_drive_traffic_reynolds_import(
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficImportUndoOut:
    require_admin(x_admin_token)
    return undo_reynolds_service_traffic_import()


@app.post("/api/admin/service-drive/traffic/import/mastermind", response_model=ServiceDriveTrafficImportOut)
def post_service_drive_traffic_mastermind_import(
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficImportOut:
    require_admin(x_admin_token)
    return import_mastermind_service_traffic(file)


@app.delete("/api/admin/service-drive/traffic/import/mastermind", response_model=ServiceDriveTrafficImportUndoOut)
def delete_service_drive_traffic_mastermind_import(
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficImportUndoOut:
    require_admin(x_admin_token)
    return undo_mastermind_service_traffic_import()


@app.post("/api/admin/quote/rates", response_model=QuoteRateListOut)
def post_quote_rates(
    payload: QuoteRatesIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> QuoteRateListOut:
    require_admin(x_admin_token)
    upsert_quote_rates(payload.rates)
    return QuoteRateListOut(entries=fetch_quote_rates())


@app.post("/api/admin/marketplace/template", response_model=MarketplaceTemplateOut)
def post_marketplace_template(
    payload: MarketplaceTemplateIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> MarketplaceTemplateOut:
    require_admin(x_admin_token)
    return update_marketplace_template(payload)


@app.post("/api/admin/freshup/links", response_model=FreshUpLinksConfigOut)
def post_freshup_links(
    payload: FreshUpLinksConfigIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> FreshUpLinksConfigOut:
    require_admin(x_admin_token)
    return update_freshup_links_config(payload)


@app.post("/api/admin/service-drive/traffic/{traffic_id}/images", response_model=ServiceDriveTrafficOut)
def post_service_drive_traffic_images(
    traffic_id: int,
    files: List[UploadFile] = File(...),
    x_admin_token: Optional[str] = Header(default=None),
) -> ServiceDriveTrafficOut:
    require_admin(x_admin_token)
    return add_service_drive_traffic_images(traffic_id, files)


@app.post("/api/admin/traffic/pdfs", response_model=TrafficPdfOut)
def post_traffic_pdf(
    title: str = Form(default=""),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(default=None),
) -> TrafficPdfOut:
    require_admin(x_admin_token)
    return create_traffic_pdf(title, file)


@app.post("/api/admin/specials", response_model=SpecialOut)
def post_special(
    title: str = Form(default=""),
    tag: str = Form(default=""),
    file: UploadFile = File(...),
    x_admin_token: Optional[str] = Header(default=None),
) -> SpecialOut:
    require_admin(x_admin_token)
    return create_special(title, tag, file)


@app.put("/api/admin/specials/{special_id}", response_model=SpecialOut)
def put_special(
    special_id: int,
    title: str = Form(default=""),
    tag: str = Form(default=""),
    file: Optional[UploadFile] = File(default=None),
    x_admin_token: Optional[str] = Header(default=None),
) -> SpecialOut:
    require_admin(x_admin_token)
    return update_special(special_id, title, tag, file)


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


@app.put("/api/service-drive/traffic/{traffic_id}/sales", response_model=ServiceDriveTrafficOut)
def put_service_drive_traffic_sales(
    traffic_id: int,
    payload: ServiceDriveTrafficSalesNoteIn,
) -> ServiceDriveTrafficOut:
    return update_service_drive_traffic_sales_note(traffic_id, payload)


@app.get("/api/bdc/state", response_model=BdcStateOut)
def get_bdc_state(dealership: Optional[str] = None) -> BdcStateOut:
    return build_bdc_state(dealership)


@app.get("/api/bdc/distribution", response_model=BdcDistributionOut)
def get_bdc_distribution() -> BdcDistributionOut:
    return BdcDistributionOut(mode=get_bdc_distribution_mode())


@app.get("/api/bdc/undo/settings", response_model=BdcUndoSettingsOut)
def get_bdc_undo_settings_public() -> BdcUndoSettingsOut:
    return get_bdc_undo_settings()


@app.get("/api/tabs/visibility", response_model=TabVisibilityOut)
def get_tabs_visibility_public() -> TabVisibilityOut:
    return get_tab_visibility()


@app.get("/api/freshup/log", response_model=FreshUpLogListOut)
def get_freshup_log(salesperson_id: Optional[int] = None, limit: int = 100) -> FreshUpLogListOut:
    return fetch_freshup_log(salesperson_id=salesperson_id, limit=limit)


@app.get("/api/freshup/links", response_model=FreshUpLinksConfigOut)
def get_freshup_links() -> FreshUpLinksConfigOut:
    return fetch_freshup_links_config()


@app.get("/api/admin/freshup/analytics", response_model=FreshUpAnalyticsSummaryOut)
def get_admin_freshup_analytics(
    days: int = 30,
    salesperson_id: Optional[int] = None,
    x_admin_token: Optional[str] = Header(default=None),
) -> FreshUpAnalyticsSummaryOut:
    require_admin(x_admin_token)
    return fetch_freshup_analytics(days=days, salesperson_id=salesperson_id)


@app.post("/api/freshup/analytics", response_model=FreshUpAnalyticsAck)
def post_freshup_analytics(payload: FreshUpAnalyticsEventIn) -> FreshUpAnalyticsAck:
    create_freshup_analytics_event(payload)
    return FreshUpAnalyticsAck(ok=True)


@app.post("/api/freshup/log", response_model=FreshUpLogOut)
def post_freshup_log(payload: FreshUpLogCreateIn) -> FreshUpLogOut:
    return create_freshup_log(payload)


@app.post("/api/bdc/assign", response_model=BdcAssignmentOut)
def post_bdc_assign(payload: BdcLeadAssignIn) -> BdcAssignmentOut:
    return assign_next_lead(payload)


@app.get("/api/bdc/log", response_model=BdcLogOut)
def get_bdc_log(
    salesperson_id: Optional[int] = None,
    lead_store: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 200,
) -> BdcLogOut:
    return fetch_bdc_log(
        salesperson_id=salesperson_id,
        lead_store=lead_store,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@app.get("/api/bdc/report", response_model=BdcReportOut)
def get_bdc_report(
    salesperson_id: Optional[int] = None,
    lead_store: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BdcReportOut:
    return fetch_bdc_report(
        salesperson_id=salesperson_id,
        lead_store=lead_store,
        start_date=start_date,
        end_date=end_date,
    )


@app.get("/api/bdc-sales-tracker", response_model=BdcSalesTrackerOut)
def get_bdc_sales_tracker_public(month: str) -> BdcSalesTrackerOut:
    return fetch_bdc_sales_tracker(month)


@app.post("/api/bdc-sales-tracker/month", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_month(
    payload: BdcSalesTrackerMonthIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> BdcSalesTrackerOut:
    require_admin(x_admin_token)
    return upsert_bdc_sales_tracker_month(payload)


@app.post("/api/bdc-sales-tracker/rules", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_rules(
    payload: BdcSalesTrackerBenchmarksIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> BdcSalesTrackerOut:
    require_admin(x_admin_token)
    return upsert_bdc_sales_tracker_benchmarks(payload)


@app.post("/api/bdc-sales-tracker/agents/{agent_id}/metrics", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_agent_metrics(
    agent_id: int,
    payload: BdcSalesTrackerAgentMetricsIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> BdcSalesTrackerOut:
    require_admin(x_admin_token)
    return update_bdc_sales_tracker_agent_metrics(agent_id, payload)


@app.post("/api/bdc-sales-tracker/entries", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_entry(payload: BdcSalesTrackerEntryIn) -> BdcSalesTrackerOut:
    return create_bdc_sales_tracker_entry(payload)


@app.put("/api/bdc-sales-tracker/entries/{entry_id}", response_model=BdcSalesTrackerOut)
def put_bdc_sales_tracker_entry(
    entry_id: int,
    payload: BdcSalesTrackerEntryUpdateIn,
) -> BdcSalesTrackerOut:
    return update_bdc_sales_tracker_entry(entry_id, payload)


@app.delete("/api/bdc-sales-tracker/entries/{entry_id}", response_model=BdcSalesTrackerOut)
def delete_bdc_sales_tracker_entry_route(entry_id: int) -> BdcSalesTrackerOut:
    return delete_bdc_sales_tracker_entry(entry_id)


@app.post("/api/bdc-sales-tracker/dms-log", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_dms_log_entry(payload: BdcSalesTrackerDmsLogEntryIn) -> BdcSalesTrackerOut:
    return create_bdc_sales_tracker_dms_log_entry(payload)


@app.put("/api/bdc-sales-tracker/dms-log/{entry_id}", response_model=BdcSalesTrackerOut)
def put_bdc_sales_tracker_dms_log_entry(
    entry_id: int,
    payload: BdcSalesTrackerDmsLogEntryUpdateIn,
) -> BdcSalesTrackerOut:
    return update_bdc_sales_tracker_dms_log_entry(entry_id, payload)


@app.delete("/api/bdc-sales-tracker/dms-log/{entry_id}", response_model=BdcSalesTrackerOut)
def delete_bdc_sales_tracker_dms_log_entry_route(entry_id: int) -> BdcSalesTrackerOut:
    return delete_bdc_sales_tracker_dms_log_entry(entry_id)


@app.post("/api/bdc-sales-tracker/focus-note", response_model=BdcSalesTrackerOut)
def post_bdc_sales_tracker_focus_note(payload: BdcSalesTrackerFocusNoteIn) -> BdcSalesTrackerOut:
    return upsert_bdc_sales_tracker_focus_note(payload)


@app.delete("/api/admin/bdc/history", response_model=BdcHistoryClearOut)
def delete_bdc_history(x_admin_token: Optional[str] = Header(default=None)) -> BdcHistoryClearOut:
    require_admin(x_admin_token)
    return clear_bdc_history()


@app.delete("/api/admin/bdc/assign/last", response_model=BdcUndoOut)
def delete_last_bdc_assign(x_admin_token: Optional[str] = Header(default=None)) -> BdcUndoOut:
    require_admin(x_admin_token)
    return undo_last_bdc_assignment()


@app.delete("/api/bdc/assign/last", response_model=BdcUndoOut)
def delete_last_bdc_assign_public(payload: BdcUndoRequest) -> BdcUndoOut:
    ensure_bdc_undo_authorized(payload.password)
    return undo_last_bdc_assignment()


@app.post("/api/admin/bdc/undo/settings", response_model=BdcUndoSettingsOut)
def post_bdc_undo_settings(
    payload: BdcUndoSettingsIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> BdcUndoSettingsOut:
    require_admin(x_admin_token)
    return set_bdc_undo_settings(payload)


@app.post("/api/admin/bdc/distribution", response_model=BdcDistributionOut)
def post_bdc_distribution(
    payload: BdcDistributionIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> BdcDistributionOut:
    require_admin(x_admin_token)
    mode = normalize_bdc_distribution(payload.mode)
    set_meta(BDC_DISTRIBUTION_META_KEY, mode)
    return BdcDistributionOut(mode=mode)


@app.post("/api/admin/tabs/visibility", response_model=TabVisibilityOut)
def post_tabs_visibility(
    payload: TabVisibilityIn,
    x_admin_token: Optional[str] = Header(default=None),
) -> TabVisibilityOut:
    require_admin(x_admin_token)
    return set_tab_visibility(payload)
