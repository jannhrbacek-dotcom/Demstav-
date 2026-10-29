/* Optional screen lock for a particular employee on a particular browser.
 * Does NOT encrypt IndexedDB, replace account authentication, or protect against
 * a person with developer-tools access to local browser storage.
 */
const PREFIX = "demstav:device-lock:v1:";
export const storageKey = userId => PREFIX + String(userId || "");
export const devicePinSupported = () => !!(globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
export const readDeviceLock = userId => {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey(userId)) || "null");
    return data?.version === 1 && /^[0-9a-f]{32}$/.test(data.salt || "") && /^[0-9a-f]{64}$/.test(data.hash || "") ? data : null;
  } catch (_) { return null; }
};
const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, "0")).join("");
const fromHex = value => new Uint8Array(value.match(/../g).map(pair => parseInt(pair, 16)));
const pinHash = async (pin, salt) => {
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", salt: fromHex(salt), iterations: 210000, hash: "SHA-256"}, raw, 256);
  return hex(new Uint8Array(bits));
};
export const validatePin = pin => /^[0-9]{6,8}$/.test(pin);
export async function enableDeviceLock(userId, pin) {
  if (!devicePinSupported()) throw new Error("Web Crypto unavailable");
  if (!validatePin(pin)) throw new Error("PIN must contain 6 to 8 digits");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pinHash(pin, salt);
  localStorage.setItem(storageKey(userId), JSON.stringify({ version: 1, salt, hash }));
}
export async function verifyDevicePin(userId, pin) {
  const config = readDeviceLock(userId);
  if (!config || !validatePin(pin) || !devicePinSupported()) return false;
  const actual = fromHex(await pinHash(pin, config.salt));
  const expected = fromHex(config.hash);
  let difference = 0;
  for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
  return difference === 0;
}
export async function disableDeviceLock(userId, pin) {
  if (!await verifyDevicePin(userId, pin)) return false;
  localStorage.removeItem(storageKey(userId));
  return true;
}
