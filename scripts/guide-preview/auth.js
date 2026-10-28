import { user } from "./fixtures";
const noop = () => {};
const blocked = async () => { throw new Error("DEMO je pouze ke čtení."); };
export const RANK = { employee: 1, manager: 2, admin: 3, operations_manager: 4, owner: 4 };
export const atLeast = (person, role) => (RANK[person?.role] || 0) >= RANK[role];
const value = { user, simpleMode: false, setSimpleMode: noop, expired: false, setExpired: noop, expireNow: noop, login: blocked, logout: noop, changePassword: blocked };
export const useAuth = () => value;
export const AuthProvider = ({ children }) => children;
