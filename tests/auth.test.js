import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null, authStateReady: vi.fn() },
  signInAnonymously: vi.fn(),
  setPersistence: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("firebase/auth", () => ({ browserLocalPersistence: "LOCAL", setPersistence: mocks.setPersistence, signInAnonymously: mocks.signInAnonymously, signOut: mocks.signOut }));
vi.mock("../src/firebase/config.js", () => ({ auth: mocks.auth }));

import { ensureAnonymousUser, ensureFreshAnonymousUser, isInvalidAuthTokenError } from "../src/firebase/auth.js";

describe("匿名老師驗證持久化", () => {
  beforeEach(() => {
    mocks.auth.currentUser = null;
    mocks.auth.authStateReady.mockReset();
    mocks.signInAnonymously.mockReset();
    mocks.setPersistence.mockReset().mockResolvedValue();
    mocks.signOut.mockReset().mockImplementation(async () => { mocks.auth.currentUser = null; });
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

  it("建立課堂前遇到失效 token 時自動更新匿名身分", async () => {
    const stale = { uid: "stale-teacher", getIdToken: vi.fn().mockRejectedValue({ code: "auth/invalid-user-token" }) };
    const renewed = { uid: "renewed-teacher", getIdToken: vi.fn().mockResolvedValue("valid-token") };
    mocks.auth.currentUser = stale;
    mocks.auth.authStateReady.mockResolvedValue();
    mocks.signInAnonymously.mockResolvedValue({ user: renewed });

    await expect(ensureFreshAnonymousUser()).resolves.toBe(renewed);
    expect(stale.getIdToken).toHaveBeenCalledWith(true);
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth);
    expect(mocks.signInAnonymously).toHaveBeenCalledWith(mocks.auth);
  });

  it("辨識資料庫回傳的 Invalid token in path", () => {
    expect(isInvalidAuthTokenError(new Error("Invalid token in path"))).toBe(true);
    expect(isInvalidAuthTokenError({ code: "PERMISSION_DENIED", message: "Permission denied" })).toBe(false);
  });
});
