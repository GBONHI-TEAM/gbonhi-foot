/**
 * Répartition en poules + génération des affiches de la phase de groupes.
 *
 * Chaque poule joue un mini-championnat (round-robin), aller simple ou
 * aller-retour selon `legs`. Les affiches de toutes les poules sont ensuite
 * planifiées ensemble (anti-collision terrains), les numéros de journée étant
 * partagés entre poules (J1 de la poule A et J1 de la poule B tombent la même
 * date cible, le planificateur répartit sur les créneaux disponibles).
 */

import { Fixture, generateChampionship } from './round-robin';

const POOL_LABELS = 'ABCDEFGHIJKLMNOP';

export function poolLabel(index: number): string {
  return POOL_LABELS[index] ?? `P${index + 1}`;
}

/**
 * Répartit `teamIds` (déjà ordonnés par seeding) dans `poolCount` poules, de
 * façon équilibrée et en « serpentin » léger : distribution round-robin des
 * équipes (équipe i → poule i % poolCount) pour éviter d'entasser les têtes de
 * série dans la même poule.
 */
export function assignPools(teamIds: string[], poolCount: number): Map<string, string[]> {
  const pools = new Map<string, string[]>();
  for (let i = 0; i < poolCount; i++) pools.set(poolLabel(i), []);
  teamIds.forEach((id, i) => {
    const label = poolLabel(i % poolCount);
    pools.get(label)!.push(id);
  });
  return pools;
}

/** Fixtures de toutes les poules, chaque affiche taguée avec sa poule. */
export function generatePoolFixtures(pools: Map<string, string[]>, legs: number): Fixture[] {
  const all: Fixture[] = [];
  for (const [label, teamIds] of pools) {
    if (teamIds.length < 2) continue; // poule d'une seule équipe : rien à jouer
    const fixtures = generateChampionship(teamIds, legs);
    for (const f of fixtures) all.push({ ...f, pool: label });
  }
  return all;
}

/**
 * Ordonne les qualifiés pour la phase finale par (rang dans la poule, poule).
 * Ce classement produit un seeding croisé standard une fois passé dans le
 * générateur de bracket : les 1ers de poule sont têtes de série, et aucun 1er
 * ne rencontre le 2e de sa propre poule au 1er tour.
 *
 * @param qualifiersByRank  qualifiersByRank[r] = liste des équipes classées
 *                          (r+1)ᵉ de leur poule, dans l'ordre des poules (A,B,…)
 */
export function crossSeedQualifiers(qualifiersByRank: string[][]): string[] {
  const seeded: string[] = [];
  for (const rankGroup of qualifiersByRank) {
    for (const teamId of rankGroup) seeded.push(teamId);
  }
  return seeded;
}
