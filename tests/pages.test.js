import { describe, expect, it, vi } from "vitest";
import { boardPagesMap, insertBoardPage, normalizeBoardPages, selectMonitoredPage } from "../src/whiteboard/pages.js";

vi.mock("firebase/database", () => ({
  get: vi.fn(), onChildAdded: vi.fn(), onChildChanged: vi.fn(), onChildRemoved: vi.fn(), onValue: vi.fn(), push: vi.fn(), ref: vi.fn(), remove: vi.fn(), set: vi.fn(), update: vi.fn()
}));
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

const { boardLayerPath } = await import("../src/firebase/boardRepository.js");

describe("白板分頁", () => {
  it("舊白板自動成為第 1 頁並可指定插入位置", () => {
    expect(normalizeBoardPages()).toEqual([{ id: "main", order: 0, createdAt: 0, createdBy: "" }]);
    const pages = insertBoardPage(null, 1, "page_ABCDEF", "teacher", 10);
    expect(pages.map((page) => page.id)).toEqual(["page_ABCDEF", "main"]);
    expect(boardPagesMap(pages, { createdBy: "teacher", createdAt: 1 }).main.order).toBe(1);
  });

  it("第一頁沿用舊路徑，新增頁使用 pages 路徑", () => {
    expect(boardLayerPath("main", "studentStrokes")).toBe("studentStrokes");
    expect(boardLayerPath("page_ABCDEF", "studentStrokes")).toBe("pages/page_ABCDEF/studentStrokes");
  });

  it("多格監看與投影優先顯示正在書寫頁，其次最近書寫頁", () => {
    const pages = [{ id: "main", order: 0 }, { id: "page_ABCDEF", order: 1 }, { id: "page_GHIJKL", order: 2 }];
    expect(selectMonitoredPage({ drawing: true, currentPageId: "page_GHIJKL", lastWrittenPageId: "page_ABCDEF" }, pages)).toBe("page_GHIJKL");
    expect(selectMonitoredPage({ drawing: false, currentPageId: "page_GHIJKL", lastWrittenPageId: "page_ABCDEF" }, pages)).toBe("page_ABCDEF");
    expect(selectMonitoredPage({ currentPageId: "page_GHIJKL" }, pages)).toBe("page_GHIJKL");
  });
});
