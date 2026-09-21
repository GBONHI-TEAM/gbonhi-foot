'use client';

import { RECEIPT_HEADER_MOTIF_JPEG_BASE64, RECEIPT_LOGO_RGB_JPEG_BASE64, RECEIPT_LOGO_MASK_JPEG_BASE64 } from './receipt-brand';

export type ExportCell = string | number | null | undefined;

const MOTIF_W = 1190, MOTIF_H = 194;
const LOGO_T = 220; // écusson détouré (RGB + masque), 220x220

/** base64 → octets (images JPEG binaires du PDF). */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** chaîne → octets latin1 (contenu texte du PDF). */
function latin1(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

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

// ─── Chrome de marque commun à TOUS les PDF admin (identité unifiée) ─────────
// Fond vert plein + bandeau motif GBONHI + écusson détouré (transparent via
// /SMask, donc sans carré/ombre). Utilisé par createPdfBlob ET createReceiptPdfBlob.

const brandAscii = (value: string) => value.normalize('NFD').replace(/[^\x20-\x7E]/g, ' ').replace(/[()\\]/g, '\\$&');
const brandText = (x: number, y: number, size: number, value: string, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${brandAscii(value)}) Tj ET`;

/** En-tête de marque : fond vert, motif, écusson, titre. */
function brandHeaderOps(title: string, subtitle: string): string[] {
  return [
    '0.102 0.371 0.175 rg 0 0 595 842 re f',
    'q 595 0 0 95 0 747 cm /Im1 Do Q',
    'q 56 0 0 56 484 765 cm /Im0 Do Q',
    '1 1 1 rg', brandText(42, 804, 22, 'GBONHI FOOT', true),
    '0.82 0.90 0.84 rg', brandText(42, 784, 9, subtitle),
    '0.969 0.573 0.118 rg 0 744 595 4 re f',
    '1 1 1 rg', brandText(42, 712, 20, title, true),
  ];
}

/** Objets PDF communs (fonts + contenu + écusson détouré /SMask + motif). */
function brandObjects(contentBytes: Uint8Array): Array<{ head: string; stream?: Uint8Array }> {
  const logoRgb = b64ToBytes(RECEIPT_LOGO_RGB_JPEG_BASE64);
  const logoMask = b64ToBytes(RECEIPT_LOGO_MASK_JPEG_BASE64);
  const motif = b64ToBytes(RECEIPT_HEADER_MOTIF_JPEG_BASE64);
  return [
    { head: '<< /Type /Catalog /Pages 2 0 R >>' },
    { head: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { head: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im0 7 0 R /Im1 8 0 R >> >> /Contents 6 0 R >>' },
    { head: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' },
    { head: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' },
    { head: `<< /Length ${contentBytes.length} >>`, stream: contentBytes },
    { head: `<< /Type /XObject /Subtype /Image /Width ${LOGO_T} /Height ${LOGO_T} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /SMask 9 0 R /Length ${logoRgb.length} >>`, stream: logoRgb },
    { head: `<< /Type /XObject /Subtype /Image /Width ${MOTIF_W} /Height ${MOTIF_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${motif.length} >>`, stream: motif },
    { head: `<< /Type /XObject /Subtype /Image /Width ${LOGO_T} /Height ${LOGO_T} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoMask.length} >>`, stream: logoMask },
  ];
}

/** Sérialise les objets en un PDF binaire (xref, trailer). */
function assembleBrandPdf(objects: Array<{ head: string; stream?: Uint8Array }>): Blob {
  const parts: Uint8Array[] = [];
  let length = 0;
  const push = (u: Uint8Array) => { parts.push(u); length += u.length; };
  push(latin1('%PDF-1.4\n'));
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(length);
    push(latin1(`${index + 1} 0 obj\n`));
    if (obj.stream) {
      push(latin1(`${obj.head}\nstream\n`));
      push(obj.stream);
      push(latin1('\nendstream\nendobj\n'));
    } else {
      push(latin1(`${obj.head}\nendobj\n`));
    }
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { xref += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  push(latin1(xref));
  const out = new Uint8Array(length);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return new Blob([out.buffer], { type: 'application/pdf' });
}

/** PDF de synthèse administrative (identité de marque unifiée, sans tableau
 *  « INDICATEUR/VALEUR » : libellés/valeurs explicites sur fond vert). */
export function createPdfBlob(title: string, period: string, rows: Array<[string, ExportCell]>): Blob {
  const ops: string[] = [...brandHeaderOps(title, 'Back-office administrateur')];
  ops.push('0.78 0.87 0.80 rg', brandText(42, 690, 10, `Periode : ${period}`));
  ops.push('0.29 0.49 0.35 rg 42 668 511 1 re f');
  let y = 644;
  for (const [label, value] of rows.slice(0, 26)) {
    ops.push('0.82 0.90 0.84 rg', brandText(48, y, 10, label));
    ops.push('1 1 1 rg', brandText(330, y, 10, printable(value), true));
    y -= 22;
  }
  ops.push('0.72 0.85 0.76 rg', brandText(42, 72, 9, 'Document genere automatiquement par GBONHI FOOT.'));
  ops.push('0.72 0.85 0.76 rg', brandText(42, 54, 9, `Edition : ${new Date().toLocaleDateString('fr-FR')}`));
  return assembleBrandPdf(brandObjects(latin1(ops.join('\n'))));
}

/**
 * Reçu de paiement clair et imprimable (fond blanc, en-tête vert de marque,
 * SANS logo sur fond sombre ni colonnes « INDICATEUR/VALEUR »). Met en avant le
 * montant et le statut, avec des libellés explicites et une zone de signature.
 */
export function createReceiptPdfBlob(opts: {
  docTitle: string;
  reference: string;
  dateLabel: string;
  statusLabel?: string;
  beneficiary: { name: string; sub?: string };
  lines: Array<[string, string]>;
  highlight: { label: string; value: string };
  payment: Array<[string, string]>;
  footerNote?: string;
}): Blob {
  const ascii = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/[()\\]/g, '\\$&');
  const T = (x: number, y: number, size: number, value: string, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
  const ops: string[] = [];

  // Corps en VERT PLEIN = fond du logo/motif (rgb ~26,95,44) : le motif d'en-tête
  // ET le logo s'y posent sans démarcation (même vert), donc pas de carré/ombre.
  ops.push('0.102 0.371 0.175 rg 0 0 595 842 re f');
  ops.push('q 595 0 0 95 0 747 cm /Im1 Do Q'); // bandeau motif GBONHI
  ops.push('q 56 0 0 56 484 765 cm /Im0 Do Q'); // écusson détouré (transparent) -> aucun carré
  ops.push('1 1 1 rg', T(42, 804, 22, 'GBONHI FOOT', true));
  ops.push('0.82 0.90 0.84 rg', T(42, 784, 9, 'Recu officiel de paiement'));
  ops.push('0.969 0.573 0.118 rg 0 744 595 4 re f');

  // Titre + statut + référence/date.
  ops.push('1 1 1 rg', T(42, 712, 20, opts.docTitle, true));
  if (opts.statusLabel) {
    ops.push('0.969 0.573 0.118 rg 448 706 105 24 re f');
    ops.push('0.086 0.157 0.086 rg', T(468, 713, 12, opts.statusLabel, true));
  }
  ops.push('0.78 0.87 0.80 rg', T(42, 690, 10, `${opts.reference}   -   ${opts.dateLabel}`));

  // Bénéficiaire.
  ops.push('0.72 0.85 0.76 rg', T(42, 662, 9, 'BENEFICIAIRE'));
  ops.push('1 1 1 rg', T(42, 644, 13, opts.beneficiary.name, true));
  if (opts.beneficiary.sub) ops.push('0.78 0.87 0.80 rg', T(42, 628, 9, opts.beneficiary.sub));
  ops.push('0.29 0.49 0.35 rg 42 614 511 1 re f');

  // Détail.
  ops.push('0.72 0.85 0.76 rg', T(42, 594, 9, 'DETAIL DU VERSEMENT'));
  let y = 570;
  for (const [label, value] of opts.lines) {
    ops.push('0.82 0.90 0.84 rg', T(48, y, 10, label));
    ops.push('1 1 1 rg', T(330, y, 10, value, true));
    y -= 22;
  }

  // Montant net mis en avant (bandeau orange, texte foncé).
  y -= 8;
  ops.push(`0.969 0.573 0.118 rg 42 ${y - 20} 511 44 re f`);
  ops.push('0.086 0.157 0.086 rg', T(58, y + 2, 10, opts.highlight.label, true), T(330, y - 2, 17, opts.highlight.value, true));
  y -= 50;

  // Paiement.
  ops.push('0.72 0.85 0.76 rg', T(42, y, 9, 'PAIEMENT'));
  y -= 22;
  for (const [label, value] of opts.payment) {
    ops.push('0.82 0.90 0.84 rg', T(48, y, 10, label));
    ops.push('1 1 1 rg', T(330, y, 10, value, true));
    y -= 22;
  }

  // Signature + pied de page.
  ops.push('0.29 0.49 0.35 rg 355 140 198 1 re f');
  ops.push('0.72 0.85 0.76 rg', T(355, 124, 9, 'Signature / cachet'));
  ops.push('0.72 0.85 0.76 rg', T(42, 96, 9, opts.footerNote ?? 'Document genere automatiquement par GBONHI FOOT.'));
  ops.push('0.72 0.85 0.76 rg', T(42, 80, 9, `Edite le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`));

  return assembleBrandPdf(brandObjects(latin1(ops.join('\n'))));
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
