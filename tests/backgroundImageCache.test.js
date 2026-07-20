import { describe, expect, it, vi } from "vitest";
import { classroomBackgroundImageUrls, createBackgroundImageCache, precacheClassroomBackgrounds } from "../src/teacher/backgroundImageCache.js";

const fileId = "1AbCdEfGhIjKlMnOpQrStUvWxYz234567";
const url = `https://lh3.googleusercontent.com/d/${fileId}=w2000`;
const backgroundImage = { sourceUrl: `https://drive.google.com/file/d/${fileId}/view`, imageUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`, scale: 1 };

function fakeCacheStorage() {
  const entries = new Map();
  return {
    entries,
    open: vi.fn(async () => ({
      match: vi.fn(async (key) => entries.get(key)),
      put: vi.fn(async (key, response) => entries.set(key, response))
    }))
  };
}

describe("匯出底圖預先快取", () => {
  it("課堂開啟時只下載一次重複底圖並存入持久快取", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImage = vi.fn(async () => new Response(blob, { status: 200 }));
    const cacheStorage = fakeCacheStorage();
    const cache = createBackgroundImageCache({ fetchImage, cacheStorage });
    const classroom = { boardPages: { main: { id: "main", order: 0, backgroundImage }, second: { id: "second", order: 1, backgroundImage } } };

    expect(classroomBackgroundImageUrls(classroom)).toEqual([url]);
    await expect(precacheClassroomBackgrounds(classroom, cache)).resolves.toMatchObject({ count: 1, urls: [url] });
    expect(fetchImage).toHaveBeenCalledOnce();
    expect(fetchImage).toHaveBeenCalledWith(url, { mode: "cors", credentials: "omit", cache: "no-store" });
    expect(cacheStorage.entries.size).toBe(1);

    const reloadFetch = vi.fn();
    const reloadedCache = createBackgroundImageCache({ fetchImage: reloadFetch, cacheStorage });
    await expect(reloadedCache.readBlob(url)).resolves.toMatchObject({ size: 3, type: "image/png" });
    expect(reloadFetch).not.toHaveBeenCalled();
  });

  it("匯出時從 Blob 本機網址解碼，不再連 Google", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetchImage = vi.fn(async () => new Response(blob, { status: 200 }));
    const createdUrls = [], revokedUrls = [];
    class FakeImage {
      set src(value) { this.loadedUrl = value; queueMicrotask(() => this.onload()); }
    }
    const cache = createBackgroundImageCache({
      fetchImage,
      cacheStorage: fakeCacheStorage(),
      ImageClass: FakeImage,
      createObjectURL: (value) => { createdUrls.push(value); return "blob:cached-background"; },
      revokeObjectURL: (value) => revokedUrls.push(value)
    });

    await cache.precache(url);
    const image = await cache.loadImage(url);
    expect(image.loadedUrl).toBe("blob:cached-background");
    expect(createdUrls).toEqual([blob]);
    expect(revokedUrls).toEqual(["blob:cached-background"]);
    expect(fetchImage).toHaveBeenCalledOnce();
  });

  it("沒有快取時拒絕在匯出階段臨時下載", async () => {
    const fetchImage = vi.fn();
    const cache = createBackgroundImageCache({ fetchImage, cacheStorage: fakeCacheStorage() });
    await expect(cache.loadImage(url)).rejects.toThrow("尚未完成快取");
    expect(fetchImage).not.toHaveBeenCalled();
  });
});
