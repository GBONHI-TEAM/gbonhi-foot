/**
 * Générateur de tableau à élimination directe (single-elimination).
 *
 * Produit le squelette du tournoi : un « node » par affiche, du 1er tour
 * jusqu'à la finale, avec le seeding standard (les têtes de série ne se
 * rencontrent que le plus tard possible) et la gestion des exempts (byes)
 * quand le nombre d'équipes n'est pas une puissance de 2.
 *
 * Cette couche est pure (aucune base de données) : elle raisonne en numéros de
 * série (seed 1..bracketSize). Le service mappe ensuite chaque seed à une
 * équipe réelle (ou à un bye si seed > nombre d'équipes) et matérialise les
 * matchs.
 */

export interface BracketNodeDef {
  round_name: string;
  round_size: number; // nb d'équipes entrant dans ce tour (2 = finale)
  slot: number; // position 0-based dans le tour
  home_seed: number | null; // seed alimentant le domicile (1er tour uniquement)
  away_seed: number | null;
  home_source: string; // "seed:N" | "winner:{roundSize}#{slot}"
  away_source: string;
  next_round_size: number | null; // node suivant (null pour la finale)
  next_slot: number | null;
  next_feed: 0 | 1 | null; // 0 => alimente le domicile du suivant, 1 => extérieur
}

/** Puissance de 2 immédiatement ≥ n (min. 2). */
export function bracketSizeFor(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/** Nom lisible d'un tour à partir du nombre d'équipes qui y entrent. */
export function roundName(roundSize: number): string {
  switch (roundSize) {
    case 2:
      return 'finale';
    case 4:
      return 'demies';
    case 8:
      return 'quarts';
    case 16:
      return '8es';
    case 32:
      return '16es';
    case 64:
      return '32es';
    default:
      return `round_of_${roundSize}`;
  }
}

/** Ordre de seeding standard pour un tableau de taille `size`.
 *  Ex. size=8 → [1,8,4,5,2,7,3,6] : les slots adjacents (0,1),(2,3)… donnent les
 *  affiches du 1er tour (1v8, 4v5, 2v7, 3v6). */
export function seedOrder(size: number): number[] {
  let places = [1, 2];
  while (places.length < size) {
    const sum = places.length * 2 + 1;
    const next: number[] = [];
    for (const p of places) {
      next.push(p);
      next.push(sum - p);
    }
    places = next;
  }
  return places;
}

/**
 * Construit tous les nodes du tableau pour `teamCount` équipes.
 * Les nodes sont triés du 1er tour vers la finale.
 */
export function generateBracket(teamCount: number): BracketNodeDef[] {
  if (teamCount < 2) return [];
  const size = bracketSizeFor(teamCount);
  const nodes: BracketNodeDef[] = [];

  // ── 1er tour ──
  const order = seedOrder(size);
  const firstRoundMatches = size / 2;
  for (let slot = 0; slot < firstRoundMatches; slot++) {
    const homeSeed = order[slot * 2];
    const awaySeed = order[slot * 2 + 1];
    const next = size / 2; // taille du tour suivant
    nodes.push({
      round_name: roundName(size),
      round_size: size,
      slot,
      home_seed: homeSeed,
      away_seed: awaySeed,
      home_source: `seed:${homeSeed}`,
      away_source: `seed:${awaySeed}`,
      next_round_size: next >= 2 ? next : null,
      next_slot: next >= 2 ? Math.floor(slot / 2) : null,
      next_feed: next >= 2 ? ((slot % 2) as 0 | 1) : null,
    });
  }

  // ── Tours suivants (size/2 … 2) ──
  for (let rs = size / 2; rs >= 2; rs /= 2) {
    const matches = rs / 2;
    const predSize = rs * 2; // tour précédent qui alimente ce tour
    for (let slot = 0; slot < matches; slot++) {
      const next = rs / 2;
      nodes.push({
        round_name: roundName(rs),
        round_size: rs,
        slot,
        home_seed: null,
        away_seed: null,
        home_source: `winner:${predSize}#${slot * 2}`,
        away_source: `winner:${predSize}#${slot * 2 + 1}`,
        next_round_size: next >= 2 ? next : null,
        next_slot: next >= 2 ? Math.floor(slot / 2) : null,
        next_feed: next >= 2 ? ((slot % 2) as 0 | 1) : null,
      });
    }
  }

  return nodes;
}
