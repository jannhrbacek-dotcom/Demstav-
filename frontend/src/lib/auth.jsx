import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { http, setSession, clearSession, cachedUser, getToken, clearToken, setUnauthorizedHandler, errText } from "./api";
import { initSync, resetSync, setNeedsLogin, syncNow } from "./sync";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export const RANK = { employee: 1, manager: 2, admin: 3, owner: 4 };
export const atLeast = (user, role) => (RANK[user?.role] || 0) >= RANK[role];

export function AuthProvider({ children }) {
  // undefined = checking, null = signed out, object = user
  const [user, setUser] = useState(() => (getToken() ? cachedUser() : null));
  const [expired, setExpired] = useState(false);
  const [simpleMode, setSimpleModeState] = useState(() => localStorage.getItem("demstav:simpleMode") === "1");
  const setSimpleMode = useCallback((v) => {
    const next = typeof v === "function" ? v(simpleMode) : !!v;
    localStorage.setItem("demstav:simpleMode", next ? "1" : "0");
    setSimpleModeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("simple-mode", next);
    }
  }, [simpleMode]);

  useEffect(() => {
    setUnauthorizedHandler(() => { setExpired(true); setNeedsLogin(true); });
    if (user?.id) initSync(user.id);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("simple-mode", simpleMode);
    }
    if (getToken()) {
      http.get("/auth/me").then(({ data }) => { setUser(data.user); setSession(null, data.user); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await http.post("/auth/login", { login: email, password });
    const prev = cachedUser();
    if (prev && prev.id !== data.user.id) resetSync();
    setSession(data.access_token, data.user);
    setUser(data.user);
    setExpired(false);
    setNeedsLogin(false);
    await initSync(data.user.id);
    syncNow();
    return data.user;
  }, []);

  const changePassword = useCallback(async (current_password, new_password) => {
    const { data } = await http.post("/auth/change-password", { current_password, new_password });
    setSession(data.access_token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => { clearSession(); resetSync(); setUser(null); setExpired(false); }, []);
  const expireNow = useCallback(() => { clearToken(); setExpired(true); }, []);

  return <Ctx.Provider value={{ user, login, logout, changePassword, expired, setExpired, expireNow, errText, simpleMode, setSimpleMode }}>{children}</Ctx.Provider>;
}
