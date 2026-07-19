import { onDisconnect, onValue, ref, update } from "firebase/database";
import { database } from "./config.js";

export async function startPresence(classId, studentId, uid, currentPageId = "main") {
  const target = ref(database, `presence/${classId}/${studentId}`);
  await onDisconnect(target).update({ uid, online: false, drawing: false, lastSeen: Date.now() });
  await update(target, { uid, online: true, drawing: false, currentPageId, lastSeen: Date.now() });
  const heartbeat = setInterval(() => update(target, { online: true, lastSeen: Date.now() }), 30000);
  return () => { clearInterval(heartbeat); update(target, { online: false, drawing: false, lastSeen: Date.now() }); };
}
export async function setDrawing(classId, studentId, drawing, pageId) {
  const values = { drawing, lastSeen: Date.now() };
  if (pageId) values.currentPageId = pageId;
  if (drawing && pageId) values.lastWrittenPageId = pageId;
  await update(ref(database, `presence/${classId}/${studentId}`), values);
}
export async function setPresencePage(classId, studentId, pageId) { await update(ref(database, `presence/${classId}/${studentId}`), { currentPageId: pageId, drawing: false, lastSeen: Date.now() }); }
export function watchPresence(classId, callback) { return onValue(ref(database, `presence/${classId}`), (snap) => callback(snap.val() || {})); }
