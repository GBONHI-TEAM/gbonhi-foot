'use client';

export type ExportCell = string | number | null | undefined;

function printable(value: ExportCell): string {
  const raw = value == null ? '' : String(value);
  return /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
}

function xml(value: ExportCell): string {
  return printable(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let value = index + 1;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Crée un fichier XLSX autonome, sans dépendance ni appel externe. */
export function createXlsxBlob(sheetName: string, rows: ExportCell[][]): Blob {
  const encoder = new TextEncoder();
  const safeSheetName = sheetName.slice(0, 31).replace(/[\\/*?:\[\]]/g, ' ') || 'Export';
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, cellIndex) => {
    const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
    const numeric = typeof cell === 'number' && Number.isFinite(cell);
    return numeric ? `<c r="${ref}"><v>${cell}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', sheet],
  ] as const;

  let offset = 0;
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = crc32(contentBytes);
    const local = concat([uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0), uint32(crc), uint32(contentBytes.length), uint32(contentBytes.length), uint16(nameBytes.length), uint16(0), nameBytes, contentBytes]);
    chunks.push(local);
    central.push(concat([uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0), uint32(crc), uint32(contentBytes.length), uint32(contentBytes.length), uint16(nameBytes.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes]));
    offset += local.length;
  }
  const centralBytes = concat(central);
  const end = concat([uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length), uint32(centralBytes.length), uint32(offset), uint16(0)]);
  const zip = concat([...chunks, centralBytes, end]);
  const buffer = new ArrayBuffer(zip.byteLength);
  new Uint8Array(buffer).set(zip);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** PDF léger et imprimable pour les synthèses administratives courtes. */
export function createPdfBlob(title: string, period: string, rows: Array<[string, ExportCell]>): Blob {
  const ascii = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/[()\\]/g, '\\$&');
  const text = (x: number, y: number, size: number, value: string, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
  const body = rows.slice(0, 28).flatMap(([label, value], index) => {
    const y = 590 - index * 18;
    return [index % 2 === 0 ? `0.95 0.97 0.95 rg 42 ${y - 5} 511 16 re f` : '', '0.10 0.24 0.16 rg', text(58, y, 10, label), text(355, y, 10, printable(value), true)].filter(Boolean);
  });
  const content = ['0.10 0.24 0.16 rg 0 0 595 842 re f', '1 1 1 rg', text(42, 800, 21, 'GBONHI FOOT', true), text(42, 778, 10, 'BACK-OFFICE ADMINISTRATEUR'), '0.969 0.573 0.118 rg 42 754 511 4 re f', '1 1 1 rg', text(42, 710, 22, title, true), text(42, 688, 11, `Periode : ${period}`), '1 1 1 rg 42 630 511 26 re f', '0.10 0.24 0.16 rg', text(58, 640, 10, 'INDICATEUR', true), text(355, 640, 10, 'VALEUR', true), ...body, '0.45 0.45 0.45 rg', text(42, 72, 9, 'Document genere automatiquement par GBONHI FOOT.'), text(42, 54, 9, `Edition : ${new Date().toLocaleDateString('fr-FR')}`)].join('\n');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>', `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = new TextEncoder().encode(output).length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((entry) => `${String(entry).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([output], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
