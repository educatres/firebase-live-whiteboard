import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  ref: vi.fn((_database, path) => path)
}));

vi.mock("firebase/database", () => databaseMocks);
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

import { watchConnection } from "../src/firebase/connection.js";

describe("資料庫連線狀態", () => {
  beforeEach(() => vi.clearAllMocks());

  it("顯示資料庫已連線與資料庫離線", () => {
    let connectionCallback;
    databaseMocks.onValue.mockImplementation((target, callback) => {
      if (target === ".info/connected") connectionCallback = callback;
      else callback({ val: () => 0 });
      return vi.fn();
    });
    const element = { textContent: "", className: "" };
    watchConnection(element);
    connectionCallback({ val: () => true });
    expect(element).toMatchObject({ textContent: "資料庫已連線", className: "badge online" });
    connectionCallback({ val: () => false });
    expect(element).toMatchObject({ textContent: "資料庫離線", className: "badge offline" });
  });
});
