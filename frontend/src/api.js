const PUBLIC_API_BASES = ["https://api.bertogden123.com", "https://dealership-tool-api.onrender.com"];

function uniqueBases(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function inferApiBases() {
  if (typeof window === "undefined") {
    return uniqueBases([import.meta.env.VITE_API_BASE || ""]);
  }

  const { hostname, protocol } = window.location;
  const envBase = import.meta.env.VITE_API_BASE || "";

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return uniqueBases([envBase, "http://localhost:8108"]);
  }

  if (hostname === "app.bertogden123.com" || hostname === "bertogden123.com" || hostname === "www.bertogden123.com") {
    return uniqueBases(["https://api.bertogden123.com", "https://dealership-tool-api.onrender.com", envBase]);
  }

  if (hostname === "dealership-tool-web.onrender.com") {
    return uniqueBases(["https://dealership-tool-api.onrender.com", "https://api.bertogden123.com", envBase]);
  }

  const bases = [];
  if (envBase) bases.push(envBase);

  if (hostname.startsWith("app.")) {
    bases.push(`${protocol}//api.${hostname.slice(4)}`);
  }

  bases.push(...PUBLIC_API_BASES);
  return uniqueBases(bases);
}

const API_BASES = inferApiBases();
const API_BASE = API_BASES[0] || "";

function buildUrl(base, path) {
  return `${base}${path}`;
}

