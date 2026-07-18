import fs from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { get, ref, set, update } from "firebase/database";

let env;const projectId="classpad-rules-test",classId="class123",studentId="student123",token="abcdefghijklmnopqrstuvwx";
beforeAll(async()=>{env=await initializeTestEnvironment({projectId,database:{rules:fs.readFileSync("database.rules.json","utf8"),host:"127.0.0.1",port:9000}});await env.withSecurityRulesDisabled(async context=>set(ref(context.database()),{classes:{[classId]:{title:"測試",className:"",activityName:"",createdAt:1,updatedAt:1,status:"active",allowStudentWriting:true,allowStudentClear:false,showTeacherAnnotations:true,studentCount:1,admins:{teacher:true},studentOrder:{[studentId]:0}}},students:{[studentId]:{classId,boardToken:token,seatNumber:"01",displayName:"小明",studentUid:"student",enabled:true,locked:false,createdAt:1,updatedAt:1}},boardLookup:{[token]:{classId,studentId}},boards:{[token]:{meta:{classId,studentId,revision:0,updatedAt:1}}},userClasses:{teacher:{[classId]:true}}}));});
afterAll(()=>env?.cleanup());
const stroke=(uid,color="#112233")=>({id:"stroke_1",tool:"pen",color,width:4,opacity:1,points:[[.1,.1,.5,0],[.2,.2,.5,10]],createdAt:2,authorUid:uid});
describe("Realtime Database 權限",()=>{
  it("老師可讀課堂與寫批注",async()=>{const db=env.authenticatedContext("teacher").database();await assertSucceeds(get(ref(db,`classes/${classId}`)));await assertSucceeds(set(ref(db,`boards/${token}/teacherStrokes/stroke_1`),stroke("teacher")));});
  it("學生可寫自己的筆跡且不能寫老師圖層",async()=>{const db=env.authenticatedContext("student").database();await assertSucceeds(set(ref(db,`boards/${token}/studentStrokes/stroke_1`),stroke("student")));await assertFails(set(ref(db,`boards/${token}/teacherStrokes/stroke_2`),{...stroke("student"),id:"stroke_2"}));});
  it("學生不能修改姓名或把自己加入管理員",async()=>{const db=env.authenticatedContext("student").database();await assertFails(update(ref(db,`students/${studentId}`),{displayName:"惡意修改"}));await assertFails(set(ref(db,`classes/${classId}/admins/student`),true));});
  it("其他人不能讀學生資料或筆跡",async()=>{const db=env.authenticatedContext("other").database();await assertFails(get(ref(db,`students/${studentId}`)));await assertFails(get(ref(db,`boards/${token}/studentStrokes`)));});
  it("拒絕非法顏色與未登入存取",async()=>{const db=env.authenticatedContext("student").database();await assertFails(set(ref(db,`boards/${token}/studentStrokes/stroke_1`),stroke("student","red")));await assertFails(get(ref(env.unauthenticatedContext().database(),`boardLookup/${token}`)));});
});
