import { get, onChildAdded, onChildChanged, onChildRemoved, onValue, push, ref, remove, set, update } from "firebase/database";
import { database } from "./config.js";

export function subscribeLayer(token, layer, handlers) {
  const target = ref(database, `boards/${token}/${layer}`);
  const offs = [onChildAdded(target, (s) => handlers.add(s.key, s.val())), onChildRemoved(target, (s) => handlers.remove(s.key))];
  if (handlers.change) offs.push(onChildChanged(target, (s) => handlers.change(s.key, s.val())));
  return () => offs.forEach((off) => off());
}
export async function saveStroke(token, layer, stroke) {
  await set(ref(database, `boards/${token}/${layer}/${stroke.id}`), stroke);
  await update(ref(database, `boards/${token}/meta`), { updatedAt: Date.now(), revision: Date.now() });
}
export async function removeStroke(token, layer, id) { await remove(ref(database, `boards/${token}/${layer}/${id}`)); }
export async function clearLayer(token, layer) { await remove(ref(database, `boards/${token}/${layer}`)); }
export async function publishActive(token, layer, uid, stroke) { await set(ref(database, `activeStrokes/${token}/${layer}/${uid}`), stroke); }
export async function clearActive(token, layer, uid) { await remove(ref(database, `activeStrokes/${token}/${layer}/${uid}`)); }
export function watchActive(token, layer, callback) { return onValue(ref(database, `activeStrokes/${token}/${layer}`), (snap) => callback(snap.val() || {})); }
export async function hasAnswers(token) { return (await get(ref(database, `boards/${token}/studentStrokes`))).exists(); }
export async function createStickyNote(token, note) {
  const target = push(ref(database, `boards/${token}/stickyNotes`));
  const now = Date.now();
  await set(target, { ...note, id: target.key, text: note.text || "", createdAt: now, updatedAt: now });
  return target.key;
}
export async function updateStickyNote(token, id, patch) { await update(ref(database, `boards/${token}/stickyNotes/${id}`), { ...patch, updatedAt: Date.now() }); }
export async function removeStickyNote(token, id) { await remove(ref(database, `boards/${token}/stickyNotes/${id}`)); }
export function subscribeStickyNotes(token, handlers) { return subscribeLayer(token, "stickyNotes", handlers); }
