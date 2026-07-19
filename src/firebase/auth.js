import { browserLocalPersistence, setPersistence, signInAnonymously, signOut } from "firebase/auth";
import { auth } from "./config.js";

let pending;
export function ensureAnonymousUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (pending) return pending;
  pending = (async () => {
    await auth.authStateReady();
    await setPersistence(auth, browserLocalPersistence);
    if (auth.currentUser) return auth.currentUser;
    return (await signInAnonymously(auth)).user;
  })().finally(() => { pending = null; });
  return pending;
}

export function isInvalidAuthTokenError(error) {
  const detail = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return detail.includes("invalid-user-token") || detail.includes("user-token-expired") || detail.includes("invalid token");
}

export async function renewAnonymousUser() {
  await signOut(auth);
  pending = null;
  const user = await ensureAnonymousUser();
  await user.getIdToken?.(true);
  return user;
}

export async function ensureFreshAnonymousUser() {
  const user = await ensureAnonymousUser();
  if (typeof user?.getIdToken !== "function") return user;
  try {
    await user.getIdToken(true);
    return user;
  } catch (error) {
    if (!isInvalidAuthTokenError(error)) throw error;
    return renewAnonymousUser();
  }
}
