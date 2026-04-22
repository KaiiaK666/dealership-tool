import React, { startTransition, useEffect, useState } from "react";
import { CRM_CLEANUP_SOURCE_OPTIONS, analyzeCrmCleanupFile } from "./crmCleanup.js";

const CRM_CLEANUP_PROGRESS_KEY = "dealer_tool_crm_cleanup_progress_v1";

function readCleanupProgress() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CRM_CLEANUP_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCleanupProgress(nextState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CRM_CLEANUP_PROGRESS_KEY, JSON.stringify(nextState));
}

function numberLabel(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function statusClass(isCleaned) {
  return isCleaned ? "is-cleaned" : "is-open";
}

function matchesGroupSearch(group, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    group.title,
    group.matchLabel,
    ...group.customerPreview,
    ...group.rows.flatMap((row) => [
      row.customerName,
      row.phoneLabel,
      row.addressLabel,
      row.ownerLabel,
      row.sourceLabel,
      row.vehicleLabel,
      row.matchContext,
      row.profileEvidence,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function rowHasOpenGroup(row, cleanedGroupIds) {
  return row.groupIds.some((groupId) => !cleanedGroupIds.has(groupId));
}

export default function CrmCleanupSection() {
  const [sourceType, setSourceType] = useState("listBuilder");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groupFilter, setGroupFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [cleanedGroupIds, setCleanedGroupIds] = useState([]);

  useEffect(() => {
    if (!analysis?.datasetKey) {
      setCleanedGroupIds([]);
      return;
    }
    const stored = readCleanupProgress();
    const nextIds = Array.isArray(stored[analysis.datasetKey]) ? stored[analysis.datasetKey] : [];
    setCleanedGroupIds(nextIds);
  }, [analysis?.datasetKey]);

  useEffect(() => {
    if (!analysis?.datasetKey) return;
    const stored = readCleanupProgress();
    stored[analysis.datasetKey] = cleanedGroupIds;
    writeCleanupProgress(stored);
  }, [analysis?.datasetKey, cleanedGroupIds]);

  const cleanedGroupSet = new Set(cleanedGroupIds);
  const openGroups = (analysis?.groups || []).filter((group) => !cleanedGroupSet.has(group.id));
  const visibleGroups = (analysis?.groups || [])
    .filter((group) => {
      if (groupFilter === "open" && cleanedGroupSet.has(group.id)) return false;
      if (groupFilter === "cleaned" && !cleanedGroupSet.has(group.id)) return false;
      return matchesGroupSearch(group, search);
    })
    .sort((left, right) => {
      const leftIsCleaned = cleanedGroupSet.has(left.id);
      const rightIsCleaned = cleanedGroupSet.has(right.id);
      if (leftIsCleaned !== rightIsCleaned) return leftIsCleaned ? 1 : -1;
      if (right.recordCount !== left.recordCount) return right.recordCount - left.recordCount;
      return left.matchLabel.localeCompare(right.matchLabel);
    });

  const visibleFlaggedRows = (analysis?.flaggedRows || [])
    .filter((row) => {
      if (!search) return true;
      const haystack = [
        row.customerName,
        row.phoneLabel,
        row.addressLabel,
        row.ownerLabel,
        row.sourceLabel,
        row.vehicleLabel,
        row.matchContext,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((left, right) => {
      const leftHasOpen = rowHasOpenGroup(left, cleanedGroupSet);
      const rightHasOpen = rowHasOpenGroup(right, cleanedGroupSet);
      if (leftHasOpen !== rightHasOpen) return leftHasOpen ? -1 : 1;
      return right.issueKinds.length - left.issueKinds.length;
    });

  const summary = analysis?.summary || null;
  const cleanedCount = analysis?.groups?.filter((group) => cleanedGroupSet.has(group.id)).length || 0;
  const fileOption = CRM_CLEANUP_SOURCE_OPTIONS.find((item) => item.id === sourceType) || CRM_CLEANUP_SOURCE_OPTIONS[0];

  async function handleAnalyze(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await analyzeCrmCleanupFile(selectedFile, sourceType);
      startTransition(() => {
        setAnalysis(result);
        setGroupFilter("open");
        setSearch("");
      });
    } catch (errorValue) {
      setError(errorValue?.message || "Unable to analyze that upload.");
    } finally {
      setBusy(false);
    }
  }

  function resetAnalysis() {
    setSelectedFile(null);
    setAnalysis(null);
    setError("");
    setSearch("");
    setGroupFilter("open");
    setCleanedGroupIds([]);
    setFileInputKey((current) => current + 1);
  }

  function toggleGroupCleaned(groupId) {
    setCleanedGroupIds((current) => {
      if (current.includes(groupId)) return current.filter((item) => item !== groupId);
      return [...current, groupId];
    });
  }

  function clearCleanupProgress() {
    if (!analysis?.datasetKey) return;
    setCleanedGroupIds([]);
  }

  return (
    <section className="stack crm-cleanup-section">
      <div className="panel crm-cleanup-hero">
        <div>
          <span className="eyebrow">CRM Cleanup</span>
          <h2>Upload a CRM export and review duplicate customers first</h2>
          <p className="admin-note">
            This workspace checks shared phone numbers, shared addresses, and multiple opportunities sitting under one
            customer profile. Unresolved duplicate groups stay at the top until you mark them cleaned.
          </p>
        </div>
        <div className="crm-cleanup-hero__notice">
          <strong>Browser-only review</strong>
          <span>Your upload is analyzed directly in this page, and cleanup progress is saved per file in this browser.</span>
        </div>
      </div>

      <div className="panel crm-cleanup-uploader">
        <div className="crm-cleanup-uploader__header">
          <div>
            <span className="eyebrow">Import types</span>
            <h3>Choose the export format first</h3>
            <p className="admin-note">
              Pick the same option each time you upload so the parser uses the right columns for your CRM export.
            </p>
          </div>
          {analysis ? (
            <button type="button" className="secondary" onClick={resetAnalysis}>
              Start New Upload
            </button>
          ) : null}
        </div>

        <div className="crm-cleanup-source-grid">
          {CRM_CLEANUP_SOURCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`crm-cleanup-source ${sourceType === option.id ? "is-active" : ""}`}
              onClick={() => setSourceType(option.id)}
            >
              <span>{option.label}</span>
              <strong>{option.acceptedLabel}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>

        <form className="crm-cleanup-upload-form" onSubmit={handleAnalyze}>
          <label className="crm-cleanup-upload-field">
            <span>Upload file</span>
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] || null);
                setError("");
              }}
            />
            <small>
              {fileOption.label} supports {fileOption.acceptedLabel}.
            </small>
          </label>

          <div className="crm-cleanup-upload-actions">
            <div className="crm-cleanup-upload-actions__summary">
              <strong>{selectedFile ? selectedFile.name : "No file selected yet"}</strong>
              <span>{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : "Choose your export to begin."}</span>
            </div>
            <button type="submit" disabled={!selectedFile || busy}>
              {busy ? "Analyzing..." : "Analyze CRM Upload"}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      {analysis ? (
        <>
          <div className="crm-cleanup-summary-grid">
            <article className="panel crm-cleanup-stat">
              <span>Rows scanned</span>
              <strong>{numberLabel(summary.totalRows)}</strong>
              <small>{analysis.sourceLabel}</small>
            </article>
            <article className="panel crm-cleanup-stat">
              <span>Duplicate groups</span>
              <strong>{numberLabel(summary.totalGroups)}</strong>
              <small>
                {summary.byKind.phone} phone • {summary.byKind.address} address • {summary.byKind.profile} profile
              </small>
            </article>
            <article className="panel crm-cleanup-stat">
              <span>Still open</span>
              <strong>{numberLabel(openGroups.length)}</strong>
              <small>{numberLabel(cleanedCount)} cleaned</small>
            </article>
            <article className="panel crm-cleanup-stat">
              <span>Flagged rows</span>
              <strong>{numberLabel(summary.flaggedRows)}</strong>
              <small>{summary.dateRangeLabel || "Date range not detected"}</small>
            </article>
          </div>

          <div className="panel crm-cleanup-toolbar">
            <div className="crm-cleanup-toolbar__filters">
              <div className="crm-cleanup-filter-pills">
                {[
                  { id: "open", label: "Open" },
                  { id: "all", label: "All" },
                  { id: "cleaned", label: "Cleaned" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`crm-cleanup-pill ${groupFilter === item.id ? "is-active" : ""}`}
                    onClick={() => setGroupFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="crm-cleanup-search">
                <span>Search rows</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Customer, phone, address, owner, vehicle"
                />
              </label>
            </div>
            <div className="crm-cleanup-toolbar__actions">
              <small>
                {analysis.fileName} • {analysis.sheetName}
              </small>
              <button type="button" className="secondary" onClick={clearCleanupProgress} disabled={!cleanedCount}>
                Reset Cleaned Count
              </button>
            </div>
          </div>

          <div className="crm-cleanup-groups">
            {visibleGroups.length ? (
              visibleGroups.map((group) => {
                const isCleaned = cleanedGroupSet.has(group.id);
                return (
                  <article key={group.id} className={`panel crm-cleanup-group ${statusClass(isCleaned)}`}>
                    <div className="crm-cleanup-group__header">
                      <div>
                        <div className="crm-cleanup-group__eyebrow">
                          <span>{group.title}</span>
                          <span className={`crm-cleanup-status ${statusClass(isCleaned)}`}>
                            {isCleaned ? "Cleaned" : "Needs review"}
                          </span>
                        </div>
                        <h3>{group.matchLabel}</h3>
                        <p className="admin-note">{group.description}</p>
                      </div>
                      <button type="button" className="secondary" onClick={() => toggleGroupCleaned(group.id)}>
                        {isCleaned ? "Mark Open" : "Mark Cleaned"}
                      </button>
                    </div>

                    <div className="crm-cleanup-group__meta">
                      <span>{numberLabel(group.recordCount)} rows</span>
                      <span>{numberLabel(group.uniqueCustomerCount)} customers</span>
                      <span>{numberLabel(group.opportunityCount)} opportunities</span>
                      {group.customerPreview.length ? <span>{group.customerPreview.join(", ")}</span> : null}
                    </div>

                    <div className="table-wrap">
                      <table className="crm-cleanup-table">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Phone</th>
                            <th>Address / Profile</th>
                            <th>Owner / Source</th>
                            <th>Opportunity</th>
                            <th>Last activity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={`${group.id}-${row.rowId}`}>
                              <td>
                                <strong>{row.customerName}</strong>
                                <div className="table-subline">Row {row.sourceRowNumber}</div>
                              </td>
                              <td>{row.phoneLabel || "No phone"}</td>
                              <td>{row.addressLabel || row.profileLabel || "No address in this export"}</td>
                              <td>
                                <strong>{row.ownerLabel || row.bdcAssignedTo || "Unassigned"}</strong>
                                <div className="table-subline">
                                  {[row.sourceLabel, row.marketingLabel, row.vehicleLabel].filter(Boolean).join(" • ") || "No source notes"}
                                </div>
                              </td>
                              <td>
                                <strong>{row.opportunityLabel}</strong>
                                <div className="table-subline">{row.profileEvidence || row.matchContext || "Review profile merge"}</div>
                              </td>
                              <td>{row.sortDateDisplay || "No date found"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="panel empty">No duplicate groups match the current filters.</div>
            )}
          </div>

          <div className="panel crm-cleanup-rows">
            <div className="crm-cleanup-rows__header">
              <div>
                <span className="eyebrow">Flagged rows</span>
                <h3>All customer rows that need cleanup review</h3>
                <p className="admin-note">
                  Rows with unresolved issues stay highlighted until every group attached to that row is marked cleaned.
                </p>
              </div>
              <div className="crm-cleanup-rows__legend">
                <span className="crm-cleanup-status is-open">Unresolved</span>
                <span className="crm-cleanup-status is-cleaned">Only cleaned groups left</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="crm-cleanup-table crm-cleanup-table--rows">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Customer</th>
                    <th>Issues</th>
                    <th>Phone / Address</th>
                    <th>Owner / Source</th>
                    <th>Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFlaggedRows.map((row) => {
                    const hasOpenGroup = rowHasOpenGroup(row, cleanedGroupSet);
                    return (
                      <tr key={`flagged-${row.rowId}`} className={hasOpenGroup ? "crm-cleanup-row--open" : "crm-cleanup-row--cleaned"}>
                        <td>
                          <span className={`crm-cleanup-status ${statusClass(!hasOpenGroup ? true : false)}`}>
                            {hasOpenGroup ? "Open" : "Cleaned"}
                          </span>
                        </td>
                        <td>
                          <strong>{row.customerName}</strong>
                          <div className="table-subline">Row {row.sourceRowNumber}</div>
                        </td>
                        <td>{row.issueLabels.join(", ")}</td>
                        <td>{row.phoneLabel || row.addressLabel || row.profileLabel || "No contact details"}</td>
                        <td>
                          <strong>{row.ownerLabel || row.bdcAssignedTo || "Unassigned"}</strong>
                          <div className="table-subline">{[row.sourceLabel, row.vehicleLabel].filter(Boolean).join(" • ") || "No source notes"}</div>
                        </td>
                        <td>{row.sortDateDisplay || "No date found"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="panel empty">
          Upload a CRM export above to build a duplicate review queue for phones, addresses, and merge candidates.
        </div>
      )}
    </section>
  );
}
