import { onValue, ref, update } from "firebase/database";
import { database } from "./config.js";
import { randomId } from "../utils/random.js";
import { boardPagesMap, insertBoardPage, normalizeBoardPages } from "../whiteboard/pages.js";
import { normalizeBackgroundScale, normalizeGoogleDriveImageUrl } from "../whiteboard/backgroundImage.js";

export function watchBoardPages(token, callback) {
  return onValue(ref(database, `boardPages/${token}`), (snapshot) => callback(normalizeBoardPages(snapshot.val())));
}

export async function insertClassBoardPage(classId, classroom, students, uid, position) {
  const pageId = `page_${randomId(14)}`;
  const now = Date.now();
  const pages = insertBoardPage(classroom?.boardPages, position, pageId, uid, now);
  const pageMap = boardPagesMap(pages, { createdAt: classroom?.createdAt || now, createdBy: uid });
  const changes = {
    [`classes/${classId}/boardPages`]: pageMap,
    [`classes/${classId}/updatedAt`]: now
  };
  for (const student of students) changes[`boardPages/${student.boardToken}`] = pageMap;
  await update(ref(database), changes);
  return { pageId, pages };
}

export async function setClassPageBackground(classId, classroom, students, uid, pageId, sourceUrl, scale = 1) {
  const now = Date.now();
  const pages = normalizeBoardPages(classroom?.boardPages);
  const page = pages.find((item) => item.id === pageId);
  if (!page) throw new Error("找不到要設定底圖的白板頁面。");
  if (sourceUrl) {
    const urls = normalizeGoogleDriveImageUrl(sourceUrl);
    page.backgroundImage = { ...urls, scale: normalizeBackgroundScale(scale), updatedAt: now, updatedBy: uid };
  } else {
    delete page.backgroundImage;
  }
  const pageMap = boardPagesMap(pages, { createdAt: classroom?.createdAt || now, createdBy: uid });
  const changes = {
    [`classes/${classId}/boardPages`]: pageMap,
    [`classes/${classId}/updatedAt`]: now
  };
  for (const student of students) changes[`boardPages/${student.boardToken}`] = pageMap;
  await update(ref(database), changes);
  return pages;
}
