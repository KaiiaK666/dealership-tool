from __future__ import annotations

import json
import os
from copy import deepcopy
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


DEFAULT_DATA_ROOT = Path(
    os.getenv(
        "DEALER_DB_PATH",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "dealership.db"),
    )
).expanduser().resolve().parent
DATA_FILE = Path(os.getenv("ORGTOOL_DATA_FILE", str(DEFAULT_DATA_ROOT / "orgtool-store.json"))).expanduser()

StatusValue = Literal["Not started", "Working on it", "Review", "Stuck", "Done"]
PriorityValue = Literal["Critical", "High", "Medium", "Low"]
AudienceValue = Literal["All", "Sales", "BDC", "Service", "Leadership"]
FieldTypeValue = Literal["text", "number", "date", "tag"]


def iso_today(offset_days: int = 0) -> str:
    return date.fromordinal(date.today().toordinal() + offset_days).isoformat()


SEED_DATA = {
    "stores": [
        {
            "id": 1,
            "name": "Bert Ogden Kia",
            "code": "KIA",
            "city": "Edinburg",
            "manager": "Kai Rivers",
            "department_focus": "Sales",
            "sales_target": 160,
            "service_target": 1150,
            "active": True,
        },
        {
            "id": 2,
            "name": "Bert Ogden Mazda",
            "code": "MAZ",
            "city": "Edinburg",
            "manager": "Maya Chen",
            "department_focus": "Service",
            "sales_target": 95,
            "service_target": 820,
            "active": True,
        },
        {
            "id": 3,
            "name": "Bert Ogden Outlet",
            "code": "OUT",
            "city": "Mission",
            "manager": "Jordan Reed",
            "department_focus": "Used Cars",
            "sales_target": 120,
            "service_target": 0,
            "active": True,
        },
    ],
    "users": [
        {
            "id": 1,
            "name": "Kai Rivers",
            "title": "General Sales Manager",
            "role": "Admin",
            "department": "Sales",
            "store_id": 1,
            "phone": "(956) 555-0101",
            "active": True,
            "avatar": "KR",
            "password": "bertogden",
        },
        {
            "id": 2,
            "name": "Maya Chen",
            "title": "Fixed Ops Director",
            "role": "Manager",
            "department": "Service",
            "store_id": 2,
            "phone": "(956) 555-0102",
            "active": True,
            "avatar": "MC",
            "password": "maya2026",
        },
        {
            "id": 3,
            "name": "Jordan Reed",
            "title": "BDC Manager",
            "role": "Manager",
            "department": "BDC",
            "store_id": 1,
            "phone": "(956) 555-0103",
            "active": True,
            "avatar": "JR",
            "password": "jordan2026",
        },
        {
            "id": 4,
            "name": "Ava Martinez",
            "title": "Marketing Lead",
            "role": "Coordinator",
            "department": "Marketing",
            "store_id": 3,
            "phone": "(956) 555-0104",
            "active": True,
            "avatar": "AM",
            "password": "ava2026",
        },
        {
            "id": 5,
            "name": "Luis Gomez",
            "title": "Service Advisor",
            "role": "Staff",
            "department": "Service",
            "store_id": 2,
            "phone": "(956) 555-0105",
            "active": True,
            "avatar": "LG",
            "password": "luis2026",
        },
    ],
    "announcements": [
        {
            "id": 1,
            "title": "Weekend push",
            "message": "Close out all open priority tasks before the Saturday desk meeting.",
            "audience": "Sales",
            "priority": "High",
            "pinned": True,
        },
        {
            "id": 2,
            "title": "Mazda service lane",
            "message": "Loaner inventory is tight. Route approvals through Maya before promising next-day delivery.",
            "audience": "Service",
            "priority": "Medium",
            "pinned": False,
        },
    ],
    "settings": {
        "permissions": [
            {
                "role": "Admin",
                "can_manage_staff": True,
                "can_manage_stores": True,
                "can_edit_boards": True,
                "can_publish_announcements": True,
                "can_view_reports": True,
            },
            {
                "role": "Manager",
                "can_manage_staff": True,
                "can_manage_stores": False,
                "can_edit_boards": True,
                "can_publish_announcements": True,
                "can_view_reports": True,
            },
            {
                "role": "Coordinator",
                "can_manage_staff": False,
                "can_manage_stores": False,
                "can_edit_boards": True,
                "can_publish_announcements": False,
                "can_view_reports": True,
            },
            {
                "role": "Staff",
                "can_manage_staff": False,
                "can_manage_stores": False,
                "can_edit_boards": False,
                "can_publish_announcements": False,
                "can_view_reports": False,
            },
        ],
        "pipeline_templates": [
            {"department": "BDC", "stages": ["Fresh Lead", "Contacted", "Appt Set", "Showed", "Sold"]},
            {"department": "Sales", "stages": ["Open", "This Week", "Done"]},
            {"department": "Service", "stages": ["Open", "Waiting", "Done"]},
        ],
    },
    "boards": [
        {
            "id": 1,
            "name": "Showroom Appointments",
            "description": "Simple sales task board for appointments, follow-up, and completed deliveries.",
            "color": "#4f6bed",
            "department": "Sales",
            "store_id": 1,
            "fields": [],
            "groups": [
                {"id": 11, "name": "Open"},
                {"id": 12, "name": "This Week"},
                {"id": 13, "name": "Done"},
            ],
            "tasks": [
                {
                    "id": 101,
                    "group_id": 11,
                    "name": "Confirm Telluride showroom visit",
                    "status": "Working on it",
                    "priority": "High",
                    "owner_id": 1,
                    "store_id": 1,
                    "department": "Sales",
                    "category": "Appointment",
                    "customer_name": "Rosa Salinas",
                    "vehicle": "2024 Kia Telluride SX",
                    "due_date": iso_today(0),
                    "effort": 1,
                    "notes": "Call after 5:30 PM.",
                    "custom_fields": {},
                },
                {
                    "id": 102,
                    "group_id": 12,
                    "name": "Confirm Saturday showroom visit",
                    "status": "Review",
                    "priority": "Medium",
                    "owner_id": 1,
                    "store_id": 1,
                    "department": "Sales",
                    "category": "Appointment",
                    "customer_name": "Hector Garza",
                    "vehicle": "2022 Silverado LT",
                    "due_date": iso_today(1),
                    "effort": 1,
                    "notes": "Needs trade appraisal.",
                    "custom_fields": {},
                },
            ],
        },
        {
            "id": 2,
            "name": "Service Lane Follow Up",
            "description": "Track advisor callbacks, approvals, and customer touchpoints.",
            "color": "#2d9cdb",
            "department": "Service",
            "store_id": 2,
            "fields": [],
            "groups": [
                {"id": 21, "name": "Open"},
                {"id": 22, "name": "Waiting"},
                {"id": 23, "name": "Done"},
            ],
            "tasks": [
                {
                    "id": 201,
                    "group_id": 21,
                    "name": "Update customer on brake job",
                    "status": "Working on it",
                    "priority": "Critical",
                    "owner_id": 5,
                    "store_id": 2,
                    "department": "Service",
                    "category": "Customer Update",
                    "customer_name": "Marcos Pena",
                    "vehicle": "2023 Mazda CX-5",
                    "due_date": iso_today(0),
                    "effort": 2,
                    "notes": "Customer waiting on total after warranty review.",
                    "custom_fields": {},
                }
            ],
        },
        {
            "id": 3,
            "name": "Used Car Specials",
            "description": "Creative and pricing tasks for used inventory campaigns.",
            "color": "#17a36b",
            "department": "Marketing",
            "store_id": 3,
            "fields": [
                {"id": 1, "name": "Channel", "type": "tag"},
                {"id": 2, "name": "Publish Date", "type": "date"},
            ],
            "groups": [
                {"id": 31, "name": "Draft"},
                {"id": 32, "name": "Ready"},
                {"id": 33, "name": "Live"},
            ],
            "tasks": [
                {
                    "id": 301,
                    "group_id": 31,
                    "name": "Tahoe cash campaign creative",
                    "status": "Not started",
                    "priority": "Medium",
                    "owner_id": 4,
                    "store_id": 3,
                    "department": "Marketing",
                    "category": "Graphic",
                    "customer_name": "",
                    "vehicle": "2021 Chevrolet Tahoe",
                    "due_date": iso_today(1),
                    "effort": 1,
                    "notes": "Waiting on final price approval.",
                    "custom_fields": {"1": "Instagram", "2": iso_today(3)},
                }
            ],
        },
    ],
}


