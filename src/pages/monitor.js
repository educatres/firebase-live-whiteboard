import { ensureAnonymousUser } from "../firebase/auth.js";
import { setStudentPinned, watchClassroom } from "../firebase/classroomRepository.js";
import { getStudents, updateStudent } from "../firebase/studentRepository.js";
import { clearLayer, createStickyNote, hasAnyAnswers, removeStickyNote, removeStroke, saveStroke, subscribeLayer, subscribeStickyNotes, updateStickyNote } from "../firebase/boardRepository.js";
import { insertClassBoardPage } from "../firebase/pageRepository.js";
import { watchPresence } from "../firebase/presenceRepository.js";
import { watchConnection } from "../firebase/connection.js";
import { claimTeacherInvite } from "../firebase/teacherAccessRepository.js";
import { BoardEngine, strokePathPoints, traceStrokeSegment } from "../canvas/BoardEngine.js";
import { StickyNotesLayer } from "../notes/StickyNotesLayer.js";
import { normalizeGridSize, paginateStudents, prioritizePinned } from "../monitor/studentView.js";
import { boardPagesMap, normalizeBoardPages, selectMonitoredPage } from "../whiteboard/pages.js";
import { param } from "../utils/url.js";
import { confirmAction, explainError, toast } from "../utils/ui.js";

const classId = param("class"), inviteToken = param("invite");
const grid = document.querySelector("#monitorGrid"), state = document.querySelector("#monitorState"), dialog = document.querySelector("#reviewDialog");
const monitorToolbar = document.querySelector("#monitorToolbar"), showMonitorToolbar = document.querySelector("#showMonitorToolbar"), smoothingButton = document.querySelector("#toggleSmoothing");
let user, classroom, students = [], presence = {}, page = 0, gridSize = loadGridSize(), teacherSmoothing = loadTeacherSmoothing();
let previewOffs = [], previewObservers = [], reviewOffs = [], reviewEngine, reviewStickyNotes, currentStudent, currentReviewPageId;
let rotateTimer, presenceOff, presenceRenderKey = "";

watchConnection(document.querySelector("#connectionBadge"));
document.querySelector("#teacherLink").href = `./teacher.html?class=${encodeURIComponent(classId || "")}`;

function loadGridSize() { try { return normalizeGridSize(localStorage.getItem(`classpad-grid-size:${classId}`)); } catch { return 4; } }
function loadTeacherSmoothing() { try { return localStorage.getItem("classpad-teacher-smoothing") !== "false"; } catch { return true; } }
function classPages() { return normalizeBoardPages(classroom?.boardPages); }
function pageNumber(pageId) { const index = classPages().findIndex((item) => item.id === pageId); return index < 0 ? 1 : index + 1; }
function renderSmoothingButton() { smoothingButton.classList.toggle("active", teacherSmoothing); smoothingButton.setAttribute("aria-pressed", String(teacherSmoothing)); smoothingButton.setAttribute("aria-label", teacherSmoothing ? "關閉手寫平滑" : "開啟手寫平滑"); smoothingButton.querySelector("span").textContent = `平滑：${teacherSmoothing ? "開" : "關"}`; }
function setToolbarHidden(hidden) { monitorToolbar.hidden = hidden; showMonitorToolbar.hidden = !hidden; document.body.classList.toggle("toolbar-hidden", hidden); try { localStorage.setItem("classpad-monitor-toolbar-hidden", String(hidden)); } catch {} }
document.querySelector("#hideMonitorToolbar").onclick = () => setToolbarHidden(true);
showMonitorToolbar.onclick = () => setToolbarHidden(false);
try { setToolbarHidden(localStorage.getItem("classpad-monitor-toolbar-hidden") === "true"); } catch { setToolbarHidden(false); }

