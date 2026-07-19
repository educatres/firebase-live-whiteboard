import { get, ref, runTransaction, set, update } from "firebase/database";
import { database } from "./config.js";
import { boardToken, teacherAccessKey } from "../utils/random.js";

const INVITE_TTL_MS = 10 * 60 * 1000;

export async function getTeacherAccessKey(classId) {
  const key = (await get(ref(database, `teacherKeys/${classId}`))).val();
  if (!/^\d{6}$/.test(key || "")) throw new Error("無法讀取老師密鑰。");
  return key;
}

export async function ensureTeacherAccessKey(classId) {
  const result = await runTransaction(ref(database, `teacherKeys/${classId}`), (current) => current || teacherAccessKey(), { applyLocally: false });
  const key = result.snapshot.val();
  if (!/^\d{6}$/.test(key || "")) throw new Error("無法建立老師密鑰。");
  return key;
}

export async function claimTeacherKey(classId, key, uid) {
  const normalizedKey = String(key || "").trim();
  if (!/^\d{6}$/.test(normalizedKey)) throw new Error("請輸入六位數老師密鑰。");
  try {
    await set(ref(database, `teacherKeyClaims/${classId}/${uid}`), normalizedKey);
  } catch {
    throw new Error("老師密鑰錯誤，請重新確認六位數字。");
  }
  try {
    await set(ref(database, `classes/${classId}/admins/${uid}`), true);
  } catch {
    throw new Error("無法取得課堂管理權限，請重新確認老師連結與密鑰。");
  }
  await set(ref(database, `userClasses/${uid}/${classId}`), true);
  await set(ref(database, `teacherKeyClaims/${classId}/${uid}`), null).catch(() => {});
}

export async function createTeacherInvite(classId, uid) {
  const token = boardToken();
  const createdAt = Date.now();
  const invite = { classId, createdBy: uid, createdAt, expiresAt: createdAt + INVITE_TTL_MS };
  await update(ref(database), { [`teacherInvites/${token}`]: invite, [`classes/${classId}/teacherInviteTokens/${token}`]: true });
  return { token, expiresAt: invite.expiresAt };
}

export async function claimTeacherInvite(classId, token, uid) {
  const inviteRef = ref(database, `teacherInvites/${token}`);
  const invite = (await get(inviteRef)).val();
  if (!invite || invite.classId !== classId) throw new Error("老師授權連結無效。");
  if (invite.expiresAt <= Date.now()) throw new Error("老師授權連結已過期，請在原裝置重新產生。");

  let claim;
  try {
    claim = await runTransaction(ref(database, `teacherInvites/${token}/claimedBy`), (claimedBy) => {
      if (claimedBy && claimedBy !== uid) return;
      return uid;
    }, { applyLocally: false });
  } catch {
    throw new Error("老師授權連結已過期或無效。");
  }
  if (!claim.committed && claim.snapshot.val() !== uid) throw new Error("這個老師授權連結已被使用。");

  await set(ref(database, `teacherClaims/${classId}/${uid}`), token);
  try {
    await set(ref(database, `classes/${classId}/admins/${uid}`), true);
  } catch {
    throw new Error("無法取得課堂管理權限，請重新開啟老師授權連結。");
  }
  await set(ref(database, `userClasses/${uid}/${classId}`), true);

  try {
    await update(ref(database), {
      [`teacherClaims/${classId}/${uid}`]: null,
      [`teacherInvites/${token}`]: null,
      [`classes/${classId}/teacherInviteTokens/${token}`]: null
    });
  } catch {
    // Access is already granted. Expired claim artifacts cannot grant another UID.
  }
}
