import { describe, expect, it } from "vitest";
import { countActiveClassrooms, isActiveClassroom } from "../src/utils/classroomStats.js";

describe("首頁進行中課程統計", () => {
  it("只計算狀態為進行中且尚未到期的課程", () => {
    const now = Date.now();
    const classrooms = [
      { status: "active", expiresAt: now + 60_000 },
      { status: "closed", expiresAt: now + 60_000 },
      { status: "active", expiresAt: now - 1 }
    ];
    expect(countActiveClassrooms(classrooms)).toBe(1);
    expect(isActiveClassroom(classrooms[0])).toBe(true);
    expect(isActiveClassroom(classrooms[1])).toBe(false);
    expect(isActiveClassroom(classrooms[2])).toBe(false);
  });
});
