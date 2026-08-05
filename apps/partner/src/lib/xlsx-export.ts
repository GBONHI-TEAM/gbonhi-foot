'use client';

type Cell = string | number | null | undefined;

const encoder = new TextEncoder();
const escapeXml = (value: Cell) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const column = (index: number) => { let n = index + 1; let result = ''; while (n) { const rem = (n - 1) % 26; result = String.fromCharCode(65 + rem) + result; n = Math.floor((n - 1) / 26); } return result; };
const concat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((sum, item) => sum + item.length, 0)); let offset = 0; parts.forEach((item) => { out.set(item, offset); offset += item.length; }); return out; };
const u16 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255]);
const u32 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
function crc32(bytes: Uint8Array): number { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }

/** Fichier Excel réel, sans SDK externe ni transit par un service tiers. */
export function createXlsxBlob(sheetName: string, rows: Cell[][]): Blob {
  const name = sheetName.slice(0, 31).replace(/[\\/*?:\[\]]/g, ' ') || 'Export';
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, ri) => `<row r="${ri + 1}">${row.map((cell, ci) => typeof cell === 'number' ? `<c r="${column(ci)}${ri + 1}"><v>${cell}</v></c>` : `<c r="${column(ci)}${ri + 1}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ] as const;
  let offset = 0; const locals: Uint8Array[] = []; const central: Uint8Array[] = [];
  files.forEach(([path, content]) => { const pathBytes = encoder.encode(path); const contentBytes = encoder.encode(content); const crc = crc32(contentBytes); const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(contentBytes.length), u32(contentBytes.length), u16(pathBytes.length), u16(0), pathBytes, contentBytes]); locals.push(local); central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(contentBytes.length), u32(contentBytes.length), u16(pathBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), pathBytes])); offset += local.length; });
  const directory = concat(central); const zip = concat([...locals, directory, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)]); const buffer = new ArrayBuffer(zip.byteLength); new Uint8Array(buffer).set(zip);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
