import * as XLSX from "xlsx";

export const CRM_CLEANUP_SOURCE_OPTIONS = [
  {
    id: "listBuilder",
    label: "Option 1 List Builder",
    description: "Use the list-builder export with names, phones, addresses, Entity Id, and Event Id.",
    acceptedLabel: ".csv, .xlsx, .xls",
  },
  {
    id: "reportScrape",
    label: "Option 2 Report Scrape",
    description: "Use the report-scrape export with lead rows split into date and time lines.",
    acceptedLabel: ".xlsx, .xls, .csv",
  },
];

const LIST_BUILDER_REQUIRED_HEADERS = ["First Name", "Last Name", "Address 1", "City", "State", "Postal Code"];
const REPORT_SCRAPE_REQUIRED_HEADERS = ["Date", "Name", "Assign To", "BDC Assign To"];

const GROUP_META = {
  phone: {
    title: "Shared phone number",
    shortLabel: "Phone",
    description: "These rows share the same phone number and should be checked for duplicate CRM profiles.",
    rank: 2,
  },
  address: {
    title: "Shared address",
    shortLabel: "Address",
    description: "These rows share the same address and may belong to duplicate household or customer records.",
    rank: 1,
  },
  profile: {
    title: "Multiple opportunities on one profile",
    shortLabel: "Profile",
    description: "These rows look like multiple opportunities living under the same customer profile.",
    rank: 3,
  },
};

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSpace(value) {
  return text(value).replace(/\s+/g, " ").trim();
}

function normalizeUpper(value) {
  return normalizeSpace(value).toUpperCase();
}

function normalizeName(value) {
  return normalizeSpace(value).toUpperCase();
}

function normalizePhone(value) {
  const digits = text(value).replace(/\D/g, "");
  if (!digits) return "";
  const trimmed = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return trimmed.length === 10 ? trimmed : "";
}

function formatPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length !== 10) return text(value);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatZip(value) {
  const digits = text(value).replace(/\D/g, "");
  if (digits.length >= 9) return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
  return digits || text(value);
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function joinParts(parts, separator = " ") {
  return (parts || []).filter(Boolean).join(separator).trim();
}

function joinAddressLabel(parts) {
  const street = joinParts(parts.slice(0, 3), ", ");
  const cityStateZip = joinParts([parts[3], joinParts([parts[4], parts[5]], " ")], ", ");
  return joinParts([street, cityStateZip], ", ");
}

function isBlankCell(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function rowNonBlankCount(row = []) {
  return row.reduce((count, value) => count + (isBlankCell(value) ? 0 : 1), 0);
}

function normalizeHeaders(row = []) {
  return row.map((value) => normalizeSpace(value));
}

function mapRowToObject(headers, row, sourceRowNumber) {
  const record = { __sourceRowNumber: sourceRowNumber };
  headers.forEach((header, index) => {
    if (!header) return;
    record[header] = row?.[index] ?? "";
  });
  return record;
}

function missingHeaders(headers, requiredHeaders) {
  const headerSet = new Set(headers.filter(Boolean));
  return requiredHeaders.filter((header) => !headerSet.has(header));
}

function simpleHash(value) {
  let hash = 0;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateTimeLabel(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return text(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function dateRangeLabel(records) {
  const parsedDates = records
    .map((record) => parseDateValue(record.sortDateLabel))
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());
  if (!parsedDates.length) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const first = formatter.format(parsedDates[0]);
  const last = formatter.format(parsedDates[parsedDates.length - 1]);
  return first === last ? first : `${first} to ${last}`;
}

function buildPhoneEntries(pairs) {
  const seen = new Set();
  const entries = [];
  for (const pair of pairs) {
    const normalized = normalizePhone(pair.value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({
      label: pair.label,
      raw: text(pair.value),
      normalized,
      display: formatPhone(normalized),
    });
  }
  return entries;
}

function listBuilderRecords(rows) {
  const headers = normalizeHeaders(rows[0] || []);
  const missing = missingHeaders(headers, LIST_BUILDER_REQUIRED_HEADERS);
  if (missing.length) {
    throw new Error(`This file is missing list-builder columns: ${missing.join(", ")}.`);
  }

  return rows.slice(1).map((row, index) => mapRowToObject(headers, row, index + 2)).filter((item) => {
    return rowNonBlankCount(headers.map((header) => item[header])) > 0;
  }).map((item) => {
    const fullName = joinParts([text(item["First Name"]), text(item["Last Name"])]);
    const phones = buildPhoneEntries([
      { label: "Mobile", value: item["Mobile Number"] },
      { label: "Work", value: item["Work Number"] },
    ]);
    const addressParts = [
      normalizeSpace(item["Address 1"]),
      normalizeSpace(item["Address 2"]),
      normalizeSpace(item["Address 3"]),
      normalizeSpace(item.City),
      normalizeSpace(item.State),
      formatZip(item["Postal Code"]),
    ];
    const addressLabel = joinAddressLabel(addressParts);
    const addressKey = normalizeUpper(
      joinParts(
        [
          addressParts[0],
          addressParts[1],
          addressParts[2],
          addressParts[3],
          addressParts[4],
          addressParts[5],
        ],
        "|"
      )
    );
    const entityId = text(item["Entity Id"]);
    const eventId = text(item["Event Id"]);
    const primaryPhone = phones[0]?.normalized || "";
    const fallbackProfileKey = normalizeUpper(joinParts([fullName, addressKey || primaryPhone], "|"));
    const profileKey = entityId ? `ENTITY:${entityId}` : fallbackProfileKey;
    const profileLabel = entityId || addressLabel || fullName || primaryPhone;
    const updatedAt = text(item["Update Date"]) || text(item["Deal Date"]) || text(item["Purchase Date"]);
    const vehicle = joinParts([text(item.Year), text(item.Make), text(item.Model)]);
    const status = text(item["Sales Status"]);
    const source = text(item["Sales Source"]);
    const marketing = text(item["Marketing Channel"]);
    const bdcAssignedTo = text(item["BDC Assigned To"]);
    const opportunityKey = eventId || normalizeUpper(joinParts([updatedAt, vehicle, primaryPhone], "|")) || `ROW:${item.__sourceRowNumber}`;
    const rowId = `list-builder-${item.__sourceRowNumber}`;

    return {
      rowId,
      sourceRowNumber: item.__sourceRowNumber,
      customerName: fullName || "Unnamed customer",
      normalizedCustomerName: normalizeName(fullName),
      phones,
      phoneLabel: phones.map((phone) => phone.display).join(", "),
      addressLabel,
      addressKey,
      profileKey,
      profileLabel: profileLabel || "Customer profile",
      opportunityKey,
      opportunityLabel: eventId || `Row ${item.__sourceRowNumber}`,
      sortDateLabel: updatedAt,
      sortDateDisplay: dateTimeLabel(updatedAt),
      ownerLabel: bdcAssignedTo,
      sourceLabel: source,
      vehicleLabel: vehicle,
      statusLabel: status,
      marketingLabel: marketing,
      entityId,
      eventId,
      matchContext: uniqueStrings([status, source, marketing, vehicle]).join(" • "),
      profileEvidence: uniqueStrings([
        entityId ? `Entity ${entityId}` : "",
        eventId ? `Event ${eventId}` : "",
        primaryPhone ? formatPhone(primaryPhone) : "",
      ]).join(" • "),
    };
  });
}

function isTimeOnlyRow(rows, rowIndex, dateColumnIndex, nameColumnIndex) {
  const row = rows[rowIndex];
  if (!row) return false;
  if (text(row[nameColumnIndex])) return false;
  if (rowNonBlankCount(row) !== 1) return false;
  return Boolean(text(row[dateColumnIndex]));
}

function reportScrapeRecords(rows) {
  const headers = normalizeHeaders(rows[0] || []);
  const missing = missingHeaders(headers, REPORT_SCRAPE_REQUIRED_HEADERS);
  if (missing.length) {
    throw new Error(`This file is missing report-scrape columns: ${missing.join(", ")}.`);
  }

  const dateColumnIndex = headers.indexOf("Date");
  const nameColumnIndex = headers.indexOf("Name");

  return rows
    .slice(1)
    .map((row, index) => ({ row, sourceRowNumber: index + 2 }))
    .map(({ row, sourceRowNumber }, rowIndex) => {
      const item = mapRowToObject(headers, row, sourceRowNumber);
      const name = text(item.Name);
      if (!name) return null;
      const nextRowIndex = rowIndex + 2;
      const timeValue = isTimeOnlyRow(rows, nextRowIndex, dateColumnIndex, nameColumnIndex)
        ? text(rows[nextRowIndex]?.[dateColumnIndex])
        : "";
      const combinedDate = joinParts([text(item.Date), timeValue], " ");
      const phones = buildPhoneEntries([
        { label: "Cell", value: item["Wk/Cell Number"] },
        { label: "Home", value: item["Home Number"] },
      ]);
      const primaryPhone = phones[0]?.normalized || "";
      const normalizedName = normalizeName(name);
      const stockNumber = text(item["Stock No."]);
      const vehicle = text(item.Vehicle);
      const ownerLabel = text(item["Assign To"]);
      const bdcAssignedTo = text(item["BDC Assign To"]);
      const sourceLabel = text(item.Source);
      const marketingLabel = text(item.Marketing);
      const closeBucket = text(item["Close Date"]);
      const salesType = text(item["Sales Type"]);
      const opportunityKey =
        normalizeUpper(joinParts([combinedDate, stockNumber || vehicle, ownerLabel, primaryPhone], "|")) ||
        `ROW:${sourceRowNumber}`;
      const profileKey = primaryPhone ? normalizeUpper(joinParts([normalizedName, primaryPhone], "|")) : "";
      const rowId = `report-scrape-${sourceRowNumber}`;

      return {
        rowId,
        sourceRowNumber,
        customerName: name,
        normalizedCustomerName: normalizedName,
        phones,
        phoneLabel: phones.map((phone) => phone.display).join(", "),
        addressLabel: "",
        addressKey: "",
        profileKey,
        profileLabel: uniqueStrings([name, phones[0]?.display || ""]).join(" • "),
        opportunityKey,
        opportunityLabel: stockNumber || vehicle || `Row ${sourceRowNumber}`,
        sortDateLabel: combinedDate || text(item.Date),
        sortDateDisplay: dateTimeLabel(combinedDate || text(item.Date)),
        ownerLabel,
        bdcAssignedTo,
        sourceLabel,
        vehicleLabel: vehicle,
        statusLabel: closeBucket,
        marketingLabel,
        entityId: "",
        eventId: "",
        matchContext: uniqueStrings([salesType, sourceLabel, marketingLabel, vehicle, closeBucket]).join(" • "),
        profileEvidence: uniqueStrings([
          primaryPhone ? formatPhone(primaryPhone) : "",
          stockNumber ? `Stock ${stockNumber}` : "",
        ]).join(" • "),
      };
    })
    .filter(Boolean);
}

function groupRecords(records) {
  const phoneMap = new Map();
  const addressMap = new Map();
  const profileMap = new Map();

  for (const record of records) {
    for (const phone of record.phones) {
      const bucket = phoneMap.get(phone.normalized) || [];
      bucket.push(record);
      phoneMap.set(phone.normalized, bucket);
    }

    if (record.addressKey) {
      const bucket = addressMap.get(record.addressKey) || [];
      bucket.push(record);
      addressMap.set(record.addressKey, bucket);
    }

    if (record.profileKey) {
      const bucket = profileMap.get(record.profileKey) || [];
      bucket.push(record);
      profileMap.set(record.profileKey, bucket);
    }
  }

  const groups = [];

  for (const [matchKey, bucket] of phoneMap.entries()) {
    if (bucket.length < 2) continue;
    groups.push(buildGroup("phone", matchKey, formatPhone(matchKey), bucket));
  }

  for (const [matchKey, bucket] of addressMap.entries()) {
    if (bucket.length < 2) continue;
    groups.push(buildGroup("address", matchKey, bucket[0]?.addressLabel || matchKey, bucket));
  }

  for (const [matchKey, bucket] of profileMap.entries()) {
    const opportunityCount = new Set(bucket.map((record) => record.opportunityKey)).size;
    if (bucket.length < 2 || opportunityCount < 2) continue;
    groups.push(buildGroup("profile", matchKey, bucket[0]?.profileLabel || matchKey, bucket));
  }

  groups.sort((left, right) => {
    const leftCleanliness = GROUP_META[right.kind].rank - GROUP_META[left.kind].rank;
    if (leftCleanliness !== 0) return leftCleanliness;
    if (right.recordCount !== left.recordCount) return right.recordCount - left.recordCount;
    if (right.uniqueCustomerCount !== left.uniqueCustomerCount) return right.uniqueCustomerCount - left.uniqueCustomerCount;
    return left.matchLabel.localeCompare(right.matchLabel);
  });

  return groups;
}

function buildGroup(kind, matchKey, matchLabel, rows) {
  const rowIds = uniqueStrings(rows.map((row) => row.rowId)).sort();
  const customerNames = uniqueStrings(rows.map((row) => row.customerName));
  const opportunityCount = new Set(rows.map((row) => row.opportunityKey)).size;
  const idsSignature = simpleHash(joinParts([kind, matchKey, rowIds.join("|")], "::"));

  return {
    id: `${kind}-${idsSignature}`,
    kind,
    title: GROUP_META[kind].title,
    shortLabel: GROUP_META[kind].shortLabel,
    description: GROUP_META[kind].description,
    matchKey,
    matchLabel,
    recordCount: rows.length,
    uniqueCustomerCount: customerNames.length,
    opportunityCount,
    customerPreview: customerNames.slice(0, 4),
    rows: [...rows].sort((left, right) => {
      const leftDate = parseDateValue(left.sortDateLabel)?.getTime() || 0;
      const rightDate = parseDateValue(right.sortDateLabel)?.getTime() || 0;
      if (rightDate !== leftDate) return rightDate - leftDate;
      return left.customerName.localeCompare(right.customerName);
    }),
  };
}

function buildFlaggedRows(groups) {
  const map = new Map();
  for (const group of groups) {
    for (const row of group.rows) {
      const entry = map.get(row.rowId) || {
        ...row,
        issueKinds: [],
        issueLabels: [],
        groupIds: [],
      };
      if (!entry.issueKinds.includes(group.kind)) entry.issueKinds.push(group.kind);
      if (!entry.issueLabels.includes(group.shortLabel)) entry.issueLabels.push(group.shortLabel);
      if (!entry.groupIds.includes(group.id)) entry.groupIds.push(group.id);
      map.set(row.rowId, entry);
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (right.issueKinds.length !== left.issueKinds.length) return right.issueKinds.length - left.issueKinds.length;
    const rightDate = parseDateValue(right.sortDateLabel)?.getTime() || 0;
    const leftDate = parseDateValue(left.sortDateLabel)?.getTime() || 0;
    if (rightDate !== leftDate) return rightDate - leftDate;
    return left.customerName.localeCompare(right.customerName);
  });
}

export async function analyzeCrmCleanupFile(file, sourceType) {
  if (!file) {
    throw new Error("Choose a CRM export first.");
  }

  const option = CRM_CLEANUP_SOURCE_OPTIONS.find((item) => item.id === sourceType);
  if (!option) {
    throw new Error("Pick a valid CRM cleanup upload type.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: false,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded file does not contain any worksheet data.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  if (!rows.length) {
    throw new Error("The uploaded file is empty.");
  }

  const records = sourceType === "listBuilder" ? listBuilderRecords(rows) : reportScrapeRecords(rows);
  if (!records.length) {
    throw new Error("No customer rows were found in that upload.");
  }

  const groups = groupRecords(records);
  const flaggedRows = buildFlaggedRows(groups);
  const datasetFingerprint = simpleHash(
    joinParts(
      [
        sourceType,
        file.name,
        String(file.size),
        String(file.lastModified || ""),
        groups.map((group) => group.id).join("|"),
      ],
      "::"
    )
  );

  return {
    datasetKey: `${sourceType}-${datasetFingerprint}`,
    fileName: file.name,
    fileSize: file.size,
    sourceType,
    sourceLabel: option.label,
    sheetName,
    groups,
    flaggedRows,
    summary: {
      totalRows: records.length,
      totalGroups: groups.length,
      flaggedRows: flaggedRows.length,
      dateRangeLabel: dateRangeLabel(records),
      byKind: {
        phone: groups.filter((group) => group.kind === "phone").length,
        address: groups.filter((group) => group.kind === "address").length,
        profile: groups.filter((group) => group.kind === "profile").length,
      },
    },
  };
}
