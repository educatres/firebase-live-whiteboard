import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null, authStateReady: vi.fn() },
  signInAnonymously: vi.fn(),
  setPersistence: vi.fn()
}));

vi.mock("firebase/auth", () => ({ browserLocalPersistence: "LOCAL", setPersistence: mocks.setPersistence, signInAnonymously: mocks.signInAnonymously }));
vi.mock("../src/firebase/config.js", () => ({ auth: mocks.auth }));

import { ensureAnonymousUser } from "../src/firebase/auth.js";

describe("匿名老師驗證持久化", () => {
  beforeEach(() => {
    mocks.auth.currentUser = null;
    mocks.auth.authStateReady.mockReset();
    mocks.signInAnonymously.mockReset();
    mocks.setPersistence.mockReset().mockResolvedValue();
  });

  it("先等待瀏覽器本機驗證恢復，不建立新的匿名身分", async () => {
    const restored = { uid: "restored-teacher" };
    mocks.auth.authStateReady.mockImplementation(async () => { mocks.auth.currentUser = restored; });

    await expect(ensureAnonymousUser()).resolves.toBe(restored);
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, "LOCAL");
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("本機沒有既有驗證時才建立匿名身分", async () => {
    const created = { uid: "new-teacher" };
    mocks.auth.authStateReady.mockResolvedValue();
    mocks.signInAnonymously.mockResolvedValue({ user: created });

    await expect(ensureAnonymousUser()).resolves.toBe(created);
    expect(mocks.signInAnonymously).toHaveBeenCalledWith(mocks.auth);
  });
});
