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
