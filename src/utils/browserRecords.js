function browserStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function clearLegacyClassroomHistory(storage = browserStorage()) {
  if (!storage) return false;
  try { storage.removeItem("classpad.classroomHistory.v1"); return true; }
  catch { return false; }
}

export function clearBrowserRecords(storage = browserStorage()) {
  if (!storage) return false;
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith("classpad")) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
    return true;
  }
  catch { return false; }
}