def ensure_store() -> None:
    if DATA_FILE.exists():
        return
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(SEED_DATA, indent=2), encoding="utf-8")


def next_id(items: list[dict]) -> int:
    return max((int(item["id"]) for item in items), default=0) + 1


def public_user(user: dict) -> dict:
    return {key: value for key, value in user.items() if key != "password"}


def normalize_store(store: dict) -> dict:
    normalized = deepcopy(store or {})
    normalized.setdefault("stores", deepcopy(SEED_DATA["stores"]))
    normalized.setdefault("users", deepcopy(SEED_DATA["users"]))
    normalized.setdefault("announcements", deepcopy(SEED_DATA["announcements"]))
    normalized.setdefault("settings", deepcopy(SEED_DATA["settings"]))
    normalized.setdefault("boards", deepcopy(SEED_DATA["boards"]))

    normalized["settings"].setdefault("permissions", deepcopy(SEED_DATA["settings"]["permissions"]))
    normalized["settings"].setdefault("pipeline_templates", deepcopy(SEED_DATA["settings"]["pipeline_templates"]))

    for store_row in normalized["stores"]:
        store_row.setdefault("active", True)
        store_row.setdefault("manager", "")
        store_row.setdefault("department_focus", "Sales")
        store_row.setdefault("sales_target", 0)
        store_row.setdefault("service_target", 0)

    for user in normalized["users"]:
        user.setdefault("role", "Staff")
        user.setdefault("department", "General")
        user.setdefault("store_id", None)
        user.setdefault("phone", "")
        user.setdefault("active", True)
        user.setdefault("avatar", "".join(part[:1] for part in user.get("name", "").split()[:2]).upper())
        user.setdefault("password", f"bertogden-{user.get('id', 0)}")

    for item in normalized["announcements"]:
        item.setdefault("audience", "All")
        item.setdefault("priority", "Medium")
        item.setdefault("pinned", False)

    for board in normalized["boards"]:
        board.setdefault("description", "")
        board.setdefault("color", "#4f6bed")
        board.setdefault("department", "General")
        board.setdefault("store_id", None)
        board.setdefault("groups", [])
        board.setdefault("fields", [])
        board.setdefault("tasks", [])
        for field in board["fields"]:
            field.setdefault("type", "text")
        for task in board["tasks"]:
            task.setdefault("status", "Not started")
            task.setdefault("priority", "Medium")
            task.setdefault("owner_id", None)
            task.setdefault("store_id", board.get("store_id"))
            task.setdefault("department", board.get("department", "General"))
            task.setdefault("category", "Task")
            task.setdefault("customer_name", "")
            task.setdefault("vehicle", "")
            task.setdefault("due_date", None)
            task.setdefault("effort", 1)
            task.setdefault("notes", "")
            task.setdefault("custom_fields", {})

    return normalized


