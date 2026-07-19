import { afterEach, describe, expect, it, vi } from "vitest";
import { explainError } from "../src/utils/ui.js";

describe("依使用者顯示權限錯誤", () => {
  afterEach(() => vi.restoreAllMocks());

  it("老師權限錯誤提示使用六位數密鑰", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(explainError({ code: "PERMISSION_DENIED" })).toContain("六位數老師密鑰");
  });

  it("學生權限錯誤只提示專屬網址與裝置綁定", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const message = explainError({ code: "PERMISSION_DENIED" }, "student");
    expect(message).toContain("學生白板");
    expect(message).toContain("網址");
    expect(message).not.toContain("密鑰");
  });
});
