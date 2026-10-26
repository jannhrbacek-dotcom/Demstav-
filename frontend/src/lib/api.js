import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "demstav:token";
const USER_KEY = "demstav:user";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setSession = (token, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const cachedUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
};
export const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

export const http = axios.create({ baseURL: API, timeout: 30000 });
http.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
http.interceptors.response.use((r) => r, (err) => {
  if (err?.response?.status === 401 && !String(err.config?.url || "").includes("/auth/login") && onUnauthorized) onUnauthorized(err);
  return Promise.reject(err);
});

export function errText(e, fallback = "Něco se nepovedlo. Zkuste to znovu.") {
  const d = e?.response?.data?.detail;
  if (!e?.response) return "Bez připojení k serveru.";
  if (d == null) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (typeof d === "object") return d.errors ? d.errors.join(" ") : d.message || fallback;
  return String(d);
}

export async function downloadFile(path, filename) {
  const res = await http.get(path, { responseType: "blob", timeout: 120000 });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
