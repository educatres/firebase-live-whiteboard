import { get, onValue, ref, remove, runTransaction, set, update } from "firebase/database";
import { database } from "./config.js";
import { boardToken } from "../utils/random.js";

export async function ensureClassDisplay(classId, uid) {
  const tokenResult = await runTransaction(ref(database, `classes/${classId}/displayToken`), (current) => current || boardToken(), { applyLocally: false });
  const token = tokenResult.snapshot.val();
  if (!token) throw new Error("無法建立展示畫面連結。");
  const target = ref(database, `displays/${token}`);
  if (!(await get(target)).exists()) {
    const now = Date.now();
    await set(target, { classId, active: false, updatedAt: now, updatedBy: uid });
  }
  return token;
}

export function watchDisplay(token, callback) {
  return onValue(ref(database, `displays/${token}`), (snapshot) => callback(snapshot.val()));
}

export async function projectDisplay(token, classId, student, pageId, uid, followStudent = false) {
  const now = Date.now();
  const state = {
    classId,
    active: true,
    studentId: student.id,
    boardToken: student.boardToken,
    pageId,
    label: `${student.seatNumber} ${student.displayName}`.trim().slice(0, 100),
    followStudent: Boolean(followStudent),
    updatedAt: now,
    updatedBy: uid
  };
  await set(ref(database, `displays/${token}`), state);
  return state;
}

export async function updateProjectedPage(token, pageId, uid) {
  await update(ref(database, `displays/${token}`), { pageId, updatedAt: Date.now(), updatedBy: uid });
}

export async function stopDisplay(token, classId, uid) {
  await set(ref(database, `displays/${token}`), { classId, active: false, updatedAt: Date.now(), updatedBy: uid });
}

export async function setDisplaySession(uid, displayToken, boardToken) {
  await set(ref(database, `displaySessions/${uid}`), { displayToken, boardToken, updatedAt: Date.now() });
}

export async function clearDisplaySession(uid) {
  await remove(ref(database, `displaySessions/${uid}`));
}