def read_store() -> dict:
    ensure_store()
    normalized = normalize_store(json.loads(DATA_FILE.read_text(encoding="utf-8")))
    write_store(normalized)
    return normalized


def write_store(store: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(normalize_store(store), indent=2), encoding="utf-8")


def public_snapshot(store: dict) -> dict:
    snapshot = deepcopy(store)
    snapshot["users"] = [public_user(user) for user in snapshot["users"]]
    return snapshot


def get_board(store: dict, board_id: int) -> dict:
    board = next((entry for entry in store["boards"] if int(entry["id"]) == int(board_id)), None)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


class LoginPayload(BaseModel):
    user_id: int
    password: str = Field(min_length=1, max_length=120)


class StoreCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    code: str = Field(min_length=2, max_length=10)
    city: str = ""
    manager: str = ""
    department_focus: str = "Sales"
    sales_target: int = Field(default=0, ge=0)
    service_target: int = Field(default=0, ge=0)
    active: bool = True


class StorePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    code: str | None = Field(default=None, min_length=2, max_length=10)
    city: str | None = None
    manager: str | None = None
    department_focus: str | None = None
    sales_target: int | None = Field(default=None, ge=0)
    service_target: int | None = Field(default=None, ge=0)
    active: bool | None = None


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    title: str = ""
    role: str = "Staff"
    department: str = "General"
    store_id: int | None = None
    phone: str = ""
    password: str = Field(min_length=4, max_length=120)
    active: bool = True


class UserPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    title: str | None = None
    role: str | None = None
    department: str | None = None
    store_id: int | None = None
    phone: str | None = None
    password: str | None = Field(default=None, min_length=4, max_length=120)
    active: bool | None = None


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=80)
    message: str = Field(min_length=2, max_length=300)
    audience: AudienceValue = "All"
    priority: PriorityValue = "Medium"
    pinned: bool = False


class AnnouncementPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=80)
    message: str | None = Field(default=None, min_length=2, max_length=300)
    audience: AudienceValue | None = None
    priority: PriorityValue | None = None
    pinned: bool | None = None


class PermissionPatch(BaseModel):
    can_manage_staff: bool | None = None
    can_manage_stores: bool | None = None
    can_edit_boards: bool | None = None
    can_publish_announcements: bool | None = None
    can_view_reports: bool | None = None


class BoardCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = ""
    color: str = "#4f6bed"
    department: str = "General"
    store_id: int | None = None


class BoardPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    color: str | None = None
    department: str | None = None
    store_id: int | None = None


class GroupCreate(BaseModel):
    board_id: int
    name: str = Field(min_length=1, max_length=60)


class BoardFieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    type: FieldTypeValue = "text"


class TaskCreate(BaseModel):
    board_id: int
    group_id: int
    name: str = Field(min_length=2, max_length=120)
    status: StatusValue = "Not started"
    priority: PriorityValue = "Medium"
    owner_id: int | None = None
    store_id: int | None = None
    department: str = "General"
    category: str = "Task"
    customer_name: str = ""
    vehicle: str = ""
    due_date: str | None = None
    effort: int = Field(default=1, ge=1, le=13)
    notes: str = ""
    custom_fields: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class TaskPatch(BaseModel):
    group_id: int | None = None
    name: str | None = Field(default=None, min_length=2, max_length=120)
    status: StatusValue | None = None
    priority: PriorityValue | None = None
    owner_id: int | None = None
    store_id: int | None = None
    department: str | None = None
    category: str | None = None
    customer_name: str | None = None
    vehicle: str | None = None
    due_date: str | None = None
    effort: int | None = Field(default=None, ge=1, le=13)
    notes: str | None = None
    custom_fields: dict[str, str | int | float | bool | None] | None = None


app = FastAPI(title="OrgTool API")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/bootstrap")
def bootstrap() -> dict:
    return public_snapshot(read_store())


@app.post("/api/login")
def login(payload: LoginPayload) -> dict:
    store = read_store()
    user = next((entry for entry in store["users"] if int(entry["id"]) == int(payload.user_id) and entry.get("active", True)), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.password != user.get("password"):
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"user": public_user(user)}


@app.post("/api/stores")
def create_store(payload: StoreCreate) -> dict:
    store = read_store()
    record = payload.model_dump()
    record["id"] = next_id(store["stores"])
    store["stores"].append(record)
    write_store(store)
    return {"store": record}


