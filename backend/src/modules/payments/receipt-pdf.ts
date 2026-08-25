import { RECEIPT_LOGO_JPEG_BASE64 } from './receipt-logo';
import { RECEIPT_HEADER_MOTIF_JPEG_BASE64 } from './receipt-header-motif';

interface ReceiptPdfInput {
  reference: string;
  terrainName: string;
  address: string;
  date: string;
  time: string;
  duration: string;
  amount: string;
  paymentMethod: string;
}

interface LeagueReceiptPdfInput {
  reference: string;
  leagueName: string;
  teamName: string;
  dates: string;
  location: string;
  amount: string;
  paymentMethod: string;
}

interface PartnerRevenueStatementPdfInput {
  reference: string;
  partnerName: string;
  period: string;
  totalNet: string;
  reservationCount: number;
  lines: Array<{ date: string; terrain: string; amount: string }>;
}

const LOGO = { data: Buffer.from(RECEIPT_LOGO_JPEG_BASE64, 'base64'), width: 150, height: 150 };
const HEADER_MOTIF = { data: Buffer.from(RECEIPT_HEADER_MOTIF_JPEG_BASE64, 'base64'), width: 1190, height: 194 };
// Bandeau vert de l'en-tête (haut de page A4) : y 745, hauteur 97, largeur 595.
const HEADER_BAND = 'q 595 0 0 97 0 745 cm /Im1 Do Q';

// Quelques caractères WinAnsi hors Latin-1 direct (apostrophes typographiques, œ…).
const WINANSI_SPECIAL: Record<string, number> = {
  '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94,
  '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c,
  '€': 0x80, '•': 0x95, '…': 0x85,
};

/**
 * Encode une chaîne pour un flux PDF avec police en WinAnsiEncoding : l'ASCII
 * imprimable passe tel quel, les caractères accentués (é, à, ç, É, Ç…) sont
 * échappés en octal sur leur code WinAnsi afin d'être rendus correctement.
 */
function pdfStr(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '(' || ch === ')' || ch === '\\') { out += '\\' + ch; continue; }
    const code = ch.codePointAt(0) ?? 32;
    if (code >= 0x20 && code <= 0x7e) { out += ch; continue; }
    let byte: number | undefined;
    if (code >= 0xa0 && code <= 0xff) byte = code;
    else if (WINANSI_SPECIAL[ch] !== undefined) byte = WINANSI_SPECIAL[ch];
    if (byte === undefined) { out += ' '; continue; }
    out += '\\' + byte.toString(8).padStart(3, '0');
  }
  return out;
}

