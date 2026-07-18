import { onValue, ref } from "firebase/database";
import { database } from "./config.js";

export function watchConnection(element) {
  return onValue(ref(database, ".info/connected"), (snapshot) => {
    const online = snapshot.val() === true;
    element.textContent = online ? "Firebase 已連線" : "Firebase 離線";
    element.className = `badge ${online ? "online" : "offline"}`;
  });
}
