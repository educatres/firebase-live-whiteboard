import { ensureAnonymousUser } from "../firebase/auth.js";
import { bindStudent, resolveBoard, watchStudent } from "../firebase/studentRepository.js";
import { clearActive, publishActive, removeStroke, saveStroke, subscribeLayer, subscribeStickyNotes } from "../firebase/boardRepository.js";
import { setDrawing, setPresencePage, startPresence } from "../firebase/presenceRepository.js";
import { watchBoardPages } from "../firebase/pageRepository.js";
import { watchConnection } from "../firebase/connection.js";
import { BoardEngine } from "../canvas/BoardEngine.js";
import { StickyNotesLayer } from "../notes/StickyNotesLayer.js";
import { normalizeBoardPages } from "../whiteboard/pages.js";
import { param } from "../utils/url.js";
import { explainError, toast } from "../utils/ui.js";

const token = param("board");
const message = document.querySelector("#boardMessage");
const stage = document.querySelector("#boardStage");
const toolbar = document.querySelector("#studentToolbar");
const sync = document.querySelector("#syncBadge");
let user, student, engine, stickyNotes, presenceStop;
let pages = normalizeBoardPages();
let currentPageId = pages[0].id;
let pageOffs = [], lifecycleOffs = [];
let activeTimer;
let presenceDrawing = false;
const drawingSettings = { tool: "pen", color: "#173f5f", width: 5 };

watchConnection(document.querySelector("#connectionBadge"));

function setMessage(text) {
  message.textContent = text;
  message.hidden = false;
  stage.hidden = true;
  toolbar.hidden = true;
}

function setSync(text, type = "") {
  sync.textContent = text;
  sync.className = `badge ${type}`;
}

function renderPageControls() {
  const index = Math.max(0, pages.findIndex((page) => page.id === currentPageId));
  document.querySelector("#studentPageLabel").textContent = `第 ${index + 1} / ${pages.length} 頁`;
  document.querySelector("#studentPrevPage").disabled = index <= 0;
  document.querySelector("#studentNextPage").disabled = index >= pages.length - 1;
}

function stopPage() {
  pageOffs.forEach((off) => off?.());
  pageOffs = [];
  stickyNotes?.destroy();
  stickyNotes = null;
  engine?.destroy();
  engine = null;
}