async function request(path, { method = "GET", body, headers = {}, timeout = 10000 } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const bases = API_BASES.length ? API_BASES : [""];
  let lastError = null;

  for (let index = 0; index < bases.length; index += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(buildUrl(bases[index], path), {
        method,
        headers: {
          ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const httpError = new Error(`HTTP ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
        if (response.status >= 500 && index < bases.length - 1) {
          lastError = httpError;
          continue;
        }
        throw httpError;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const isNetworkFailure =
        error?.name === "AbortError" ||
        error instanceof TypeError ||
        /Failed to fetch/i.test(String(error?.message || ""));
      if (isNetworkFailure && index < bases.length - 1) {
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("Failed to fetch");
}

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

function adminHeaders(token) {
  return token ? { "x-admin-token": token } : {};
}

export const apiBase = API_BASE;
export const adminLogin = (payload) => request("/api/admin/login", { method: "POST", body: payload });
export const getAdminSession = (token) => request("/api/admin/session", { headers: adminHeaders(token) });
export const getAgentLoopConfig = (token) =>
  request("/api/admin/agent-loops/config", { headers: adminHeaders(token) });
export const getAgentLoopRuns = (token, params = {}) =>
  request(`/api/admin/agent-loops/runs${qs({ limit: params.limit })}`, { headers: adminHeaders(token) });
export const getAgentLoopRun = (token, runId) =>
  request(`/api/admin/agent-loops/runs/${encodeURIComponent(runId)}`, { headers: adminHeaders(token) });
export const createAgentLoopRun = (token, payload) =>
  request("/api/admin/agent-loops/runs", { method: "POST", body: payload, headers: adminHeaders(token), timeout: 120000 });
export const cancelAgentLoopRun = (token, runId) =>
  request(`/api/admin/agent-loops/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: adminHeaders(token),
  });
export const getSalespeople = (params = {}) => request(`/api/salespeople${qs({ include_inactive: params.includeInactive })}`);
export const getAdminSalespeople = (token, params = {}) =>
  request(`/api/admin/salespeople${qs({ include_inactive: params.includeInactive })}`, { headers: adminHeaders(token) });
export const getNotificationConfig = (token) =>
  request("/api/admin/notifications/config", { headers: adminHeaders(token) });
export const sendNotificationTestSms = (token, payload) =>
  request("/api/admin/notifications/test-sms", { method: "POST", body: payload, headers: adminHeaders(token) });
export const sendNotificationTestEmail = (token, payload) =>
  request("/api/admin/notifications/test-email", { method: "POST", body: payload, headers: adminHeaders(token) });
export const getFreshUpLog = (params = {}) =>
  request(`/api/freshup/log${qs({ salesperson_id: params.salespersonId, limit: params.limit })}`);
export const getFreshUpLinks = () => request("/api/freshup/links");
export const getFreshUpAnalytics = (token, params = {}) =>
  request(`/api/admin/freshup/analytics${qs({ days: params.days, salesperson_id: params.salespersonId })}`, {
    headers: adminHeaders(token),
  });
export const createFreshUpAnalytics = (payload) => request("/api/freshup/analytics", { method: "POST", body: payload });
export const createFreshUpLog = (payload) => request("/api/freshup/log", { method: "POST", body: payload });
export const updateFreshUpLinks = (token, payload) =>
  request("/api/admin/freshup/links", { method: "POST", body: payload, headers: adminHeaders(token) });
export const createSalesperson = (token, payload) =>
  request("/api/admin/salespeople", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateSalesperson = (token, id, payload) =>
  request(`/api/admin/salespeople/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const getAdminDaysOff = (token, { month }) =>
  request(`/api/admin/days-off${qs({ month })}`, { headers: adminHeaders(token) });
export const updateAdminDaysOff = (token, payload) =>
  request("/api/admin/days-off", { method: "PUT", body: payload, headers: adminHeaders(token) });
export const replaceAdminDaysOffMonth = (token, payload) =>
  request("/api/admin/days-off/bulk", { method: "PUT", body: payload, headers: adminHeaders(token) });
export const getBdcAgents = (params = {}) => request(`/api/bdc/agents${qs({ include_inactive: params.includeInactive })}`);
export const createBdcAgent = (token, payload) =>
  request("/api/admin/bdc/agents", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateBdcAgent = (token, id, payload) =>
  request(`/api/admin/bdc/agents/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const updateBdcDistribution = (token, payload) =>
  request("/api/admin/bdc/distribution", { method: "POST", body: payload, headers: adminHeaders(token) });
export const getBdcLeadPushConfig = (token) =>
  request("/api/admin/bdc/lead-push", { headers: adminHeaders(token) });
export const updateBdcLeadPushConfig = (token, payload) =>
  request("/api/admin/bdc/lead-push", { method: "POST", body: payload, headers: adminHeaders(token) });
export const undoLastBdcAssign = (payload) =>
  request("/api/bdc/assign/last", { method: "DELETE", body: payload });
export const updateBdcUndoSettings = (token, payload) =>
  request("/api/admin/bdc/undo/settings", { method: "POST", body: payload, headers: adminHeaders(token) });
export const getServiceDrive = ({ month } = {}) => request(`/api/service-drive${qs({ month })}`);
export const getServiceDriveTraffic = (params = {}) =>
  request(`/api/service-drive/traffic${qs({
    month: params.month,
    traffic_date: params.trafficDate,
  })}`);
export const getTrafficPdfs = () => request("/api/traffic/pdfs");
export const getSpecials = () => request("/api/specials");
export const updateSpecialsConfig = (token, payload) =>
  request("/api/admin/specials/config", { method: "POST", body: payload, headers: adminHeaders(token) });
export const importSpecialFeed = (token, payload) =>
  request("/api/admin/specials/import-feed", { method: "POST", body: payload, headers: adminHeaders(token), timeout: 60000 });
export const getQuoteRates = () => request("/api/quote/rates");
export const getMarketplaceTemplate = () => request("/api/marketplace/template");
export const getBdcDistribution = () => request("/api/bdc/distribution");
export const getBdcUndoSettings = () => request("/api/bdc/undo/settings");
export const getTabVisibility = () => request("/api/tabs/visibility");
export const getServiceDriveNotes = (params = {}) =>
  request(`/api/service-drive/notes${qs({
    salesperson_id: params.salespersonId,
    start_date: params.startDate,
    end_date: params.endDate,
    brand: params.brand,
    limit: params.limit,
  })}`);
export const generateServiceDrive = (token, payload) =>
  request("/api/admin/service-drive/generate", { method: "POST", body: payload, headers: adminHeaders(token) });
export const createServiceDriveTraffic = (token, payload) =>
  request("/api/admin/service-drive/traffic", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateServiceDriveTraffic = (token, id, payload) =>
  request(`/api/admin/service-drive/traffic/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const deleteServiceDriveTrafficDay = (token, trafficDate) =>
  request(`/api/admin/service-drive/traffic/day/${encodeURIComponent(trafficDate)}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
export const importReynoldsServiceDriveTraffic = (token, formData) =>
  request("/api/admin/service-drive/traffic/import/reynolds", {
    method: "POST",
    body: formData,
    headers: adminHeaders(token),
    timeout: 60000,
  });
export const undoReynoldsServiceDriveTrafficImport = (token) =>
  request("/api/admin/service-drive/traffic/import/reynolds", {
    method: "DELETE",
    headers: adminHeaders(token),
  });
export const importMastermindServiceDriveTraffic = (token, formData) =>
  request("/api/admin/service-drive/traffic/import/mastermind", {
    method: "POST",
    body: formData,
    headers: adminHeaders(token),
    timeout: 60000,
  });
export const undoMastermindServiceDriveTrafficImport = (token) =>
  request("/api/admin/service-drive/traffic/import/mastermind", {
    method: "DELETE",
    headers: adminHeaders(token),
  });
export const uploadServiceDriveTrafficImages = (token, id, formData) =>
  request(`/api/admin/service-drive/traffic/${id}/images`, {
    method: "POST",
    body: formData,
    headers: adminHeaders(token),
    timeout: 60000,
  });
export const createTrafficPdf = (token, formData) =>
  request("/api/admin/traffic/pdfs", { method: "POST", body: formData, headers: adminHeaders(token), timeout: 60000 });
export const createSpecial = (token, formData) =>
  request("/api/admin/specials", { method: "POST", body: formData, headers: adminHeaders(token), timeout: 60000 });
export const updateSpecial = (token, id, formData) =>
  request(`/api/admin/specials/${id}`, { method: "PUT", body: formData, headers: adminHeaders(token), timeout: 60000 });
export const updateQuoteRates = (token, payload) =>
  request("/api/admin/quote/rates", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateMarketplaceTemplate = (token, payload) =>
  request("/api/admin/marketplace/template", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateTabVisibility = (token, payload) =>
  request("/api/admin/tabs/visibility", { method: "POST", body: payload, headers: adminHeaders(token) });
export const createServiceDriveNote = (token, payload) =>
  request("/api/admin/service-drive/notes", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateServiceDriveNote = (token, id, payload) =>
  request(`/api/admin/service-drive/notes/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const updateServiceDriveAssignment = (token, payload) =>
  request("/api/admin/service-drive/assignment", { method: "PUT", body: payload, headers: adminHeaders(token) });
export const updateServiceDriveSalesNote = (id, payload) =>
  request(`/api/service-drive/notes/${id}/sales`, { method: "PUT", body: payload });
export const updateServiceDriveTrafficSales = (id, payload) =>
  request(`/api/service-drive/traffic/${id}/sales`, { method: "PUT", body: payload });
export const getBdcState = (params = {}) =>
  request(`/api/bdc/state${qs({
    dealership: params.dealership,
  })}`);
export const assignBdcLead = (payload) => request("/api/bdc/assign", { method: "POST", body: payload });
export const getBdcLog = (params = {}) =>
  request(`/api/bdc/log${qs({
    salesperson_id: params.salespersonId,
    lead_store: params.leadStore,
    start_date: params.startDate,
    end_date: params.endDate,
    limit: params.limit,
  })}`);
export const getBdcReport = (params = {}) =>
  request(`/api/bdc/report${qs({
    salesperson_id: params.salespersonId,
    lead_store: params.leadStore,
    start_date: params.startDate,
    end_date: params.endDate,
  })}`);
export const importSpecialFeedSource = (token, sourceKey) =>
  request(`/api/admin/specials/import-source/${encodeURIComponent(sourceKey)}`, {
    method: "POST",
    headers: adminHeaders(token),
    timeout: 120000,
  });
export const getBdcSalesTracker = (params = {}) =>
  request(`/api/bdc-sales-tracker${qs({ month: params.month })}`);
export const getSalesAnalyticsDashboard = (params = {}) =>
  request(`/api/sales-analytics/dashboard${qs({ limit: params.limit, variant: params.variant })}`, {
    headers: adminHeaders(params.token),
  });
export const runSalesAnalyticsReport = (params = {}) =>
  request(`/api/sales-analytics/run${qs({ variant: params.variant })}`, {
    method: "POST",
    headers: adminHeaders(params.token),
    timeout: 20000,
  });
export const updateBdcSalesTrackerMonth = (token, payload) =>
  request("/api/bdc-sales-tracker/month", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateBdcSalesTrackerRules = (token, payload) =>
  request("/api/bdc-sales-tracker/rules", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateBdcSalesTrackerAgentMetrics = (token, agentId, payload) =>
  request(`/api/bdc-sales-tracker/agents/${encodeURIComponent(agentId)}/metrics`, {
    method: "POST",
    body: payload,
    headers: adminHeaders(token),
  });
export const createBdcSalesTrackerEntry = (payload) =>
  request("/api/bdc-sales-tracker/entries", { method: "POST", body: payload });
export const updateBdcSalesTrackerEntry = (entryId, payload) =>
  request(`/api/bdc-sales-tracker/entries/${encodeURIComponent(entryId)}`, { method: "PUT", body: payload });
export const deleteBdcSalesTrackerEntry = (entryId) =>
  request(`/api/bdc-sales-tracker/entries/${encodeURIComponent(entryId)}`, { method: "DELETE" });
export const createBdcSalesTrackerDmsLogEntry = (payload) =>
  request("/api/bdc-sales-tracker/dms-log", { method: "POST", body: payload });
export const updateBdcSalesTrackerDmsLogEntry = (entryId, payload) =>
  request(`/api/bdc-sales-tracker/dms-log/${encodeURIComponent(entryId)}`, { method: "PUT", body: payload });
export const markBdcSalesTrackerDmsLogEntrySold = (entryId) =>
  request(`/api/bdc-sales-tracker/dms-log/${encodeURIComponent(entryId)}/sold`, { method: "POST" });
export const deleteBdcSalesTrackerDmsLogEntry = (entryId) =>
  request(`/api/bdc-sales-tracker/dms-log/${encodeURIComponent(entryId)}`, { method: "DELETE" });
export const updateBdcSalesTrackerFocusNote = (payload) =>
  request("/api/bdc-sales-tracker/focus-note", { method: "POST", body: payload });
export const clearBdcHistory = (token) =>
  request("/api/admin/bdc/history", { method: "DELETE", headers: adminHeaders(token) });
