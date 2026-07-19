import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  get: vi.fn(), onValue: vi.fn(), ref: vi.fn((_database, path = "") => path), remove: vi.fn(), set: vi.fn(), update: vi.fn()
}));

vi.mock("firebase/database", () => databaseMocks);
vi.mock("../src/firebase/config.js", () => ({ database: {} }));
vi.mock("../src/utils/random.js", () => ({ randomId: () => "class-1", teacherAccessKey: () => "123456" }));

import { cleanupExpiredClassroom, createClassroom, getClassroomExpiresAt } from "../src/firebase/classroomRepository.js";
import { CLASSROOM_TTL_MS } from "../src/utils/classroomExpiration.js";

describe("課程建立與到期清理", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.set.mockResolvedValue();
    databaseMocks.update.mockResolvedValue();
    databaseMocks.get.mockResolvedValue({ val: () => 0 });
  });

  it("建立時寫入 48 小時後的固定到期時間", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    await createClassroom("teacher", { title: "數學課" });
    const classroom = databaseMocks.update.mock.calls[0][1]["classes/class-1"];
    expect(classroom.expiresAt).toBe(1_000_000 + CLASSROOM_TTL_MS);
    vi.restoreAllMocks();
  });

  it("舊課程沒有 expiresAt 時從 createdAt 推算", async () => {
    databaseMocks.get.mockResolvedValueOnce({ val: () => null }).mockResolvedValueOnce({ val: () => 5_000 });
    await expect(getClassroomExpiresAt("class-1")).resolves.toBe(5_000 + CLASSROOM_TTL_MS);
  });

  it("到期後清除課程與所有主要關聯資料", async () => {
    const classroom = { expiresAt: 1, admins: { teacher: true }, displayToken: "display-token", teacherInviteTokens: { "invite-token": true }, studentOrder: { student: 0 } };
    const students = [{ id: "student", boardToken: "board-token" }];
    await expect(cleanupExpiredClassroom("class-1", "teacher", classroom, students)).resolves.toBe(true);
    const changes = databaseMocks.update.mock.calls[0][1];
    expect(changes).toMatchObject({
      "classes/class-1": null,
      "students/student": null,
      "boards/board-token": null,
      "boardPages/board-token": null,
      "teacherClaims/class-1": null,
      "teacherInvites/invite-token": null,
      "displays/display-token": null
    });
  });

  it("未到期時不執行清理", async () => {
    await expect(cleanupExpiredClassroom("class-1", "teacher", { expiresAt: Date.now() + 60_000 })).resolves.toBe(false);
    expect(databaseMocks.update).not.toHaveBeenCalled();
  });
});
