import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn((_database, path = "") => path),
  runTransaction: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
}));

vi.mock("firebase/database", () => databaseMocks);
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

import { claimTeacherInvite, createTeacherInvite } from "../src/firebase/teacherAccessRepository.js";

describe("跨裝置老師授權", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.set.mockResolvedValue();
    databaseMocks.update.mockResolvedValue();
  });

  it("建立 10 分鐘有效的單次邀請", async () => {
    const before = Date.now();
    const invite = await createTeacherInvite("class-1", "teacher-1");
    const saved = databaseMocks.set.mock.calls[0][1];

    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(saved).toMatchObject({ classId: "class-1", createdBy: "teacher-1" });
    expect(saved.expiresAt - saved.createdAt).toBe(10 * 60 * 1000);
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
  });

  it("取得邀請後將新 UID 加入課堂管理員", async () => {
    const token = "ABCDEFGHJKLMNPQRSTUVWX23";
    databaseMocks.get.mockResolvedValue({ val: () => ({ classId: "class-1", expiresAt: Date.now() + 600000 }) });
    databaseMocks.runTransaction.mockImplementation(async (_target, updateClaim) => {
      expect(updateClaim(null)).toBe("monitor-1");
      return { committed: true, snapshot: { val: () => "monitor-1" } };
    });

    await claimTeacherInvite("class-1", token, "monitor-1");

    expect(databaseMocks.set).toHaveBeenNthCalledWith(1, "teacherClaims/class-1/monitor-1", token);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(2, "classes/class-1/admins/monitor-1", true);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(3, "userClasses/monitor-1/class-1", true);
    expect(databaseMocks.update).toHaveBeenCalledWith("", {
      "teacherClaims/class-1/monitor-1": null,
      [`teacherInvites/${token}`]: null
    });
  });
});
