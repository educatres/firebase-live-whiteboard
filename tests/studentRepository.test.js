import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn((_database, path) => path),
  runTransaction: vi.fn(),
  update: vi.fn()
}));

vi.mock("firebase/database", () => databaseMocks);
vi.mock("../src/firebase/config.js", () => ({ database: {} }));

import { bindStudent } from "../src/firebase/studentRepository.js";

describe("bindStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("waits for server-backed student data before starting the transaction", async () => {
    const unsubscribe = vi.fn();
    let emitStudent;
    databaseMocks.onValue.mockImplementation((_target, onValue) => {
      emitStudent = onValue;
      return unsubscribe;
    });
    databaseMocks.runTransaction.mockImplementation(async (_target, updateStudent) => {
      expect(unsubscribe).not.toHaveBeenCalled();
      const next = updateStudent({
        classId: "class-1",
        boardToken: "board-token",
        displayName: "Student",
        seatNumber: "1",
        enabled: true,
        locked: false,
        createdAt: 1,
        updatedAt: 1
      });
      expect(next.studentUid).toBe("student-uid");
      return { committed: true };
    });

    const binding = bindStudent("student-1", "student-uid");
    await Promise.resolve();
    expect(databaseMocks.runTransaction).not.toHaveBeenCalled();

    emitStudent();

    await expect(binding).resolves.toBe(true);
    expect(databaseMocks.runTransaction).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
