import { ensureAnonymousUser } from "../firebase/auth.js";
import { cleanupExpiredClassroom, createClassroom, listMyClasses } from "../firebase/classroomRepository.js";
import { watchConnection } from "../firebase/connection.js";
import { rememberTeacherSession } from "../teacher/localSession.js";
import { countClassroomStatuses } from "../utils/classroomStats.js";
import { bindDialogClose, explainError, toast } from "../utils/ui.js";

const list=document.querySelector("#classList"),dialog=document.querySelector("#createDialog"),form=document.querySelector("#createClassForm"),activeCount=document.querySelector("#activeClassCount"),inactiveCount=document.querySelector("#inactiveClassCount");let user;
bindDialogClose(dialog);
function renderStats(classrooms){const counts=countClassroomStatuses(classrooms);activeCount.textContent=counts.active;inactiveCount.textContent=counts.inactive;}
async function load(){try{user ||= await ensureAnonymousUser();const classes=await listMyClasses(user.uid),active=[];for(const classroom of classes){try{if(await cleanupExpiredClassroom(classroom.id,user.uid,classroom))continue;}catch(error){console.error(error);}active.push(classroom);}renderStats(active);list.innerHTML=active.length?active.map(c=>`<article class="class-card"><span class="badge ${c.status==='active'?'online':''}">${c.status==='active'?'進行中':'已結束'}</span><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.className||'未設定班級')}・${c.studentCount||0} 位學生</p><div class="card-actions"><a class="button-link" href="./teacher.html?class=${c.id}">課堂設定</a><a class="button-link" href="./monitor.html?class=${c.id}">多格監看</a></div></article>`).join(""):'<div class="empty">這個瀏覽器尚未建立課堂。</div>';}catch(e){activeCount.textContent="—";inactiveCount.textContent="—";list.innerHTML=`<div class="notice">${escapeHtml(explainError(e))}</div>`;}}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v);return d.innerHTML;}
document.querySelector("#createClassBtn").onclick=()=>dialog.showModal();document.querySelector("#refreshBtn").onclick=load;
form.addEventListener("submit",async(e)=>{e.preventDefault();const button=form.querySelector("button.primary");button.disabled=true;try{const id=await createClassroom(user.uid,Object.fromEntries(new FormData(form)));rememberTeacherSession(id,user.uid);location.replace(`./teacher.html?class=${id}`);}catch(error){toast(explainError(error),"error");button.disabled=false;}});
watchConnection(document.querySelector("#connectionBadge"));load();
