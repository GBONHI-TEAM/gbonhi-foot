// Modèle de composition GBONHI FOOT : football à 7 (1 gardien + 6 joueurs de champ).
// La formation ne concerne que les 6 joueurs de champ (déf-mil-att), le gardien
// étant toujours 1. Ex. "2-3-1" = 2 défenseurs, 3 milieux, 1 attaquant.

export const OUTFIELD_TOTAL = 6; // joueurs de champ (hors gardien)
export const SQUAD_TOTAL = OUTFIELD_TOTAL + 1; // 7 titulaires au total

export type PosBucket = 'GK' | 'DEF' | 'MID' | 'ATT';

export const POS_LABEL: Record<PosBucket, string> = {
  GK: 'Gardien',
  DEF: 'Défenseur',
  MID: 'Milieu',
  ATT: 'Attaquant',
};

export const POS_ORDER: PosBucket[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Classe un intitulé de poste libre (fiche joueur) dans l'un des 4 postes. */
export function positionBucket(raw?: string | null): PosBucket {
  const t = (raw ?? '').toLowerCase();
  if (/gardien|goal|\bgk\b|portier/.test(t)) return 'GK';
  if (/défen|defen|arrière|arriere|\bback\b|latéral|lateral|\bdef\b/.test(t)) return 'DEF';
  if (/attaq|avant|buteur|ailier|\bforward\b|\bfw\b|\batt\b/.test(t)) return 'ATT';
  if (/milieu|\bmid\b|meneur|relayeur|récup|recup/.test(t)) return 'MID';
  return 'MID';
}

/** Construit la chaîne de formation à partir des compteurs de champ. */
export function formationString(def: number, mid: number, att: number): string {
  return `${def}-${mid}-${att}`;
}

/** Parse une formation "def-mid-att" (gardien implicite). Replie sur 2-3-1. */
export function parseFormation(formation?: string | null): { def: number; mid: number; att: number } {
  const parts = (formation ?? '').split('-').map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
  // On ignore un éventuel "1" de gardien en tête (anciennes données à 4 segments).
  const outfield = parts.length === 4 ? parts.slice(1) : parts;
  if (outfield.length === 3 && outfield[0] + outfield[1] + outfield[2] === OUTFIELD_TOTAL) {
    return { def: outfield[0], mid: outfield[1], att: outfield[2] };
  }
  return { def: 2, mid: 3, att: 1 };
}
