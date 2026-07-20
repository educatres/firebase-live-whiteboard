import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  disconnectUpdate: vi.fn(),
  onDisconnect: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn((_database, path) => path),
  serverTimestamp: vi.fn(() => 123),
  update: vi.fn()
}));

vi.mock("firebase/database", () => ({
  onDisconnect: databaseMocks.onDisconnect,
  onValue: databaseMocks.onValue,
  ref: databaseMocks.ref,
  serverTimestamp: databaseMocks.serverTimestamp,
  update: databaseMocks.update
}));
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

import { startPresence } from "../src/firebase/presenceRepository.js";

describe("學生在線狀態", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.onDisconnect.mockReturnValue({ update: databaseMocks.disconnectUpdate });
    databaseMocks.update.mockResolvedValue();
    databaseMocks.disconnectUpdate.mockResolvedValue();
  });

  it("先建立 presence 節點，再註冊離線更新與標記上線", async () => {
    const order = [];
    databaseMocks.update.mockImplementation(async (_target, value) => order.push(value.online ? "online" : "initialize"));
    databaseMocks.disconnectUpdate.mockImplementation(async () => order.push("disconnect"));

    const stop = await startPresence("class-1", "student-1", "uid-1", "main");

    expect(order).toEqual(["initialize", "disconnect", "online"]);
    expect(databaseMocks.update).toHaveBeenNthCalledWith(1, "presence/class-1/student-1", expect.objectContaining({ uid: "uid-1", online: false, drawing: false, currentPageId: "main" }));
    expect(databaseMocks.disconnectUpdate).toHaveBeenCalledWith(expect.objectContaining({ uid: "uid-1", online: false, drawing: false }));
    expect(databaseMocks.update).toHaveBeenNthCalledWith(2, "presence/class-1/student-1", expect.objectContaining({ online: true }));
    stop();
  });
});
