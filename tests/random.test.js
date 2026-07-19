import { describe, expect, it } from "vitest";
import { boardToken, randomId, teacherAccessKey } from "../src/utils/random.js";

describe("安全識別碼", () => {
  it("產生指定長度課堂 ID", () => expect(randomId(10)).toMatch(/^[A-Za-z0-9]{10}$/));
  it("產生至少 128-bit URL-safe token", () => expect(boardToken()).toMatch(/^[A-Za-z0-9_-]{24}$/));
  it("產生含前導零在內的六位數老師密鑰", () => expect(teacherAccessKey()).toMatch(/^\d{6}$/));
});
