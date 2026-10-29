import { readDeviceLock, validatePin, storageKey } from "./deviceLock";

afterEach(() => localStorage.clear());

test("PIN policy uses six to eight digits and forbids nonnumeric codes", () => {
  expect(validatePin("123456")).toBe(true);
  expect(validatePin("01234567")).toBe(true);
  for (const invalid of ["12345", "123456789", "12 456", "abcdef", "１２３４５６"]) {
    expect(validatePin(invalid)).toBe(false);
  }
});

test("a malformed or unrelated browser lock is never accepted", () => {
  localStorage.setItem(storageKey("user-1"), "invalid JSON");
  expect(readDeviceLock("user-1")).toBeNull();
  localStorage.setItem(storageKey("user-1"), JSON.stringify({version:1,salt:"a".repeat(32),hash:"b".repeat(64)}));
  expect(readDeviceLock("user-1")?.version).toBe(1);
  expect(readDeviceLock("user-2")).toBeNull();
  localStorage.setItem(storageKey("user-2"), JSON.stringify({version:1,salt:"a".repeat(32),hash:"not-a-hash"}));
  expect(readDeviceLock("user-2")).toBeNull();
});
