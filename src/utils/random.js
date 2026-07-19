const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function randomId(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (value) => ALPHABET[value % ALPHABET.length]).join("");
}
export function boardToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export function teacherAccessKey() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(Math.floor((value / 2 ** 32) * 1_000_000)).padStart(6, "0");
}
export function strokeId() { return `stroke_${Date.now()}_${randomId(7)}`; }
