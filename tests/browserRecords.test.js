import { describe, expect, it, vi } from "vitest";
import { clearBrowserRecords } from "../src/utils/browserRecords.js";

describe("清除瀏覽記錄", () => {
  it("只清除 ClassPad 紀錄並保留 Firebase 驗證權杖", () => {
    const values = new Map([
      ["classpad.classroomHistory.v1", "{}"],
      ["classpad-monitor-toolbar-hidden", "true"],
      ["firebase:authUser:app", "token"]
    ]);
    const storage = {
      get length() { return values.size; },
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: vi.fn((key) => values.delete(key))
    };
    expect(clearBrowserRecords(storage)).toBe(true);
    expect(values.has("classpad.classroomHistory.v1")).toBe(false);
    expect(values.has("classpad-monitor-toolbar-hidden")).toBe(false);
    expect(values.get("firebase:authUser:app")).toBe("token");
  });

  it("儲存空間不可用時回傳失敗而不拋出錯誤", () => {
    const storage = { length: 1, key: () => "classpad.test", removeItem: () => { throw new Error("blocked"); } };
    expect(clearBrowserRecords(storage)).toBe(false);
    expect(clearBrowserRecords(null)).toBe(false);
  });
});
