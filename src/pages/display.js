import { ensureAnonymousUser } from "../firebase/auth.js";
import { subscribeLayer, subscribeStickyNotes } from "../firebase/boardRepository.js";
import { clearDisplaySession, setDisplaySession, watchDisplay } from "../firebase/displayRepository.js";
import { watchBoardPages } from "../firebase/pageRepository.js";
import { BoardEngine } from "../canvas/BoardEngine.js";
import { StickyNotesLayer } from "../notes/StickyNotesLayer.js";
import { setBackgroundViewport, showBackgroundImage } from "../whiteboard/backgroundImage.js";
import { normalizeBoardPages } from "../whiteboard/pages.js";
import { param } from "../utils/url.js";
import { explainError, toast } from "../utils/ui.js";

const token = param("display"), black = document.querySelector("#displayBlack"), stage = document.querySelector("#displayStage"), message = document.querySelector("#displayMessage");
let user, displayOff, engine, stickyNotes, projectionOffs = [], signature = "";

function showBlack(text = "") {
  stopProjection();
  message.textContent = text;
  message.hidden = !text;
  black.hidden = false;
  stage.hidden = true;
}

function stopProjection(clearSession = true) {
  projectionOffs.forEach((off) => off?.());
  projectionOffs = [];
  stickyNotes?.destroy(); stickyNotes = null;
  engine?.destroy(); engine = null;
  if (clearSession && user) clearDisplaySession(user.uid).catch(() => {});
}

async function showProjection(state) {
  const nextSignature = `${state.boardToken}:${state.pageId}`;
  if (signature === nextSignature && engine) { document.querySelector("#displayLabel").textContent = state.label || ""; return; }
  signature = nextSignature;
  stopProjection(false);
  await setDisplaySession(user.uid, token, state.boardToken);
  black.hidden = true; stage.hidden = false;
  document.querySelector("#displayLabel").textContent = state.label || "";
  stickyNotes = new StickyNotesLayer({ container: document.querySelector("#displayStickyLayer") });
  const activeStickyNotes = stickyNotes;
  engine = new BoardEngine({
    stage,
    backgroundCanvas: document.querySelector("#displayBackground"),
    studentCanvas: document.querySelector("#displayStudent"),
    teacherCanvas: document.querySelector("#displayTeacher"),
    onViewChange: (view) => { activeStickyNotes.setViewport(view); setBackgroundViewport(document.querySelector("#displayBackgroundLayer"), view); }
  });
  const activeEngine = engine, pageId = state.pageId, board = state.boardToken;
  projectionOffs.push(
    subscribeLayer(board, "studentStrokes", { add: (id, stroke) => activeEngine.addStroke("studentStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("studentStrokes", id) }, pageId),
    subscribeLayer(board, "teacherStrokes", { add: (id, stroke) => activeEngine.addStroke("teacherStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("teacherStrokes", id) }, pageId),
    subscribeStickyNotes(board, { add: (id, note) => activeStickyNotes.upsert(id, note), change: (id, note) => activeStickyNotes.upsert(id, note), remove: (id) => activeStickyNotes.remove(id) }, pageId),
    watchBoardPages(board, (value) => {
      const page = normalizeBoardPages(value).find((item) => item.id === pageId);
      showBackgroundImage(document.querySelector("#displayBackgroundImage"), page?.backgroundImage);
    })
  );
}

async function init() {
  if (!token) return showBlack("展示網址無效。");
  try {
    user = await ensureAnonymousUser();
    displayOff = watchDisplay(token, (state) => {
      if (!state) return showBlack("展示網址不存在，請向老師索取新連結。");
      if (!state.active) { signature = ""; return showBlack(); }
      showProjection(state).catch((error) => { showBlack("無法載入投影畫面。"); toast(explainError(error), "error"); });
    });
  } catch (error) { showBlack(explainError(error)); }
}

document.querySelector("#displayBackgroundImage").addEventListener("error", () => toast("題目底圖載入失敗，請通知老師檢查分享權限。", "error"));
addEventListener("pagehide", () => { displayOff?.(); stopProjection(); });
init();