function filtered() {
  const q = document.querySelector("#searchInput").value.trim().toLowerCase();
  const matches = students.filter((student) => (!q || `${student.seatNumber} ${student.displayName}`.toLowerCase().includes(q))
    && (!document.querySelector("#onlineOnly").checked || presence[student.id]?.online)
    && (!document.querySelector("#answeredOnly").checked || student.hasAnswer));
  return prioritizePinned(matches, classroom?.pinnedStudents);
}

function drawPreview(canvas, maps) {
  const rect = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) { canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, rect.width, rect.height);
  for (const map of maps) for (const stroke of map.values()) {
    const path = strokePathPoints(stroke.points || [], stroke.smooth); if (!path.length) continue;
    ctx.strokeStyle = stroke.color; ctx.globalAlpha = stroke.opacity ?? 1; ctx.lineWidth = Math.max(1, stroke.width * .35); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(path[0][0] * rect.width, path[0][1] * rect.height);
    for (let i = 1; i < path.length; i++) traceStrokeSegment(ctx, path, i, rect.width, rect.height, stroke.smooth);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function clearPreviews() { previewOffs.forEach((off) => off()); previewOffs = []; previewObservers.forEach((observer) => observer.disconnect()); previewObservers = []; }

function render() {
  if (dialog.open) { renderReviewPageControls(); return; }
  clearPreviews();
  const list = filtered(), view = paginateStudents(list, page, gridSize), visible = view.students, pinned = classroom?.pinnedStudents || {};
  page = view.page; grid.dataset.size = String(gridSize);
  document.querySelectorAll("[data-grid-size]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.gridSize) === gridSize)));
  document.querySelector("#pageLabel").textContent = `第 ${page + 1} / ${view.pages} 頁`; document.querySelector("#prevPage").disabled = page === 0; document.querySelector("#nextPage").disabled = page >= view.pages - 1;
  state.hidden = visible.length > 0; state.textContent = list.length ? "這一頁沒有學生。" : "沒有符合條件的學生。"; grid.hidden = !visible.length;
  grid.innerHTML = visible.map((student) => {
    const monitoredPage = selectMonitoredPage(presence[student.id], classroom?.boardPages);
    student.monitoredPageId = monitoredPage;
    return `<article class="preview-card" data-id="${student.id}"><div class="preview-head"><strong>${escapeHtml(student.seatNumber)} ${escapeHtml(student.displayName)}</strong><span class="preview-actions"><span class="badge">第 ${pageNumber(monitoredPage)} 頁</span><button class="pin-button" aria-label="${pinned[student.id] ? "取消釘選" : "釘選"} ${escapeHtml(student.displayName)}" aria-pressed="${Boolean(pinned[student.id])}">${pinned[student.id] ? "📌 已釘選" : "📌 釘選"}</button><span class="badge ${presence[student.id]?.online ? "online" : "offline"}">${presence[student.id]?.online ? (presence[student.id]?.drawing ? "書寫中" : "在線") : "離線"}</span>${student.locked ? " <span class=\"badge error\">鎖定</span>" : ""}</span></div><canvas class="preview-canvas"></canvas><button class="enlarge primary">放大批注</button></article>`;
  }).join("");
  visible.forEach((student) => {
    const card = grid.querySelector(`[data-id="${student.id}"]`), canvas = card.querySelector("canvas"), maps = [new Map(), new Map()], monitoredPage = student.monitoredPageId;
    const redraw = () => requestAnimationFrame(() => drawPreview(canvas, maps));
    previewOffs.push(
      subscribeLayer(student.boardToken, "studentStrokes", { add: (id, value) => { maps[0].set(id, value); student.hasAnswer = true; redraw(); }, remove: (id) => { maps[0].delete(id); redraw(); } }, monitoredPage),
      subscribeLayer(student.boardToken, "teacherStrokes", { add: (id, value) => { maps[1].set(id, value); redraw(); }, remove: (id) => { maps[1].delete(id); redraw(); } }, monitoredPage)
    );
    card.querySelector(".enlarge").onclick = () => openReview(student, monitoredPage);
    card.querySelector(".pin-button").onclick = async () => {
      const next = !Boolean(classroom.pinnedStudents?.[student.id]);
      try { await setStudentPinned(classId, student.id, next); classroom.pinnedStudents = { ...(classroom.pinnedStudents || {}) }; if (next) classroom.pinnedStudents[student.id] = true; else delete classroom.pinnedStudents[student.id]; page = 0; render(); } catch (error) { toast(explainError(error), "error"); }
    };
    const observer = new ResizeObserver(redraw); observer.observe(canvas); previewObservers.push(observer);
  });
}

function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }
async function loadStudents() { try { students = await getStudents(classroom); const pageIds = classPages().map((item) => item.id); await Promise.all(students.map(async (student) => { student.hasAnswer = await hasAnyAnswers(student.boardToken, pageIds); })); render(); } catch (error) { state.textContent = explainError(error); } }

async function init() {
  if (!classId) { state.textContent = "網址缺少課堂編號。"; return; }
  try {
    user = await ensureAnonymousUser();
    if (inviteToken) { state.textContent = "正在授權這台裝置…"; await claimTeacherInvite(classId, inviteToken, user.uid); const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete("invite"); history.replaceState(null, "", cleanUrl); toast("這台裝置已取得老師權限。"); }
    watchClassroom(classId, (value) => {
      if (!value) { state.textContent = "課堂不存在或權限不足。"; return; }
      const previousOrder = JSON.stringify(classroom?.studentOrder || {}); classroom = value; document.querySelector("#classTitle").textContent = value.title;
      if (!students.length || previousOrder !== JSON.stringify(value.studentOrder || {})) loadStudents(); else render();
    });
    presenceOff = watchPresence(classId, (value) => {
      presence = value;
      const nextKey = JSON.stringify(Object.entries(value).map(([studentId, item]) => [studentId, item.online, item.drawing, item.currentPageId, item.lastWrittenPageId]));
      if (nextKey !== presenceRenderKey) { presenceRenderKey = nextKey; render(); }
    });
  } catch (error) { state.textContent = explainError(error); }
}

function stopReviewPage() { reviewOffs.forEach((off) => off()); reviewOffs = []; reviewStickyNotes?.destroy(); reviewStickyNotes = null; reviewEngine?.destroy(); reviewEngine = null; }

function renderReviewPageControls() {
  if (!currentStudent) return;
  const pages = classPages(); let index = pages.findIndex((item) => item.id === currentReviewPageId);
  if (index < 0) { index = 0; currentReviewPageId = pages[0].id; }
  document.querySelector("#reviewPageLabel").textContent = `第 ${index + 1} / ${pages.length} 頁`;
  document.querySelector("#reviewPrevPage").disabled = index <= 0; document.querySelector("#reviewNextPage").disabled = index >= pages.length - 1;
  const select = document.querySelector("#insertPagePosition"), selected = Math.min(pages.length + 1, Number(select.value) || index + 2);
  select.innerHTML = Array.from({ length: pages.length + 1 }, (_, optionIndex) => `<option value="${optionIndex + 1}">插入為第 ${optionIndex + 1} 頁</option>`).join("");
  select.value = String(selected);
}

function openReviewPage(pageId) {
  const pages = classPages(); if (!pages.some((item) => item.id === pageId)) pageId = pages[0].id;
  stopReviewPage(); currentReviewPageId = pageId; const activePageId = pageId;
  reviewStickyNotes = new StickyNotesLayer({
    container: document.querySelector("#reviewStickyLayer"), editable: true,
    onChange: (id, patch) => updateStickyNote(currentStudent.boardToken, id, patch, activePageId),
    onDelete: (id) => confirmAction("確定刪除這張便條貼？") ? removeStickyNote(currentStudent.boardToken, id, activePageId) : undefined,
    onError: (error) => toast(explainError(error), "error")
  });
  const activeEngine = new BoardEngine({
    stage: document.querySelector("#reviewStage"), backgroundCanvas: document.querySelector("#reviewBackground"), studentCanvas: document.querySelector("#reviewStudent"), teacherCanvas: document.querySelector("#reviewTeacher"), editableLayer: "teacherStrokes", uid: user.uid,
    onComplete: (stroke) => saveStroke(currentStudent.boardToken, "teacherStrokes", stroke, activePageId).catch((error) => toast(explainError(error), "error")),
    onRemove: (id) => removeStroke(currentStudent.boardToken, "teacherStrokes", id, activePageId).catch((error) => toast(explainError(error), "error")),
    onViewChange: (view) => reviewStickyNotes?.setViewport(view)
  });
  reviewEngine = activeEngine; reviewEngine.setSmoothing(teacherSmoothing);
  reviewEngine.setTool(dialog.querySelector("button[data-tool].active")?.dataset.tool || "pen");
  reviewEngine.setColor(document.querySelector("#reviewColor").value);
  reviewEngine.setWidth(document.querySelector("#reviewWidth").value);
  reviewOffs = [
    subscribeLayer(currentStudent.boardToken, "studentStrokes", { add: (id, stroke) => activeEngine.addStroke("studentStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("studentStrokes", id) }, activePageId),
    subscribeLayer(currentStudent.boardToken, "teacherStrokes", { add: (id, stroke) => activeEngine.addStroke("teacherStrokes", id, stroke), remove: (id) => activeEngine.removeStroke("teacherStrokes", id) }, activePageId),
    subscribeStickyNotes(currentStudent.boardToken, { add: (id, note) => reviewStickyNotes?.upsert(id, note), change: (id, note) => reviewStickyNotes?.upsert(id, note), remove: (id) => reviewStickyNotes?.remove(id) }, activePageId)
  ];
  renderReviewPageControls();
}

async function openReview(student, pageId) {
  currentStudent = student; clearPreviews(); document.querySelector("#reviewName").textContent = `${student.seatNumber} ${student.displayName}`; document.querySelector("#reviewPresence").textContent = presence[student.id]?.online ? "在線" : "離線"; document.querySelector("#toggleLock").textContent = student.locked ? "解鎖白板" : "鎖定白板"; dialog.showModal(); openReviewPage(pageId);
}

function closeReview() { stopReviewPage(); currentStudent = null; currentReviewPageId = null; dialog.close(); render(); }
document.querySelector("#closeReview").onclick = closeReview;
dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeReview(); });
dialog.querySelectorAll("button[data-tool]").forEach((button) => button.onclick = () => { dialog.querySelectorAll("button[data-tool]").forEach((item) => item.classList.remove("active")); button.classList.add("active"); reviewEngine?.setTool(button.dataset.tool); });
document.querySelector("#reviewColor").oninput = (event) => reviewEngine?.setColor(event.target.value);
document.querySelector("#reviewWidth").oninput = (event) => reviewEngine?.setWidth(event.target.value);
document.querySelector("#reviewUndo").onclick = () => reviewEngine?.undo(); document.querySelector("#reviewRedo").onclick = () => reviewEngine?.redo(); document.querySelector("#reviewResetZoom").onclick = () => reviewEngine?.resetZoom();
smoothingButton.onclick = () => { teacherSmoothing = !teacherSmoothing; reviewEngine?.setSmoothing(teacherSmoothing); try { localStorage.setItem("classpad-teacher-smoothing", String(teacherSmoothing)); } catch {} renderSmoothingButton(); };
renderSmoothingButton();
document.querySelector("#reviewPrevPage").onclick = () => { const pages = classPages(), index = pages.findIndex((item) => item.id === currentReviewPageId); openReviewPage(pages[Math.max(0, index - 1)].id); };
document.querySelector("#reviewNextPage").onclick = () => { const pages = classPages(), index = pages.findIndex((item) => item.id === currentReviewPageId); openReviewPage(pages[Math.min(pages.length - 1, index + 1)].id); };
document.querySelector("#insertBlankPage").onclick = async (event) => {
  const button = event.currentTarget; button.disabled = true;
  try { const result = await insertClassBoardPage(classId, classroom, students, user.uid, Number(document.querySelector("#insertPagePosition").value)); classroom.boardPages = boardPagesMap(result.pages, { createdAt: classroom.createdAt, createdBy: user.uid }); openReviewPage(result.pageId); toast(`已插入為第 ${pageNumber(result.pageId)} 頁。`); } catch (error) { toast(explainError(error), "error"); } finally { button.disabled = false; }
};
document.querySelector("#addStickyNote").onclick = async () => { if (!currentStudent || !reviewStickyNotes) return; const offset = reviewStickyNotes.notes.size % 6; try { const id = await createStickyNote(currentStudent.boardToken, { text: "", color: document.querySelector("#stickyColor").value, x: +(.08 + offset * .04).toFixed(2), y: +(.08 + offset * .04).toFixed(2), width: .28, height: .22, authorUid: user.uid }, currentReviewPageId); reviewStickyNotes.focus(id); } catch (error) { toast(explainError(error), "error"); } };
document.querySelector("#toggleLock").onclick = async () => { try { await updateStudent(currentStudent.id, { locked: !currentStudent.locked }); currentStudent.locked = !currentStudent.locked; document.querySelector("#toggleLock").textContent = currentStudent.locked ? "解鎖白板" : "鎖定白板"; } catch (error) { toast(explainError(error), "error"); } };
document.querySelector("#clearTeacher").onclick = async () => { if (confirmAction("確定清除本頁全部老師批注？")) { await clearLayer(currentStudent.boardToken, "teacherStrokes", currentReviewPageId); reviewEngine?.clearLayerLocal("teacherStrokes"); } };
document.querySelector("#exportPng").onclick = () => { const source = reviewEngine.exportCanvas(), out = document.createElement("canvas"); out.width = 1600; out.height = 1280; const ctx = out.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out.width, out.height); ctx.fillStyle = "#173f5f"; ctx.font = "bold 30px sans-serif"; ctx.fillText(`${currentStudent.seatNumber} ${currentStudent.displayName}　第 ${pageNumber(currentReviewPageId)} 頁　${new Date().toLocaleString("zh-TW")}`, 30, 48); ctx.drawImage(source, 0, 80, 1600, 1200); out.toBlob((blob) => { const anchor = document.createElement("a"), stamp = new Date().toISOString().slice(0, 16).replaceAll(/[-:T]/g, ""); anchor.href = URL.createObjectURL(blob); anchor.download = `${currentStudent.seatNumber}-${currentStudent.displayName}-第${pageNumber(currentReviewPageId)}頁-${stamp}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 500); }); };

for (const id of ["searchInput", "onlineOnly", "answeredOnly"]) document.querySelector(`#${id}`).addEventListener(id === "searchInput" ? "input" : "change", () => { page = 0; render(); });
document.querySelectorAll("[data-grid-size]").forEach((button) => button.onclick = () => { gridSize = normalizeGridSize(button.dataset.gridSize); page = 0; try { localStorage.setItem(`classpad-grid-size:${classId}`, String(gridSize)); } catch {} render(); });
document.querySelector("#prevPage").onclick = () => { page--; render(); }; document.querySelector("#nextPage").onclick = () => { page++; render(); };
document.querySelector("#autoRotate").onchange = (event) => { clearInterval(rotateTimer); if (event.target.checked) rotateTimer = setInterval(() => { const pages = Math.max(1, Math.ceil(filtered().length / gridSize)); page = (page + 1) % pages; render(); }, 10000); };
addEventListener("pagehide", () => { clearPreviews(); presenceOff?.(); stopReviewPage(); clearInterval(rotateTimer); });

init();
