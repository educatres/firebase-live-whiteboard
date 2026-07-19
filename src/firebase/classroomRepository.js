import { get, onValue, ref, remove, set, update } from "firebase/database";
import { database } from "./config.js";
import { randomId } from "../utils/random.js";

export async function createClassroom(uid, values) {
  const classId = randomId(10); const now = Date.now();
  const classroom = { title: values.title.trim(), className: values.className?.trim() || "", activityName: values.activityName?.trim() || "", createdAt: now, updatedAt: now, status: "active", allowStudentWriting: true, allowStudentClear: false, showTeacherAnnotations: true, studentCount: 0, admins: { [uid]: true }, studentOrder: {} };
  await update(ref(database), { [`classes/${classId}`]: classroom, [`userClasses/${uid}/${classId}`]: true });
  await set(ref(database, `teacherSlots/${classId}/1`), uid);
  return classId;
}
export async function listMyClasses(uid) {
  const index = (await get(ref(database, `userClasses/${uid}`))).val() || {};
  const entries = await Promise.all(Object.keys(index).map(async (classId) => [classId, (await get(ref(database, `classes/${classId}`))).val()]));
  return entries.filter(([, value]) => value).map(([id, value]) => ({ id, ...value })).sort((a,b) => b.updatedAt-a.updatedAt);
}
export async function getClassroom(classId) { return (await get(ref(database, `classes/${classId}`))).val(); }
export function watchClassroom(classId, callback) { return onValue(ref(database, `classes/${classId}`), (snap) => callback(snap.val())); }
export async function saveClassroom(classId, values) { await update(ref(database, `classes/${classId}`), { ...values, updatedAt: Date.now() }); }
export async function closeClassroom(classId, closed) { await update(ref(database, `classes/${classId}`), { status: closed ? "closed" : "active", allowStudentWriting: !closed, updatedAt: Date.now() }); }
export async function deleteClassroom(classId, uid, classroom, students) {
  const changes = { [`classes/${classId}`]: null, [`userClasses/${uid}/${classId}`]: null, [`presence/${classId}`]: null, [`teacherSlots/${classId}`]: null };
  for (const student of students) { changes[`students/${student.id}`] = null; changes[`boardLookup/${student.boardToken}`] = null; changes[`boards/${student.boardToken}`] = null; changes[`activeStrokes/${student.boardToken}`] = null; }
  await update(ref(database), changes);
}
