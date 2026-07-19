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

import { claimTeacherInvite, claimTeacherKey, createTeacherInvite, ensureTeacherAccessKey, resetOtherTeacherDevices } from "../src/firebase/teacherAccessRepository.js";

describe("跨裝置老師授權", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.get.mockImplementation(async (path) => ({ val: () => path.endsWith("/admins") ? { teacher: true } : { 1: "teacher" } }));
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

  it("五台老師裝置已滿時不再產生邀請", async () => {
    databaseMocks.get.mockImplementation(async (path) => ({ val: () => path.endsWith("/admins") ? { a: true, b: true, c: true, d: true, e: true } : { 1: "a", 2: "b", 3: "c", 4: "d", 5: "e" } }));

    await expect(createTeacherInvite("class-1", "teacher-1")).rejects.toThrow("5 台老師裝置上限");
    expect(databaseMocks.set).not.toHaveBeenCalled();
  });

  it("建立或讀取六位數老師密鑰", async () => {
    databaseMocks.runTransaction.mockResolvedValue({ snapshot: { val: () => "012345" } });

    await expect(ensureTeacherAccessKey("class-1")).resolves.toBe("012345");
    expect(databaseMocks.runTransaction).toHaveBeenCalledWith("teacherKeys/class-1", expect.any(Function), { applyLocally: false });
  });

  it("使用正確六位數密鑰取得相同管理權限", async () => {
    databaseMocks.get.mockResolvedValue({ val: () => ({ 1: "teacher-1" }) });
    databaseMocks.runTransaction.mockImplementation(async (_target, updateSlot) => ({ snapshot: { val: () => updateSlot(null) } }));

    await claimTeacherKey("class-1", "012345", "teacher-2");

    expect(databaseMocks.set).toHaveBeenNthCalledWith(1, "teacherKeyClaims/class-1/teacher-2", "012345");
    expect(databaseMocks.set).toHaveBeenNthCalledWith(2, "classes/class-1/admins/teacher-2", true);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(3, "userClasses/teacher-2/class-1", true);
    expect(databaseMocks.set).toHaveBeenNthCalledWith(4, "teacherKeyClaims/class-1/teacher-2", null);
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
      [`teacherInvites/${token}`]: null
    });
  });

  it("保留目前裝置並一次解除其他老師裝置", async () => {
    databaseMocks.get.mockImplementation(async (path) => ({ val: () => {
      if (path.endsWith("/admins")) return { "teacher-1": true, "monitor-1": true, "monitor-2": true };
      if (path.startsWith("teacherSlots/")) return { 1: "teacher-1", 2: "monitor-1", 3: "monitor-2" };
      return { "monitor-2": "ABCDEFGHJKLMNPQRSTUVWX23" };
    } }));

    await expect(resetOtherTeacherDevices("class-1", "teacher-1")).resolves.toBe(2);
    expect(databaseMocks.update).toHaveBeenCalledWith("", expect.objectContaining({
      "classes/class-1/admins/monitor-1": null,
      "classes/class-1/admins/monitor-2": null,
      "userClasses/monitor-1/class-1": null,
      "userClasses/monitor-2/class-1": null,
      "teacherSlots/class-1/2": null,
      "teacherSlots/class-1/3": null,
      "teacherClaims/class-1/monitor-2": null,
      "teacherInvites/ABCDEFGHJKLMNPQRSTUVWX23": null
    }));
  });
});