function openPage(pageId, updatePresence = true) {
  if (!pages.some((page) => page.id === pageId)) pageId = pages[0].id;
  if (engine && currentPageId === pageId) return renderPageControls();
  if (user && student) clearActive(token, "student", user.uid);
  presenceDrawing = false;
  stopPage();
  currentPageId = pageId;
  const activePageId = pageId;
  stickyNotes = new StickyNotesLayer({ container: document.querySelector("#studentStickyLayer") });
  engine = new BoardEngine({
    stage,
    backgroundCanvas: document.querySelector("#backgroundCanvas"),
    studentCanvas: document.querySelector("#studentCanvas"),
    teacherCanvas: document.querySelector("#teacherCanvas"),
    editableLayer: "studentStrokes",
    uid: user.uid,
    onComplete: async (stroke) => {
      setSync("同步中");
      try {
        await saveStroke(token, "studentStrokes", stroke, activePageId);
        setSync("已同步", "synced");
      } catch (error) {
        setSync("同步失敗", "error");
        toast(explainError(error), "error");
      }
    },
    onRemove: async (id) => {
      setSync("同步中");
      try {
        await removeStroke(token, "studentStrokes", id, activePageId);
        setSync("已同步", "synced");
      } catch (error) {
        setSync("同步失敗", "error");
      }
    },
    onActive: (stroke) => {
      const drawing = Boolean(stroke);
      if (drawing !== presenceDrawing) { presenceDrawing = drawing; setDrawing(student.classId, student.id, drawing, activePageId); }
      clearTimeout(activeTimer);
      activeTimer = setTimeout(() => stroke
        ? publishActive(token, "student", user.uid, { ...stroke, points: stroke.points.slice(-80), updatedAt: Date.now(), pageId: activePageId })
        : clearActive(token, "student", user.uid), 100);
    },
    onViewChange: (view) => stickyNotes.setViewport(view)
  });
  const activeEngine = engine, activeStickyNotes = stickyNotes;
  engine.setTool(drawingSettings.tool);
  engine.setColor(drawingSettings.color);
  engine.setWidth(drawingSettings.width);
  engine.setEnabled(!(student.locked || !student.enabled));
  pageOffs.push(
    subscribeLayer(token, "studentStrokes", { add: (id, stroke) => activeEngine.addStroke("studentStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("studentStrokes", id) }, activePageId),
    subscribeLayer(token, "teacherStrokes", { add: (id, stroke) => activeEngine.addStroke("teacherStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("teacherStrokes", id) }, activePageId),
    subscribeStickyNotes(token, { add: (id, note) => activeStickyNotes.upsert(id, note), change: (id, note) => activeStickyNotes.upsert(id, note), remove: (id) => activeStickyNotes.remove(id) }, activePageId)
  );
  renderPageControls();
  if (updatePresence) setPresencePage(student.classId, student.id, activePageId).catch(() => {});
}

async function init() {
  if (!token) return setMessage("無效連結：缺少白板識別碼。");
  try {
    user = await ensureAnonymousUser();
    student = await resolveBoard(token);
    if (!student) return setMessage("白板不存在，請向老師索取新的連結。");
    if (!student.enabled) return setMessage("此白板已停用，請聯絡老師。");
    if (student.studentUid && student.studentUid !== user.uid) return setMessage("此白板已綁定其他裝置，請聯絡老師解除裝置綁定。");
    if (!student.studentUid) {
      const bound = await bindStudent(student.id, user.uid);
      if (!bound) return setMessage("白板剛被其他裝置綁定，請聯絡老師。");
      student.studentUid = user.uid;
    }

    document.querySelector("#studentName").textContent = student.displayName;
    document.querySelector("#seatNumber").textContent = ` ${student.seatNumber}`;
    message.hidden = true;
    stage.hidden = false;
    toolbar.hidden = false;
    openPage(currentPageId, false);
    presenceStop = await startPresence(student.classId, student.id, user.uid, currentPageId);
    lifecycleOffs.push(watchBoardPages(token, (value) => {
      pages = normalizeBoardPages(value);
      if (!pages.some((page) => page.id === currentPageId)) openPage(pages[0].id);
      else renderPageControls();
    }));
    lifecycleOffs.push(watchStudent(student.id, (value) => {
      if (!value) return setMessage("白板已被老師刪除。");
      student = value;
      const locked = value.locked || !value.enabled;
      engine?.setEnabled(!locked);
      document.querySelector("#lockBadge").hidden = !locked;
      if (value.studentUid !== user.uid) setMessage("此白板的裝置綁定已變更，請聯絡老師。");
    }));
    setSync("已同步", "synced");
    bindToolbar();
  } catch (error) {
    setMessage(explainError(error));
    setSync("開啟失敗", "error");
  }
}

function bindToolbar() {
  toolbar.querySelectorAll("button[data-tool]").forEach((button) => button.onclick = () => {
    toolbar.querySelectorAll("button[data-tool]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    drawingSettings.tool = button.dataset.tool;
    engine?.setTool(drawingSettings.tool);
  });
  document.querySelector("#colorInput").oninput = (event) => { drawingSettings.color = event.target.value; engine?.setColor(drawingSettings.color); };
  document.querySelector("#widthInput").oninput = (event) => { drawingSettings.width = event.target.value; engine?.setWidth(drawingSettings.width); };
  document.querySelector("#undoBtn").onclick = () => engine?.undo();
  document.querySelector("#redoBtn").onclick = () => engine?.redo();
  document.querySelector("#resetZoomBtn").onclick = () => engine?.resetZoom();
  document.querySelector("#studentPrevPage").onclick = () => openPage(pages[Math.max(0, pages.findIndex((page) => page.id === currentPageId) - 1)].id);
  document.querySelector("#studentNextPage").onclick = () => openPage(pages[Math.min(pages.length - 1, pages.findIndex((page) => page.id === currentPageId) + 1)].id);
}

addEventListener("pagehide", () => {
  clearTimeout(activeTimer);
  stopPage();
  lifecycleOffs.forEach((off) => off?.());
  presenceStop?.();
  if (user && student) clearActive(token, "student", user.uid);
});

init();
