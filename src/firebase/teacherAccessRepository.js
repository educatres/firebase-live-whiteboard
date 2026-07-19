import { get, ref, runTransaction, set, update } from "firebase/database";
import { database } from "./config.js";
import { boardToken } from "../utils/random.js";

const INVITE_TTL_MS = 10 * 60 * 1000;
export const MAX_TEACHER_DEVICES = 5;

async function syncTeacherSlots(classId, admins) {
  const slotsRef = ref(database, `teacherSlots/${classId}`);
  const slots = (await get(slotsRef)).val() || {};
  for (const adminUid of Object.keys(admins)) {
    if (Object.values(slots).includes(adminUid)) continue;
    let assigned = false;
    for (let slot = 1; slot <= MAX_TEACHER_DEVICES; slot++) {
      if (slots[slot]) continue;
      const result = await runTransaction(ref(database, `teacherSlots/${classId}/${slot}`), (current) => current || adminUid, { applyLocally: false });
      slots[slot] = result.snapshot.val();
      if (slots[slot] === adminUid) { assigned = true; break; }
    }
    if (!assigned) throw new Error("此課堂已達 5 台老師裝置上限。");
  }
  return slots;
}

export async function createTeacherInvite(classId, uid) {
  const admins = (await get(ref(database, `classes/${classId}/admins`))).val() || {};
  const slots = await syncTeacherSlots(classId, admins);
  if (Object.keys(slots).length >= MAX_TEACHER_DEVICES) throw new Error("此課堂已達 5 台老師裝置上限。");
  const token = boardToken();
  const createdAt = Date.now();
  const invite = { classId, createdBy: uid, createdAt, expiresAt: createdAt + INVITE_TTL_MS };
  await set(ref(database, `teacherInvites/${token}`), invite);
  return { token, expiresAt: invite.expiresAt };
}

export async function resetOtherTeacherDevices(classId, uid) {
  const [adminsSnapshot, slotsSnapshot, claimsSnapshot] = await Promise.all([
    get(ref(database, `classes/${classId}/admins`)),
    get(ref(database, `teacherSlots/${classId}`)),
    get(ref(database, `teacherClaims/${classId}`))
  ]);
  const admins = adminsSnapshot.val() || {};
  if (admins[uid] !== true) throw new Error("目前裝置沒有這個課堂的老師權限。");
  const slots = slotsSnapshot.val() || {};
  const claims = claimsSnapshot.val() || {};
  const otherUids = Object.keys(admins).filter((adminUid) => adminUid !== uid);
  const changes = { [`classes/${classId}/updatedAt`]: Date.now() };

  for (const adminUid of otherUids) {
    changes[`classes/${classId}/admins/${adminUid}`] = null;
    changes[`userClasses/${adminUid}/${classId}`] = null;
  }
  for (const [slot, slotUid] of Object.entries(slots)) {
    if (slotUid !== uid) changes[`teacherSlots/${classId}/${slot}`] = null;
  }
  for (const [claimUid, token] of Object.entries(claims)) {
    if (claimUid === uid) continue;
    changes[`teacherClaims/${classId}/${claimUid}`] = null;
    if (typeof token === "string") changes[`teacherInvites/${token}`] = null;
  }

  await update(ref(database), changes);
  return otherUids.length;
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
  const slots = (await get(ref(database, `teacherSlots/${classId}`))).val() || {};
  let claimedSlot = Object.keys(slots).find((slot) => slots[slot] === uid);
  for (let slot = 1; !claimedSlot && slot <= MAX_TEACHER_DEVICES; slot++) {
    const result = await runTransaction(ref(database, `teacherSlots/${classId}/${slot}`), (current) => {
      if (current && current !== uid) return;
      return uid;
    }, { applyLocally: false });
    if (result.snapshot.val() === uid) claimedSlot = String(slot);
  }
  if (!claimedSlot) throw new Error("此課堂已達 5 台老師裝置上限，請使用已授權的裝置。");
  try {
    await set(ref(database, `classes/${classId}/admins/${uid}`), true);
  } catch {
    await set(ref(database, `teacherSlots/${classId}/${claimedSlot}`), null).catch(() => {});
    throw new Error("此課堂已達 5 台老師裝置上限，請使用已授權的裝置。");
  }
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
