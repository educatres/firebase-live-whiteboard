import { onDisconnect, onValue, ref, serverTimestamp, update } from "firebase/database";
import { database } from "./config.js";

export async function startPresence(classId, studentId, uid, currentPageId = "main") {
  const target = ref(database, `presence/${classId}/${studentId}`);
  try { await update(target, { uid, online: false, drawing: false, currentPageId, lastSeen: Date.now() }); }
  catch (error) { error.message = `建立在線狀態資料失敗：${error.message}`; throw error; }
  try { await onDisconnect(target).update({ uid, online: false, drawing: false, lastSeen: Date.now() }); }
  catch (error) { error.message = `註冊離線狀態失敗：${error.message}`; throw error; }
  try { await update(target, { online: true, lastSeen: Date.now() }); }
  catch (error) { error.message = `寫入在線狀態失敗：${error.message}`; throw error; }
  const heartbeat = setInterval(() => update(target, { online: true, lastSeen: Date.now() }), 30000);
  return () => { clearInterval(heartbeat); update(target, { online: false, drawing: false, lastSeen: Date.now() }); };
}
export async function setDrawing(classId, studentId, drawing, pageId) {
  const values = { drawing, lastSeen: Date.now() };
  if (pageId) values.currentPageId = pageId;
  if (drawing && pageId) { values.lastWrittenPageId = pageId; values.lastWrittenAt = serverTimestamp(); }
  await update(ref(database, `presence/${classId}/${studentId}`), values);
}
export async function setPresencePage(classId, studentId, pageId) { await update(ref(database, `presence/${classId}/${studentId}`), { currentPageId: pageId, drawing: false, lastSeen: Date.now() }); }
export function watchPresence(classId, callback) { return onValue(ref(database, `presence/${classId}`), (snap) => callback(snap.val() || {})); }
