import { describe, expect, it } from "vitest";
import { createStoredZip, crc32 } from "../src/utils/zip.js";

const encoder = new TextEncoder(), decoder = new TextDecoder();

async function readLocalEntries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
  const entries = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30, dataStart = nameStart + nameLength + extraLength;
    entries.set(decoder.decode(bytes.slice(nameStart, nameStart + nameLength)), bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return { entries, nextSignature: view.getUint32(offset, true) };
}

describe("瀏覽器端 ZIP", () => {
  it("CRC32 符合標準測試向量", () => {
    expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
  });

  it("以 UTF-8 檔名封裝多個未壓縮項目", async () => {
    const zip = await createStoredZip([
      { name: "01-王小明/第01頁.png", data: new Uint8Array([1, 2, 3]) },
      { name: "無筆記學生.txt", data: "林小美\n" }
    ], new Date(2026, 6, 19, 12, 0, 0));
    const { entries, nextSignature } = await readLocalEntries(zip);

    expect(zip.type).toBe("application/zip");
    expect([...entries.keys()]).toEqual(["01-王小明/第01頁.png", "無筆記學生.txt"]);
    expect([...entries.get("01-王小明/第01頁.png")]).toEqual([1, 2, 3]);
    expect(decoder.decode(entries.get("無筆記學生.txt"))).toBe("林小美\n");
    expect(nextSignature).toBe(0x02014b50);
  });
});
