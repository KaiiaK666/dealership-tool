const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "http://localhost:8108" : "");

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function request(path, { method = "GET", body, headers = {}, timeout = 10000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
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
export const getSalespeople = (params = {}) => request(`/api/salespeople${qs({ include_inactive: params.includeInactive })}`);
export const createSalesperson = (token, payload) =>
  request("/api/admin/salespeople", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateSalesperson = (token, id, payload) =>
  request(`/api/admin/salespeople/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const getBdcAgents = (params = {}) => request(`/api/bdc/agents${qs({ include_inactive: params.includeInactive })}`);
export const createBdcAgent = (token, payload) =>
  request("/api/admin/bdc/agents", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateBdcAgent = (token, id, payload) =>
  request(`/api/admin/bdc/agents/${id}`, { method: "PUT", body: payload, headers: adminHeaders(token) });
export const getServiceDrive = ({ month } = {}) => request(`/api/service-drive${qs({ month })}`);
export const generateServiceDrive = (token, payload) =>
  request("/api/admin/service-drive/generate", { method: "POST", body: payload, headers: adminHeaders(token) });
export const updateServiceDriveAssignment = (token, payload) =>
  request("/api/admin/service-drive/assignment", { method: "PUT", body: payload, headers: adminHeaders(token) });
export const getBdcState = () => request("/api/bdc/state");
export const assignBdcLead = (payload) => request("/api/bdc/assign", { method: "POST", body: payload });
export const getBdcLog = (params = {}) =>
  request(`/api/bdc/log${qs({
    salesperson_id: params.salespersonId,
    start_date: params.startDate,
    end_date: params.endDate,
    limit: params.limit,
  })}`);
export const getBdcReport = (params = {}) =>
  request(`/api/bdc/report${qs({
    salesperson_id: params.salespersonId,
    start_date: params.startDate,
    end_date: params.endDate,
  })}`);