@app.patch("/api/stores/{store_id}")
def update_store(store_id: int, payload: StorePatch) -> dict:
    store = read_store()
    record = next((entry for entry in store["stores"] if int(entry["id"]) == int(store_id)), None)
    if not record:
        raise HTTPException(status_code=404, detail="Store not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        record[key] = value
    write_store(store)
    return {"store": record}


@app.post("/api/users")
def create_user(payload: UserCreate) -> dict:
    store = read_store()
    record = payload.model_dump()
    record["id"] = next_id(store["users"])
    record["avatar"] = "".join(part[:1] for part in record["name"].split()[:2]).upper()
    store["users"].append(record)
    write_store(store)
    return {"user": public_user(record)}


@app.patch("/api/users/{user_id}")
def update_user(user_id: int, payload: UserPatch) -> dict:
    store = read_store()
    record = next((entry for entry in store["users"] if int(entry["id"]) == int(user_id)), None)
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        record[key] = value
    if "name" in payload.model_dump(exclude_unset=True):
        record["avatar"] = "".join(part[:1] for part in record["name"].split()[:2]).upper()
    write_store(store)
    return {"user": public_user(record)}


@app.post("/api/announcements")
def create_announcement(payload: AnnouncementCreate) -> dict:
    store = read_store()
    record = payload.model_dump()
    record["id"] = next_id(store["announcements"])
    store["announcements"].append(record)
    write_store(store)
    return {"announcement": record}


@app.patch("/api/announcements/{announcement_id}")
def update_announcement(announcement_id: int, payload: AnnouncementPatch) -> dict:
    store = read_store()
    record = next((entry for entry in store["announcements"] if int(entry["id"]) == int(announcement_id)), None)
    if not record:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        record[key] = value
    write_store(store)
    return {"announcement": record}


@app.patch("/api/settings/permissions/{role}")
def update_permission(role: str, payload: PermissionPatch) -> dict:
    store = read_store()
    record = next((entry for entry in store["settings"]["permissions"] if entry["role"] == role), None)
    if not record:
        raise HTTPException(status_code=404, detail="Role not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        record[key] = value
    write_store(store)
    return {"permission": record}


@app.post("/api/boards")
def create_board(payload: BoardCreate) -> dict:
    store = read_store()
    board = payload.model_dump()
    board["id"] = next_id(store["boards"])
    board["groups"] = []
    board["fields"] = []
    board["tasks"] = []
    store["boards"].append(board)
    write_store(store)
    return {"board": board}


@app.patch("/api/boards/{board_id}")
def update_board(board_id: int, payload: BoardPatch) -> dict:
    store = read_store()
    board = get_board(store, board_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        board[key] = value
    write_store(store)
    return {"board": board}


@app.post("/api/boards/{board_id}/fields")
def create_board_field(board_id: int, payload: BoardFieldCreate) -> dict:
    store = read_store()
    board = get_board(store, board_id)
    field = payload.model_dump()
    field["id"] = next_id(board["fields"])
    board["fields"].append(field)
    write_store(store)
    return {"field": field}


@app.post("/api/groups")
def create_group(payload: GroupCreate) -> dict:
    store = read_store()
    board = get_board(store, payload.board_id)
    group = {"id": next_id(board["groups"]), "name": payload.name}
    board["groups"].append(group)
    write_store(store)
    return {"group": group}


@app.post("/api/tasks")
def create_task(payload: TaskCreate) -> dict:
    store = read_store()
    board = get_board(store, payload.board_id)
    if not any(int(group["id"]) == int(payload.group_id) for group in board["groups"]):
        raise HTTPException(status_code=404, detail="Group not found")
    task = payload.model_dump()
    task["id"] = next_id(board["tasks"])
    board["tasks"].append(task)
    write_store(store)
    return {"task": task}


@app.patch("/api/boards/{board_id}/tasks/{task_id}")
def update_task(board_id: int, task_id: int, payload: TaskPatch) -> dict:
    store = read_store()
    board = get_board(store, board_id)
    task = next((entry for entry in board["tasks"] if int(entry["id"]) == int(task_id)), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = payload.model_dump(exclude_unset=True)
    if "group_id" in updates and not any(int(group["id"]) == int(updates["group_id"]) for group in board["groups"]):
        raise HTTPException(status_code=404, detail="Group not found")
    for key, value in updates.items():
        task[key] = value
    write_store(store)
    return {"task": task}
