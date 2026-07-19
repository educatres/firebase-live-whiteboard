import { describe, expect, it } from "vitest";
import { countClassroomStatuses } from "../src/utils/classroomStats.js";

describe("首頁課程統計", () => {
  it("分別計算進行中與已停用課程", () => {
    expect(countClassroomStatuses([
      { status: "active" },
      { status: "closed" },
      { status: "active" },
      { status: "disabled" }
    ])).toEqual({ active: 2, inactive: 2 });
  });

  it("沒有課程時兩種數量皆為零", () => {
    expect(countClassroomStatuses()).toEqual({ active: 0, inactive: 0 });
  });
});
