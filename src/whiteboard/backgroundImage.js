const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,128}$/;

export function googleDriveFileId(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return null;
  const pathMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  const id = pathMatch?.[1] || url.searchParams.get("id");
  return DRIVE_FILE_ID_PATTERN.test(id || "") ? id : null;
}

export function normalizeGoogleDriveImageUrl(value) {
  const sourceUrl = String(value || "").trim();
  const id = googleDriveFileId(sourceUrl);
  if (!id) throw new Error("請貼上有效的 Google Drive 圖片分享網址。");
  return {
    sourceUrl,
    imageUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w2000`
  };
}

export function normalizeBackgroundScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) ? Math.max(.1, Math.min(1.5, scale)) : 1;
}

export function normalizeBackgroundImage(value) {
  if (!value || typeof value.sourceUrl !== "string" || typeof value.imageUrl !== "string") return null;
  if (!googleDriveFileId(value.sourceUrl) || !/^https:\/\/drive[.]google[.]com\/thumbnail[?]id=[A-Za-z0-9_-]+&sz=w2000$/.test(value.imageUrl)) return null;
  return {
    sourceUrl: value.sourceUrl,
    imageUrl: value.imageUrl,
    scale: normalizeBackgroundScale(value.scale),
    updatedAt: Number(value.updatedAt) || 0,
    updatedBy: typeof value.updatedBy === "string" ? value.updatedBy : ""
  };
}

export function showBackgroundImage(element, value) {
  const background = normalizeBackgroundImage(value);
  if (!background) {
    element.hidden = true;
    element.removeAttribute("src");
    element.style.removeProperty("--background-size");
    return;
  }
  if (element.getAttribute("src") !== background.imageUrl) element.src = background.imageUrl;
  element.style.setProperty("--background-size", `${Math.round(background.scale * 100)}%`);
  element.hidden = false;
}

export function setBackgroundViewport(layer, view) {
  layer.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`;
}
