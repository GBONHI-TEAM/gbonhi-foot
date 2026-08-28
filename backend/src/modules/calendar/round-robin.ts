/**
 * Génération d'affiches de championnat (round-robin) par la méthode du cercle.
 *
 * — Aller simple (`legs = 1`) : chaque paire d'équipes se rencontre une fois.
 * — Aller-retour (`legs = 2`) : la phase retour reprend les mêmes affiches avec
 *   domicile / extérieur inversés, sur des journées décalées après l'aller.
 *
 * Cette couche ne s'occupe QUE du « qui joue qui, quelle journée ». La date et
 * le terrain sont attribués ensuite par le planificateur (scheduler.ts).
 */

export interface Fixture {
  home_team_id: string;
  away_team_id: string;
  round: number;
  leg: number; // 1 = aller, 2 = retour
}

const BYE = '__BYE__';

/** Une seule phase aller (journées 1..N-1). Alternance dom/ext neutralisée :
 *  l'équilibrage des réceptions est géré par la phase retour (aller-retour) ou
 *  laissé tel quel (aller simple). */
function singleRoundRobin(teamIds: string[]): Fixture[] {
  const teams = [...teamIds];
  if (teams.length % 2 !== 0) teams.push(BYE);

  const total = teams.length;
  const rounds = total - 1;
  const half = total / 2;
  const fixtures: Fixture[] = [];

  const fixed = teams[0];
  const rotating = teams.slice(1);

  for (let round = 0; round < rounds; round++) {
    for (let m = 0; m < half; m++) {
      let home: string;
      let away: string;
      if (m === 0) {
        home = fixed;
        away = rotating[round % (total - 1)];
      } else {
        home = rotating[(round + m) % (total - 1)];
        away = rotating[(round + total - 1 - m) % (total - 1)];
      }
      if (home === BYE || away === BYE) continue;
      fixtures.push({ home_team_id: home, away_team_id: away, round: round + 1, leg: 1 });
    }
  }

  return fixtures;
}

/**
 * Génère les affiches d'un championnat.
 * @param teamIds identifiants des équipes participantes
 * @param legs    1 = aller simple, 2 = aller-retour
 */
export function generateChampionship(teamIds: string[], legs: number): Fixture[] {
  const firstLeg = singleRoundRobin(teamIds);
  if (legs < 2) return firstLeg;

  const roundsFirstLeg = firstLeg.reduce((max, f) => Math.max(max, f.round), 0);
  const secondLeg: Fixture[] = firstLeg.map((f) => ({
    home_team_id: f.away_team_id, // inversion domicile / extérieur au retour
    away_team_id: f.home_team_id,
    round: f.round + roundsFirstLeg,
    leg: 2,
  }));

  return [...firstLeg, ...secondLeg];
}

/** Nombre de journées produites (pour messages / vérifications). */
export function roundsCount(fixtures: Fixture[]): number {
  return fixtures.reduce((max, f) => Math.max(max, f.round), 0);
}
