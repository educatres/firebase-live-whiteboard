import { onDisconnect, onValue, ref, set, update } from "firebase/database";
import { database } from "./config.js";

export async function startPresence(classId, studentId, uid) {
  const target = ref(database, `presence/${classId}/${studentId}`);
  await onDisconnect(target).set({ uid, online: false, drawing: false, lastSeen: Date.now() });
  await set(target, { uid, online: true, drawing: false, lastSeen: Date.now() });
  const heartbeat = setInterval(() => update(target, { online: true, lastSeen: Date.now() }), 30000);
  return () => { clearInterval(heartbeat); update(target, { online: false, drawing: false, lastSeen: Date.now() }); };
}
export async function setDrawing(classId, studentId, drawing) { await update(ref(database, `presence/${classId}/${studentId}`), { drawing, lastSeen: Date.now() }); }
export function watchPresence(classId, callback) { return onValue(ref(database, `presence/${classId}`), (snap) => callback(snap.val() || {})); }
