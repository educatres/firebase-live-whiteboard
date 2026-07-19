import { describe, expect, it } from "vitest";
import { classroomHistoryStats, readClassroomHistory, recordClassroomCreated, recordClassroomDeleted, rememberVisibleClassrooms } from "../src/utils/classroomStats.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

describe("首頁課程統計", () => {
  it("記錄歷史建立與刪除課程且不重複累計", () => {
    const storage = memoryStorage();
    recordClassroomCreated("class-1", 100, storage);
    recordClassroomCreated("class-1", 200, storage);
    recordClassroomCreated("class-2", 300, storage);
    recordClassroomDeleted("class-1", 400, storage);

    expect(classroomHistoryStats(storage)).toEqual({ created: 2, deleted: 1 });
    expect(readClassroomHistory(storage)["class-1"]).toEqual({ createdAt: 100, deletedAt: 400 });
  });

  it("將目前可見的既有課程補入歷史紀錄", () => {
    const storage = memoryStorage();
    rememberVisibleClassrooms([{ id: "class-1", createdAt: 100 }, { id: "class-2", createdAt: 200 }], storage);
    expect(classroomHistoryStats(storage)).toEqual({ created: 2, deleted: 0 });
  });

  it("本機儲存空間不可用時回傳零且不阻擋操作", () => {
    expect(classroomHistoryStats(null)).toEqual({ created: 0, deleted: 0 });
    expect(() => recordClassroomCreated("class-1", 100, null)).not.toThrow();
  });
});
