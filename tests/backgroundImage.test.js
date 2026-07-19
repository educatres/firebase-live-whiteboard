import { describe, expect, it } from "vitest";
import { googleDriveFileId, normalizeBackgroundScale, normalizeGoogleDriveImageUrl } from "../src/whiteboard/backgroundImage.js";
import { boardPagesMap, normalizeBoardPages } from "../src/whiteboard/pages.js";

const fileId = "1AbCdEfGhIjKlMnOpQrStUvWxYz234567";

describe("Google Drive 白板底圖", () => {
  it("支援常見的 Google Drive 分享網址", () => {
    expect(googleDriveFileId(`https://drive.google.com/file/d/${fileId}/view?usp=sharing`)).toBe(fileId);
    expect(googleDriveFileId(`https://drive.google.com/open?id=${fileId}`)).toBe(fileId);
    expect(normalizeGoogleDriveImageUrl(`https://drive.google.com/file/d/${fileId}/view`).imageUrl).toBe(`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`);
  });

  it("拒絕非 Google Drive 網址並限制縮放範圍", () => {
    expect(() => normalizeGoogleDriveImageUrl("https://example.com/image.png")).toThrow("Google Drive");
    expect([normalizeBackgroundScale(0), normalizeBackgroundScale(.75), normalizeBackgroundScale(3)]).toEqual([.1, .75, 1.5]);
  });

  it("頁序轉換會保留每一頁自己的底圖", () => {
    const backgroundImage = { sourceUrl: `https://drive.google.com/file/d/${fileId}/view`, imageUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`, scale: .8, updatedAt: 2, updatedBy: "teacher" };
    const pages = normalizeBoardPages({ main: { id: "main", order: 0, createdAt: 1, createdBy: "teacher", backgroundImage } });
    expect(boardPagesMap(pages).main.backgroundImage).toEqual(backgroundImage);
  });
});
