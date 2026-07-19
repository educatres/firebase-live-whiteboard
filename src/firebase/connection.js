import { onValue, ref } from "firebase/database";
import { database } from "./config.js";
import { setServerTimeOffset } from "../utils/classroomExpiration.js";

export function watchServerTimeOffset() {
  return onValue(ref(database, ".info/serverTimeOffset"), (snapshot) => setServerTimeOffset(snapshot.val()));
}

export function watchConnection(element) {
  const stopConnection = onValue(ref(database, ".info/connected"), (snapshot) => {
    const online = snapshot.val() === true;
    element.textContent = online ? "Firebase 已連線" : "Firebase 離線";
    element.className = `badge ${online ? "online" : "offline"}`;
  });
  const stopOffset = watchServerTimeOffset();
  return () => { stopConnection(); stopOffset(); };
}
