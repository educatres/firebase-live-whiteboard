const PREFIX = "classpad-teacher-session:";

function storage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function rememberTeacherSession(classId, uid) {
  if (!classId || !uid) return;
  try { storage()?.setItem(`${PREFIX}${classId}`, JSON.stringify({ uid, savedAt: Date.now() })); } catch {}
}

export function readTeacherSession(classId) {
  try {
    const value = JSON.parse(storage()?.getItem(`${PREFIX}${classId}`) || "null");
    return value && typeof value.uid === "string" ? value : null;
  } catch { return null; }
}

export function forgetTeacherSession(classId) {
  try { storage()?.removeItem(`${PREFIX}${classId}`); } catch {}
}
