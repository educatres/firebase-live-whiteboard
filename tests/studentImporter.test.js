import { describe, expect, it } from "vitest";
import { filterDuplicateStudents, parseStudentList, STUDENT_IMPORT_EXAMPLE } from "../src/teacher/studentImporter.js";

describe("學生名單解析", () => {
  it("提供 10 筆可直接匯入的學生範例", () => {
    const students = parseStudentList(STUDENT_IMPORT_EXAMPLE);
    expect(students).toHaveLength(10);
    expect(students[0]).toEqual({ seatNumber: "01", displayName: "王小明" });
    expect(students[9]).toEqual({ seatNumber: "10", displayName: "林冠廷" });
  });
  it("解析座號與姓名並忽略空白行", () => expect(parseStudentList("01 王小明\n\n02 陳小華")).toEqual([{seatNumber:"01",displayName:"王小明"},{seatNumber:"02",displayName:"陳小華"}]));
  it("沒有座號時自動編號", () => expect(parseStudentList("小明\n小華",3).map(x=>x.seatNumber)).toEqual(["03","04"]));
  it("接受英數座號", () => expect(parseStudentList("A1 小明")[0].seatNumber).toBe("A1"));
  it("略過同批及既有的相同座號姓名", () => {
    const input = parseStudentList("01 王小明\n01 王小明\n02 陳小華");
    expect(filterDuplicateStudents(input, [{ seatNumber: "02", displayName: "陳小華" }])).toEqual({ students: [{ seatNumber: "01", displayName: "王小明" }], skipped: 2 });
  });
  it("座號或姓名不同時仍可加入", () => {
    const input = [{ seatNumber: "01", displayName: "王小明" }, { seatNumber: "01", displayName: "王小華" }, { seatNumber: "02", displayName: "王小明" }];
    expect(filterDuplicateStudents(input).students).toHaveLength(3);
  });
});
