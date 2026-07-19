import { describe, expect, it } from "vitest";
import { CLASSROOM_TTL_MS, classroomExpiresAt, formatClassroomRemaining, isClassroomExpired } from "../src/utils/classroomExpiration.js";

describe("課程 48 小時到期", () => {
  it("從建立時間推算舊課程到期時間", () => {
    expect(classroomExpiresAt({ createdAt: 1_000 })).toBe(1_000 + CLASSROOM_TTL_MS);
  });

  it("優先採用固定 expiresAt", () => {
    expect(classroomExpiresAt({ createdAt: 1_000, expiresAt: 2_000 })).toBe(2_000);
    expect(isClassroomExpired({ expiresAt: 2_000 }, 2_000)).toBe(true);
  });

  it("以小時與分鐘顯示剩餘時間", () => {
    expect(formatClassroomRemaining({ expiresAt: 3_661_000 }, 1_000)).toBe("1 小時 1 分鐘");
    expect(formatClassroomRemaining({ expiresAt: 50_000 }, 1_000)).toBe("不到 1 分鐘");
    expect(formatClassroomRemaining({ expiresAt: 1_000 }, 1_000)).toBe("已到期");
  });
});
