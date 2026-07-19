export const STUDENT_IMPORT_EXAMPLE = `01 王小明
02 陳小華
03 林小美
04 張志豪
05 李佳穎
06 吳承翰
07 劉品妤
08 黃柏宇
09 蔡宜庭
10 林冠廷`;

export function parseStudentList(text, start = 1) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line, index) => {
    const match = line.match(/^([0-9A-Za-z]+)\s+(.+)$/);
    const seatNumber = match ? match[1] : String(start + index).padStart(2, "0");
    const displayName = (match ? match[2] : line).trim();
    if (!displayName || displayName.length > 50 || seatNumber.length > 20) throw new Error(`第 ${index + 1} 行格式不正確。`);
    return { seatNumber, displayName };
  });
}

function studentIdentity(student) {
  const seatNumber = String(student?.seatNumber || "").normalize("NFKC").trim();
  const displayName = String(student?.displayName || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  return `${seatNumber}\u0000${displayName}`;
}

export function filterDuplicateStudents(input, existing = []) {
  const seen = new Set(existing.map(studentIdentity));
  const students = [];
  let skipped = 0;
  for (const student of input) {
    const identity = studentIdentity(student);
    if (seen.has(identity)) { skipped++; continue; }
    seen.add(identity);
    students.push(student);
  }
  return { students, skipped };
}
