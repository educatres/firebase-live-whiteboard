import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "./config.js";

let pending;
export function ensureAnonymousUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, async (user) => {
      if (user) { off(); resolve(user); return; }
      try { await signInAnonymously(auth); }
      catch (error) { off(); reject(error); }
    }, reject);
  }).finally(() => { pending = null; });
  return pending;
}
