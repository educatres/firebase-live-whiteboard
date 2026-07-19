import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetTeacherSession, readTeacherSession, rememberTeacherSession } from "../src/teacher/localSession.js";

describe("老師課堂本機暫存", () => {
  let values;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("依課堂保存與讀取同一個老師 UID", () => {
    rememberTeacherSession("class-1", "teacher-1");
    expect(readTeacherSession("class-1")).toMatchObject({ uid: "teacher-1" });
    expect(readTeacherSession("class-2")).toBeNull();
  });

  it("刪除課堂後清除本機暫存", () => {
    rememberTeacherSession("class-1", "teacher-1");
    forgetTeacherSession("class-1");
    expect(readTeacherSession("class-1")).toBeNull();
  });
});
