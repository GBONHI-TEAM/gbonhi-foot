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

function ascii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[()\\]/g, '\\$&');
}

function text(x: number, y: number, size: number, value: string, font = 'F1'): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET`;
}

/** Reçu PDF autonome, sans dépendance native, compatible iOS/Android et impression. */
export function createReservationReceiptPdf(input: ReceiptPdfInput): Buffer {
  const content = [
    '0.051 0.122 0.051 rg 0 0 595 842 re f',
    '0.118 0.478 0.227 rg 0 745 595 97 re f',
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'LE FOOTBALL AMATEUR COMMENCE ICI'),
    '0.969 0.573 0.118 rg',
    '42 732 511 4 re f',
    '1 1 1 rg',
    text(42, 690, 24, 'RECU DE RESERVATION', 'F2'),
    text(42, 668, 11, `Reference : ${input.reference}`),
    '0.08 0.16 0.09 rg 42 430 511 210 re f',
    '1 1 1 rg',
    text(66, 607, 10, 'TERRAIN'),
    text(66, 584, 17, input.terrainName, 'F2'),
    text(66, 563, 10, input.address),
    '0.9 0.9 0.9 RG 66 545 m 529 545 l S',
    '0.75 0.75 0.75 rg',
    text(66, 520, 10, 'DATE'),
    text(300, 520, 10, 'CRENEAU'),
    text(66, 499, 14, input.date, 'F2'),
    text(300, 499, 14, input.time, 'F2'),
    text(66, 467, 10, `Duree : ${input.duration}`),
    text(300, 467, 10, `Paiement : ${input.paymentMethod}`),
    '0.969 0.573 0.118 rg 42 359 511 50 re f',
    '1 1 1 rg',
    text(66, 389, 11, 'MONTANT PAYE'),
    text(374, 381, 18, input.amount, 'F2'),
    '0.65 0.65 0.65 rg',
    text(42, 312, 10, 'Ce recu atteste de la confirmation de votre reservation.'),
    text(42, 294, 10, 'Conservez-le et presentez votre reference au terrain.'),
    text(42, 74, 9, 'GBONHI FOOT - Plateforme du football amateur en Cote d Ivoire'),
    text(42, 56, 9, 'Merci de faire vivre le football local.'),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'ascii'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'ascii');
}

/** Reçu d'inscription de ligue, avec la même identité GBONHI FOOT. */
export function createLeagueRegistrationReceiptPdf(input: LeagueReceiptPdfInput): Buffer {
  const content = [
    '0.051 0.122 0.051 rg 0 0 595 842 re f',
    '0.118 0.478 0.227 rg 0 745 595 97 re f',
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'LE FOOTBALL AMATEUR COMMENCE ICI'),
    '0.969 0.573 0.118 rg 42 732 511 4 re f',
    '1 1 1 rg',
    text(42, 690, 24, 'RECU D INSCRIPTION LEAGUE', 'F2'),
    text(42, 668, 11, `Reference : ${input.reference}`),
    '0.08 0.16 0.09 rg 42 430 511 210 re f',
    '1 1 1 rg',
    text(66, 607, 10, 'LIGUE'),
    text(66, 584, 17, input.leagueName, 'F2'),
    text(66, 558, 10, `Equipe : ${input.teamName}`),
    '0.9 0.9 0.9 RG 66 542 m 529 542 l S',
    '0.75 0.75 0.75 rg',
    text(66, 518, 10, 'DATES'),
    text(66, 497, 14, input.dates, 'F2'),
    text(66, 467, 10, `Lieu : ${input.location}`),
    text(66, 447, 10, `Paiement : ${input.paymentMethod}`),
    '0.969 0.573 0.118 rg 42 359 511 50 re f',
    '1 1 1 rg',
    text(66, 389, 11, 'MONTANT REGLE'),
    text(374, 381, 18, input.amount, 'F2'),
    '0.65 0.65 0.65 rg',
    text(42, 312, 10, 'Ce recu atteste de la confirmation de votre inscription en league.'),
    text(42, 294, 10, 'Conservez-le comme preuve de paiement.'),
    text(42, 74, 9, 'GBONHI FOOT - Plateforme du football amateur en Cote d Ivoire'),
    text(42, 56, 9, 'Merci de faire vivre le football local.'),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'ascii'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'ascii');
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
    '1 1 1 rg',
    text(42, 804, 21, 'GBONHI FOOT', 'F2'),
    text(42, 778, 10, 'LE FOOTBALL AMATEUR COMMENCE ICI'),
    '0.969 0.573 0.118 rg 42 732 511 4 re f',
    '0.102 0.239 0.169 rg',
    text(42, 690, 24, 'RELEVE FINANCIER PARTENAIRE', 'F2'),
    text(42, 668, 11, `Reference : ${input.reference}`),
    '0.94 0.98 0.95 rg 42 580 511 64 re f',
    '0.102 0.239 0.169 rg',
    text(66, 619, 10, 'PARTENAIRE'),
    text(66, 596, 16, input.partnerName, 'F2'),
    text(330, 619, 10, 'PERIODE'),
    text(330, 596, 12, input.period, 'F2'),
    '0.102 0.239 0.169 rg 42 518 511 38 re f',
    '1 1 1 rg',
    text(66, 540, 10, 'DATE'),
    text(182, 540, 10, 'TERRAIN'),
    text(432, 540, 10, 'NET REVERSE'),
    ...tableLines,
    '0.969 0.573 0.118 rg 42 184 511 56 re f',
    '1 1 1 rg',
    text(66, 216, 11, `RESERVATIONS CONFIRMEES : ${input.reservationCount}`),
    text(362, 207, 17, input.totalNet, 'F2'),
    '0.40 0.40 0.40 rg',
    text(42, 142, 9, 'Le montant indique est net de la commission GBONHI FOOT.'),
    text(42, 124, 9, lines.length < input.reservationCount ? 'Le detail presente les 10 dernieres reservations de la periode.' : 'Detail des reservations de la periode.'),
    text(42, 74, 9, 'GBONHI FOOT - Plateforme du football amateur en Cote d Ivoire'),
    text(42, 56, 9, 'Document genere automatiquement depuis le portail partenaire.'),
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`,
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'ascii'));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, 'ascii');
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'ascii');
}
