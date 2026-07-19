import { describe, expect, it, vi } from "vitest";
import { createClassroomFlow } from "../src/home/createClassroomFlow.js";

describe("建立課堂驗證恢復流程", () => {
  it("資料庫拒絕舊 token 時換發身分、重連並只重試一次", async () => {
    const stale = { uid: "stale-teacher" }, renewed = { uid: "renewed-teacher" };
    const create = vi.fn()
      .mockRejectedValueOnce(new Error("Invalid token in path"))
      .mockResolvedValueOnce("class-2");
    const reconnect = vi.fn();
    const result = await createClassroomFlow({ title: "數學課" }, {
      ensureFresh: vi.fn().mockResolvedValue(stale),
      renew: vi.fn().mockResolvedValue(renewed),
      reconnect,
      create,
      invalidToken: (error) => error.message.includes("Invalid token")
    });

    expect(result).toEqual({ id: "class-2", user: renewed });
    expect(create).toHaveBeenNthCalledWith(1, "stale-teacher", { title: "數學課" });
    expect(create).toHaveBeenNthCalledWith(2, "renewed-teacher", { title: "數學課" });
    expect(reconnect).toHaveBeenCalledOnce();
  });

  it("非 token 錯誤不重新登入或重試", async () => {
    const renew = vi.fn(), create = vi.fn().mockRejectedValue(new Error("網路錯誤"));
    await expect(createClassroomFlow({ title: "數學課" }, {
      ensureFresh: vi.fn().mockResolvedValue({ uid: "teacher" }),
      renew,
      reconnect: vi.fn(),
      create,
      invalidToken: () => false
    })).rejects.toThrow("網路錯誤");
    expect(create).toHaveBeenCalledOnce();
    expect(renew).not.toHaveBeenCalled();
  });
});
