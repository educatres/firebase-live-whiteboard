import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  get: vi.fn(), onValue: vi.fn(), ref: vi.fn((_database, path = "") => path), remove: vi.fn(), runTransaction: vi.fn(), set: vi.fn(), update: vi.fn()
}));

vi.mock("firebase/database", () => databaseMocks);
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

import { ensureClassDisplay, projectDisplay, stopDisplay } from "../src/firebase/displayRepository.js";

describe("被動展示畫面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.set.mockResolvedValue();
    databaseMocks.get.mockResolvedValue({ exists: () => true });
    databaseMocks.runTransaction.mockResolvedValue({ snapshot: { val: () => "RSTUVWXYZabcdefghjkmnpqr" } });
  });

  it("同一課堂重複使用固定展示 token", async () => {
    await expect(ensureClassDisplay("class-1", "teacher-1")).resolves.toBe("RSTUVWXYZabcdefghjkmnpqr");
    expect(databaseMocks.runTransaction).toHaveBeenCalledWith("classes/class-1/displayToken", expect.any(Function), { applyLocally: false });
    expect(databaseMocks.set).not.toHaveBeenCalled();
  });

  it("投影指定學生頁面並可解除", async () => {
    const student = { id: "student-1", boardToken: "board-token", seatNumber: "01", displayName: "小明" };
    await projectDisplay("RSTUVWXYZabcdefghjkmnpqr", "class-1", student, "main", "teacher-1", true);
    expect(databaseMocks.set).toHaveBeenCalledWith("displays/RSTUVWXYZabcdefghjkmnpqr", expect.objectContaining({ active: true, studentId: "student-1", boardToken: "board-token", pageId: "main", followStudent: true }));
    await stopDisplay("RSTUVWXYZabcdefghjkmnpqr", "class-1", "teacher-1");
    expect(databaseMocks.set).toHaveBeenLastCalledWith("displays/RSTUVWXYZabcdefghjkmnpqr", expect.objectContaining({ active: false }));
  });
});
