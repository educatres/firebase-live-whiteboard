const STORAGE_KEY = "classpad.classroomHistory.v1";

function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function readClassroomHistory(storage = browserStorage()) {
  if (!storage) return {};
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function writeClassroomHistory(history, storage) {
  if (!storage) return;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(history)); }
  catch { /* Safari 私密瀏覽或空間不足時不阻擋課堂操作。 */ }
}

export function recordClassroomCreated(classId, createdAt = Date.now(), storage = browserStorage()) {
  if (!classId) return;
  const history = readClassroomHistory(storage), current = history[classId];
  history[classId] = { createdAt: Number(current?.createdAt) || Number(createdAt) || Date.now(), ...(current?.deletedAt ? { deletedAt: current.deletedAt } : {}) };
  writeClassroomHistory(history, storage);
}

export function recordClassroomDeleted(classId, deletedAt = Date.now(), storage = browserStorage()) {
  if (!classId) return;
  const history = readClassroomHistory(storage), current = history[classId];
  history[classId] = { createdAt: Number(current?.createdAt) || Number(deletedAt) || Date.now(), deletedAt: Number(deletedAt) || Date.now() };
  writeClassroomHistory(history, storage);
}

export function rememberVisibleClassrooms(classrooms = [], storage = browserStorage()) {
  for (const classroom of classrooms) recordClassroomCreated(classroom?.id, classroom?.createdAt, storage);
}

export function classroomHistoryStats(storage = browserStorage()) {
  const entries = Object.values(readClassroomHistory(storage));
  return { created: entries.length, deleted: entries.filter((entry) => Number(entry?.deletedAt) > 0).length };
}
