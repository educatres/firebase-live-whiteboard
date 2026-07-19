import { ensureAnonymousUser, ensureFreshAnonymousUser, isInvalidAuthTokenError, renewAnonymousUser } from "../firebase/auth.js";
import { cleanupExpiredClassroom, createClassroom, listMyClasses } from "../firebase/classroomRepository.js";
import { watchConnection } from "../firebase/connection.js";
import { rememberTeacherSession } from "../teacher/localSession.js";
import { clearBrowserRecords } from "../utils/browserRecords.js";
import { classroomHistoryStats, rememberVisibleClassrooms } from "../utils/classroomStats.js";
import { bindDialogClose, confirmAction, explainError, toast } from "../utils/ui.js";

const list=document.querySelector("#classList"),dialog=document.querySelector("#createDialog"),form=document.querySelector("#createClassForm"),createdCount=document.querySelector("#createdClassCount"),deletedCount=document.querySelector("#deletedClassCount");let user;
bindDialogClose(dialog);
function renderStats(){const counts=classroomHistoryStats();createdCount.textContent=counts.created;deletedCount.textContent=counts.deleted;}
async function load(){renderStats();try{user ||= await ensureAnonymousUser();const classes=await listMyClasses(user.uid),active=[];rememberVisibleClassrooms(classes);for(const classroom of classes){try{if(await cleanupExpiredClassroom(classroom.id,user.uid,classroom))continue;}catch(error){console.error(error);}active.push(classroom);}renderStats();list.innerHTML=active.length?active.map(c=>`<article class="class-card"><span class="badge ${c.status==='active'?'online':''}">${c.status==='active'?'進行中':'已結束'}</span><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.className||'未設定班級')}・${c.studentCount||0} 位學生</p><div class="card-actions"><a class="button-link" href="./teacher.html?class=${c.id}">課堂設定</a><a class="button-link" href="./monitor.html?class=${c.id}">多格監看</a></div></article>`).join(""):'<div class="empty">這個瀏覽器尚未建立課堂。</div>';}catch(e){list.innerHTML=`<div class="notice">${escapeHtml(explainError(e))}</div>`;}}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v);return d.innerHTML;}
document.querySelector("#createClassBtn").onclick=()=>dialog.showModal();document.querySelector("#refreshBtn").onclick=load;
document.querySelector("#clearBrowserRecordsBtn").onclick=()=>{if(!confirmAction("這會清除本網站儲存在此瀏覽器的老師登入暫存、歷史課程統計與介面偏好，但不會刪除資料庫中的課堂與作品。若未保存老師網址與六位數密鑰，可能無法再次進入課程。確定清除？"))return;if(!clearBrowserRecords())return toast("無法清除瀏覽記錄，請檢查瀏覽器儲存空間設定。","error");renderStats();toast("已清除本網站的瀏覽記錄。")};
form.addEventListener("submit",async(e)=>{e.preventDefault();const button=form.querySelector("button.primary"),values=Object.fromEntries(new FormData(form));button.disabled=true;try{user=await ensureFreshAnonymousUser();let id;try{id=await createClassroom(user.uid,values);}catch(error){if(!isInvalidAuthTokenError(error))throw error;user=await renewAnonymousUser();id=await createClassroom(user.uid,values);}rememberTeacherSession(id,user.uid);location.replace(`./teacher.html?class=${id}`);}catch(error){toast(explainError(error),"error");button.disabled=false;}});
watchConnection(document.querySelector("#connectionBadge"));load();
