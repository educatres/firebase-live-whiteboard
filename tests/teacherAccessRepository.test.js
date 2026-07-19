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

import { claimTeacherInvite, claimTeacherKey, createTeacherInvite, ensureTeacherAccessKey, getTeacherAccessKey } from "../src/firebase/teacherAccessRepository.js";

describe("跨裝置老師授權", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.get.mockResolvedValue({ val: () => null });
    databaseMocks.set.mockResolvedValue();
    databaseMocks.update.mockResolvedValue();
  });

  it("建立 10 分鐘有效的單次邀請", async () => {
    const before = Date.now();
    const invite = await createTeacherInvite("class-1", "teacher-1");
    const changes = databaseMocks.update.mock.calls[0][1];
    const saved = changes[`teacherInvites/${invite.token}`];

    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(saved).toMatchObject({ classId: "class-1", createdBy: "teacher-1" });
    expect(saved.expiresAt - saved.createdAt).toBe(10 * 60 * 1000);
    expect(saved.createdAt).toBeGreaterThanOrEqual(before);
    expect(changes[`classes/class-1/teacherInviteTokens/${invite.token}`]).toBe(true);
  });

  it("建立或讀取六位數老師密鑰", async () => {
    databaseMocks.runTransaction.mockResolvedValue({ snapshot: { val: () => "012345" } });

    await expect(ensureTeacherAccessKey("class-1")).resolves.toBe("012345");
    expect(databaseMocks.runTransaction).toHaveBeenCalledWith("teacherKeys/class-1", expect.any(Function), { applyLocally: false });
  });

  it("讀取目前老師有權管理課程的六位數密鑰", async () => {
    databaseMocks.get.mockResolvedValueOnce({ val: () => "012345" });
    await expect(getTeacherAccessKey("class-1")).resolves.toBe("012345");
    expect(databaseMocks.get).toHaveBeenCalledWith("teacherKeys/class-1");
  });

  it("使用正確六位數密鑰取得相同管理權限", async () => {
    await claimTeacherKey("class-1", "012345", "teacher-2");

    expect(databaseMocks.set).toHaveBeenNthCalledWith(1, "teacherKeyClaims/class-1/teacher-2", "012345");
    expect(databaseMocks.set).toHaveBeenNthCalledWith(2, "classes/class-1/admins/teacher-2", true);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(3, "userClasses/teacher-2/class-1", true);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(4, "teacherKeyClaims/class-1/teacher-2", null);
    expect(databaseMocks.get).not.toHaveBeenCalled();
    expect(databaseMocks.runTransaction).not.toHaveBeenCalled();
    expect(databaseMocks.set.mock.calls.some(([path]) => path.startsWith("teacherSlots/"))).toBe(false);
  });

  it("拒絕格式錯誤或不正確的老師密鑰", async () => {
    await expect(claimTeacherKey("class-1", "12345", "teacher-2")).rejects.toThrow("六位數");
    databaseMocks.set.mockRejectedValueOnce(new Error("PERMISSION_DENIED"));
    await expect(claimTeacherKey("class-1", "999999", "teacher-2")).rejects.toThrow("密鑰錯誤");
  });

  it("取得邀請後將新 UID 加入課堂管理員", async () => {
    const token = "ABCDEFGHJKLMNPQRSTUVWX23";
    databaseMocks.get.mockImplementation(async (path) => ({ val: () => path.startsWith("teacherInvites/") ? { classId: "class-1", expiresAt: Date.now() + 600000 } : {} }));
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
      [`teacherInvites/${token}`]: null,
      [`classes/class-1/teacherInviteTokens/${token}`]: null
    });
  });

});
