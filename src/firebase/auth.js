import { signInAnonymously } from "firebase/auth";
import { auth } from "./config.js";

let pending;
export function ensureAnonymousUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (pending) return pending;
  pending = (async () => {
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    return (await signInAnonymously(auth)).user;
  })().finally(() => { pending = null; });
  return pending;
}
