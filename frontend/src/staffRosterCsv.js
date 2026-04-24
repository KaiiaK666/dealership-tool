const YES_VALUES = new Set(["1", "true", "yes", "y"]);
const NO_VALUES = new Set(["0", "false", "no", "n"]);

export const STAFF_ROSTER_HEADERS = [
  "staff_type",
  "record_id",
  "name",
  "department",
  "dealership",
  "phone_number",
  "email",
  "text_alerts",
  "email_alerts",
  "active",
];

export const STAFF_ROSTER_DEALERSHIPS = ["Kia", "Mazda", "Outlet"];

export function normalizeStaffRosterLookupKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function csvSafeValue(value) {
  const text = String(value ?? "");
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function boolToCell(value) {
  return value ? "Yes" : "No";
}

function normalizeStaffType(value) {
  const key = normalizeStaffRosterLookupKey(value);
  if (!key) return "";
  if (key === "sales") return "Sales";
  if (key === "bdc") return "BDC";
  throw new Error(`Unsupported staff_type "${value}". Use Sales or BDC.`);
}

function normalizeDealership(value) {
  const key = normalizeStaffRosterLookupKey(value);
  if (!key) return "";
  if (key === "kia") return "Kia";
  if (key === "mazda") return "Mazda";
  if (key === "outlet") return "Outlet";
  return String(value ?? "").trim();
}

function parseBooleanCell(value, columnName) {
  const key = normalizeStaffRosterLookupKey(value);
  if (!key) return null;
  if (YES_VALUES.has(key)) return true;
  if (NO_VALUES.has(key)) return false;
  throw new Error(`Column "${columnName}" must use Yes/No, True/False, or 1/0.`);
}

function parseCsvTable(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char !== "\r") {
      cell += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV import stopped inside an open quote.");
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function buildHeaderMap(headerRow) {
  const headerMap = new Map();
  headerRow.forEach((value, index) => {
    const key = normalizeStaffRosterLookupKey(value).replace(/\s+/g, "_");
    if (key) {
      headerMap.set(key, index);
    }
  });
  return headerMap;
}

function cellValue(row, headerMap, key) {
  const index = headerMap.get(key);
  if (typeof index !== "number") return "";
  return String(row[index] ?? "").trim();
}

function optionalCellValue(row, headerMap, key) {
  if (!headerMap.has(key)) return null;
  return cellValue(row, headerMap, key);
}

export function buildStaffRosterCsv({ salespeople, bdcAgents }) {
  const rows = [
    STAFF_ROSTER_HEADERS,
    ...[...(salespeople || [])]
      .sort(
        (left, right) =>
          String(left.dealership || "").localeCompare(String(right.dealership || ""), undefined, { sensitivity: "base" }) ||
          String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" })
      )
      .map((person) => [
        "Sales",
        person.id,
        person.name,
        "Sales",
        person.dealership,
        person.phone_number || "",
        person.email || "",
        boolToCell(Boolean(person.notify_sms)),
        boolToCell(Boolean(person.notify_email)),
        boolToCell(Boolean(person.active)),
      ]),
    ...[...(bdcAgents || [])]
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" }))
      .map((agent) => [
        "BDC",
        agent.id,
        agent.name,
        "BDC",
        "",
        "",
        "",
        "",
        "",
        boolToCell(Boolean(agent.active)),
      ]),
  ];
  return rows.map((row) => row.map(csvSafeValue).join(",")).join("\n");
}

export function parseStaffRosterCsv(text) {
  const table = parseCsvTable(text);
  if (!table.length) {
    throw new Error("CSV is empty.");
  }

  const headerMap = buildHeaderMap(table[0]);
  if (!headerMap.has("staff_type") || !headerMap.has("name")) {
    throw new Error('CSV must include "staff_type" and "name" columns.');
  }

  return table
    .slice(1)
    .map((row, rowIndex) => {
      const values = row.map((value) => String(value ?? "").trim());
      const isBlankRow = values.every((value) => !value);
      if (isBlankRow) return null;

      const staffType = normalizeStaffType(cellValue(row, headerMap, "staff_type"));
      if (!staffType) {
        throw new Error(`Row ${rowIndex + 2} is missing staff_type.`);
      }
      const rawRecordId = cellValue(row, headerMap, "record_id");
      const recordId = rawRecordId ? Number.parseInt(rawRecordId, 10) : null;
      if (rawRecordId && !Number.isInteger(recordId)) {
        throw new Error(`Row ${rowIndex + 2} has an invalid record_id "${rawRecordId}".`);
      }

      const name = cellValue(row, headerMap, "name");
      if (!name) {
        throw new Error(`Row ${rowIndex + 2} is missing a name.`);
      }

      return {
        rowNumber: rowIndex + 2,
        staffType,
        recordId,
        name,
        department: optionalCellValue(row, headerMap, "department"),
        dealership: normalizeDealership(optionalCellValue(row, headerMap, "dealership")),
        phoneNumber: optionalCellValue(row, headerMap, "phone_number"),
        email: optionalCellValue(row, headerMap, "email"),
        notifySms: parseBooleanCell(cellValue(row, headerMap, "text_alerts"), "text_alerts"),
        notifyEmail: parseBooleanCell(cellValue(row, headerMap, "email_alerts"), "email_alerts"),
        active: parseBooleanCell(cellValue(row, headerMap, "active"), "active"),
      };
    })
    .filter(Boolean);
}