function text(x: number, y: number, size: number, value: string, font = 'F1'): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfStr(value)}) Tj ET`;
}

/** Dessine le logo (XObject Im0) à la position/échelle voulue. */
function drawLogo(x: number, y: number, size: number): string {
  return `q ${size} 0 0 ${size} ${x} ${y} cm /Im0 Do Q`;
}

type PdfObject = string | { head: string; stream: Buffer };

/** Assemble un PDF binaire (supporte les flux binaires comme les images JPEG). */
function buildPdf(objects: PdfObject[]): Buffer {
  const chunks: Buffer[] = [];
  let length = 0;
  const add = (part: Buffer | string) => {
    const buf = typeof part === 'string' ? Buffer.from(part, 'latin1') : part;
    chunks.push(buf);
    length += buf.length;
  };
  add('%PDF-1.4\n');
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(length);
    add(`${index + 1} 0 obj\n`);
    if (typeof obj === 'string') {
      add(`${obj}\nendobj\n`);
    } else {
      add(`${obj.head}\nstream\n`);
      add(obj.stream);
      add('\nendstream\nendobj\n');
    }
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { xref += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  add(xref);
  return Buffer.concat(chunks);
}

/** Objets communs d'un reçu A4 avec le logo GBONHI FOOT embarqué. */
function receiptObjects(content: string): PdfObject[] {
  const contentBuf = Buffer.from(content, 'latin1');
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im0 7 0 R /Im1 8 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    { head: `<< /Length ${contentBuf.length} >>`, stream: contentBuf },
    {
      head: `<< /Type /XObject /Subtype /Image /Width ${LOGO.width} /Height ${LOGO.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${LOGO.data.length} >>`,
      stream: LOGO.data,
    },
    {
      head: `<< /Type /XObject /Subtype /Image /Width ${HEADER_MOTIF.width} /Height ${HEADER_MOTIF.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${HEADER_MOTIF.data.length} >>`,
      stream: HEADER_MOTIF.data,
    },
  ];
}

/** Reçu PDF autonome, sans dépendance native, compatible iOS/Android et impression. */
export function createReservationReceiptPdf(input: ReceiptPdfInput): Buffer {
  const content = [
    '0.051 0.122 0.051 rg 0 0 595 842 re f',
    '0.118 0.478 0.227 rg 0 745 595 97 re f',
    // Motif ivoirien couvrant tout le bandeau vert
    HEADER_BAND,
    // Logo GBONHI FOOT (à droite du bandeau vert)
    drawLogo(474, 758, 64),
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'Le football amateur commence ici'),
    '0.969 0.573 0.118 rg',
    '42 732 511 4 re f',
    '1 1 1 rg',
    text(42, 690, 24, 'REÇU DE RÉSERVATION', 'F2'),
    text(42, 668, 11, `Référence : ${input.reference}`),
    '0.08 0.16 0.09 rg 42 430 511 210 re f',
    '1 1 1 rg',
    text(66, 607, 10, 'TERRAIN'),
    text(66, 584, 17, input.terrainName, 'F2'),
    text(66, 563, 10, input.address),
    '0.9 0.9 0.9 RG 66 545 m 529 545 l S',
    '0.75 0.75 0.75 rg',
    text(66, 520, 10, 'DATE'),
    text(300, 520, 10, 'CRÉNEAU'),
    text(66, 499, 14, input.date, 'F2'),
    text(300, 499, 14, input.time, 'F2'),
    text(66, 467, 10, `Durée : ${input.duration}`),
    text(300, 467, 10, `Paiement : ${input.paymentMethod}`),
    '0.969 0.573 0.118 rg 42 359 511 50 re f',
    '1 1 1 rg',
    text(66, 389, 11, 'MONTANT PAYÉ'),
    text(374, 381, 18, input.amount, 'F2'),
    '0.65 0.65 0.65 rg',
    text(42, 312, 10, 'Ce reçu atteste de la confirmation de votre réservation.'),
    text(42, 294, 10, 'Conservez-le et présentez votre référence au terrain.'),
    text(42, 74, 9, 'GBONHI FOOT — Plateforme du football amateur en Côte d’Ivoire'),
    text(42, 56, 9, 'Le football amateur commence ici !'),
  ].join('\n');
  return buildPdf(receiptObjects(content));
}

/** Reçu d'inscription de ligue, avec la même identité GBONHI FOOT. */
export function createLeagueRegistrationReceiptPdf(input: LeagueReceiptPdfInput): Buffer {
  const content = [
    '0.051 0.122 0.051 rg 0 0 595 842 re f',
    '0.118 0.478 0.227 rg 0 745 595 97 re f',
    HEADER_BAND,
    drawLogo(474, 758, 64),
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'Le football amateur commence ici'),
    '0.969 0.573 0.118 rg 42 732 511 4 re f',
    '1 1 1 rg',
    text(42, 690, 24, 'REÇU D’INSCRIPTION LEAGUE', 'F2'),
    text(42, 668, 11, `Référence : ${input.reference}`),
    '0.08 0.16 0.09 rg 42 430 511 210 re f',
    '1 1 1 rg',
    text(66, 607, 10, 'LIGUE'),
    text(66, 584, 17, input.leagueName, 'F2'),
    text(66, 558, 10, `Équipe : ${input.teamName}`),
    '0.9 0.9 0.9 RG 66 542 m 529 542 l S',
    '0.75 0.75 0.75 rg',
    text(66, 518, 10, 'DATES'),
    text(66, 497, 14, input.dates, 'F2'),
    text(66, 467, 10, `Lieu : ${input.location}`),
    text(66, 447, 10, `Paiement : ${input.paymentMethod}`),
    '0.969 0.573 0.118 rg 42 359 511 50 re f',
    '1 1 1 rg',
    text(66, 389, 11, 'MONTANT RÉGLÉ'),
    text(374, 381, 18, input.amount, 'F2'),
    '0.65 0.65 0.65 rg',
    text(42, 312, 10, 'Ce reçu atteste de la confirmation de votre inscription en league.'),
    text(42, 294, 10, 'Conservez-le comme preuve de paiement.'),
    text(42, 74, 9, 'GBONHI FOOT — Plateforme du football amateur en Côte d’Ivoire'),
    text(42, 56, 9, 'Le football amateur commence ici !'),
  ].join('\n');
  return buildPdf(receiptObjects(content));
}

/** Relevé financier partenaire téléchargé depuis le portail propriétaire. */
export function createPartnerRevenueStatementPdf(input: PartnerRevenueStatementPdfInput): Buffer {
  const lines = input.lines.slice(0, 10);
  const tableLines = lines.flatMap((line, index) => {
    const y = 473 - index * 24;
    return [
      index % 2 === 0 ? '0.07 0.16 0.09 rg 54 ' + (y - 8) + ' 487 21 re f' : '',
      '0.72 0.72 0.72 rg',
      text(66, y, 9, line.date),
      text(182, y, 9, line.terrain),
      text(432, y, 9, line.amount, 'F2'),
    ].filter(Boolean);
  });
  const content = [
    '1 1 1 rg 0 0 595 842 re f',
    '0.102 0.239 0.169 rg 0 745 595 97 re f',
    drawLogo(474, 758, 64),
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'Le football amateur commence ici'),
    '0.969 0.573 0.118 rg 42 732 511 4 re f',
    '0.102 0.239 0.169 rg',
    text(42, 690, 24, 'RELEVÉ FINANCIER PARTENAIRE', 'F2'),
    text(42, 668, 11, `Référence : ${input.reference}`),
    '0.94 0.98 0.95 rg 42 580 511 64 re f',
    '0.102 0.239 0.169 rg',
    text(66, 619, 10, 'PARTENAIRE'),
    text(66, 596, 16, input.partnerName, 'F2'),
    text(330, 619, 10, 'PÉRIODE'),
    text(330, 596, 12, input.period, 'F2'),
    '0.102 0.239 0.169 rg 42 518 511 38 re f',
    '1 1 1 rg',
    text(66, 540, 10, 'DATE'),
    text(182, 540, 10, 'TERRAIN'),
    text(432, 540, 10, 'NET REVERSÉ'),
    ...tableLines,
    '0.969 0.573 0.118 rg 42 184 511 56 re f',
    '1 1 1 rg',
    text(66, 216, 11, `RÉSERVATIONS CONFIRMÉES : ${input.reservationCount}`),
    text(362, 207, 17, input.totalNet, 'F2'),
    '0.40 0.40 0.40 rg',
    text(42, 142, 9, 'Le montant indiqué est net de la commission GBONHI FOOT.'),
    text(42, 124, 9, lines.length < input.reservationCount ? 'Le détail présente les 10 dernières réservations de la période.' : 'Détail des réservations de la période.'),
    text(42, 74, 9, 'GBONHI FOOT — Plateforme du football amateur en Côte d’Ivoire'),
    text(42, 56, 9, 'Document généré automatiquement depuis le portail partenaire.'),
  ].join('\n');
  return buildPdf(receiptObjects(content));
}
