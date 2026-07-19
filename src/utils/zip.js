const encoder = new TextEncoder();

function table() {
  const values = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    values[n] = value >>> 0;
  }
  return values;
}

const CRC_TABLE = table();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

function view(size) {
  const bytes = new Uint8Array(size);
  return { bytes, data: new DataView(bytes.buffer) };
}

function asBlob(data) {
  if (data instanceof Blob) return data;
  if (typeof data === "string") return new Blob([encoder.encode(data)]);
  if (data instanceof ArrayBuffer) return new Blob([new Uint8Array(data)]);
  if (ArrayBuffer.isView(data)) return new Blob([new Uint8Array(data.buffer, data.byteOffset, data.byteLength)]);
  throw new TypeError("ZIP 項目必須是文字、Blob 或位元組資料。");
}

export async function createStoredZip(files, modifiedAt = new Date()) {
  const localParts = [], centralParts = [];
  const { date, time } = dosDateTime(modifiedAt);
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name), blob = asBlob(file.data), size = blob.size;
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error("匯出資料太大，無法建立 ZIP 檔案。");
    const checksum = crc32(new Uint8Array(await blob.arrayBuffer()));
    const local = view(30 + name.length);
    local.data.setUint32(0, 0x04034b50, true);
    local.data.setUint16(4, 20, true);
    local.data.setUint16(6, 0x0800, true);
    local.data.setUint16(8, 0, true);
    local.data.setUint16(10, time, true);
    local.data.setUint16(12, date, true);
    local.data.setUint32(14, checksum, true);
    local.data.setUint32(18, size, true);
    local.data.setUint32(22, size, true);
    local.data.setUint16(26, name.length, true);
    local.bytes.set(name, 30);
    localParts.push(local.bytes, blob);

    const central = view(46 + name.length);
    central.data.setUint32(0, 0x02014b50, true);
    central.data.setUint16(4, 20, true);
    central.data.setUint16(6, 20, true);
    central.data.setUint16(8, 0x0800, true);
    central.data.setUint16(10, 0, true);
    central.data.setUint16(12, time, true);
    central.data.setUint16(14, date, true);
    central.data.setUint32(16, checksum, true);
    central.data.setUint32(20, size, true);
    central.data.setUint32(24, size, true);
    central.data.setUint16(28, name.length, true);
    central.data.setUint32(42, offset, true);
    central.bytes.set(name, 46);
    centralParts.push(central.bytes);
    offset += local.bytes.length + size;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = view(22);
  end.data.setUint32(0, 0x06054b50, true);
  end.data.setUint16(8, files.length, true);
  end.data.setUint16(10, files.length, true);
  end.data.setUint32(12, centralSize, true);
  end.data.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end.bytes], { type: "application/zip" });
}
