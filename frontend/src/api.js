function inferApiBase() {
  if (typeof window === "undefined") {
    return import.meta.env.VITE_API_BASE || "";
  }

  const { hostname, protocol } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return import.meta.env.VITE_API_BASE || "http://localhost:8108";
  }

  if (hostname === "app.bertogden123.com") {
    return "https://api.bertogden123.com";
  }

  if (hostname === "dealership-tool-web.onrender.com") {
    return "https://dealership-tool-api.onrender.com";
  }

  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  if (hostname.startsWith("app.")) {
    return `${protocol}//api.${hostname.slice(4)}`;
  }

  return "";
}

const API_BASE = inferApiBase();

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

async function request(path, { method = "GET", body, headers = {}, timeout = 10000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    const response = await fetch(buildUrl(path), {
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
export const getServiceDrive = ({ month } = {}) => request(`/api/service-drive${qs({ month })}`);
export const getServiceDriveTraffic = (params = {}) =>
  request(`/api/service-drive/traffic${qs({
    month: params.month,
    traffic_date: params.trafficDate,
  })}`);
export const getTrafficPdfs = () => request("/api/traffic/pdfs");
export const getSpecials = () => request("/api/specials");
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
