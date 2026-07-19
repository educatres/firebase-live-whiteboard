import { get, ref, runTransaction, set, update } from "firebase/database";
import { database } from "./config.js";
import { boardToken } from "../utils/random.js";

const INVITE_TTL_MS = 10 * 60 * 1000;

export async function createTeacherInvite(classId, uid) {
  const token = boardToken();
  const createdAt = Date.now();
  const invite = { classId, createdBy: uid, createdAt, expiresAt: createdAt + INVITE_TTL_MS };
  await set(ref(database, `teacherInvites/${token}`), invite);
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
  await set(ref(database, `classes/${classId}/admins/${uid}`), true);
  await set(ref(database, `userClasses/${uid}/${classId}`), true);

  try {
    await update(ref(database), {
      [`teacherClaims/${classId}/${uid}`]: null,
      [`teacherInvites/${token}`]: null
    });
  } catch {
    // Access is already granted. Expired claim artifacts cannot grant another UID.
  }
}
