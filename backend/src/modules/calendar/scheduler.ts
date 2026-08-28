/**
 * Planificateur anti-collision multi-terrains.
 *
 * Prend des affiches (Fixture) sans date ni lieu et leur affecte un terrain et
 * un créneau horaire réels, en respectant :
 *   — les créneaux d'ouverture des terrains (TerrainSlot : jour + heure) ;
 *   — les indisponibilités (TerrainBlock : date entière ou plage horaire) ;
 *   — aucune double occupation d'un même terrain au même créneau ;
 *   — une équipe ne joue jamais deux matchs le même jour ;
 *   — préférence : recevoir sur le terrain « domicile » de l'équipe hôte.
 *
 * Algorithme glouton : chaque journée vise une date cible
 * (start_date + (journée-1) × intervalle) ; les matchs de la journée sont posés
 * sur le premier couple (terrain, créneau) libre à partir de cette date, en
 * débordant sur les jours suivants si la capacité d'un jour est insuffisante.
 *
 * Robustesse : si aucun terrain n'a de créneau configuré, on retombe sur un
 * placement simple (date cible à 16h, lieu = terrain de l'équipe hôte) afin que
 * la génération n'échoue jamais — la couche « qualité prod » s'active dès que
 * des créneaux existent.
 */

import { Fixture } from './round-robin';

export interface TerrainSlotInput {
  day_of_week: number; // 0 = dimanche … 6 = samedi (getUTCDay)
  start_hour: number;
  end_hour: number;
  is_active: boolean;
}

export interface TerrainBlockInput {
  blocked_date: Date;
  start_hour: number | null;
  end_hour: number | null;
}

export interface TerrainInput {
  id: string;
  name: string;
  slots: TerrainSlotInput[];
  blocks: TerrainBlockInput[];
}

export interface ScheduleConfig {
  startDate: Date;
  roundIntervalDays: number;
  matchDurationMin: number;
  /** terrain « domicile » préféré par équipe (team_id -> terrain_id) */
  homeTerrainByTeam: Map<string, string | null>;
  /** libellé du terrain par id (pour remplir Match.venue) */
  terrains: TerrainInput[];
  /** limite de recherche en jours après la date cible d'une journée */
  maxDaySpill?: number;
}

export interface ScheduledMatch extends Fixture {
  scheduled_at: Date;
  venue_terrain_id: string | null;
  venue: string | null;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Clé d'occupation d'un créneau (terrain + jour + heure). */
export function slotUsageKey(terrainId: string, date: Date, hour: number): string {
  return `${terrainId}|${dayKey(date)}|${hour}`;
}
export function teamBusyKey(teamId: string, date: Date): string {
  return `${teamId}|${dayKey(date)}`;
}

export interface FreeSlotResult {
  scheduled_at: Date;
  venue_terrain_id: string;
  venue: string;
  usageKeys: string[]; // clés à ajouter dans `used`
}

/**
 * Cherche le premier créneau libre pour une affiche à partir de `targetDate`,
 * en tenant compte de l'occupation déjà connue (`used`, `teamBusy`).
 * Retourne null si aucun terrain n'a de créneau exploitable dans la fenêtre.
 */
export function findFreeSlot(params: {
  homeTeamId: string;
  awayTeamId: string;
  targetDate: Date;
  terrains: TerrainInput[];
  preferredTerrainId: string | null;
  durationHours: number;
  used: Set<string>;
  teamBusy: Set<string>;
  maxDaySpill: number;
}): FreeSlotResult | null {
  const { homeTeamId, awayTeamId, targetDate, terrains, preferredTerrainId, durationHours, used, teamBusy, maxDaySpill } = params;

  const ordered = [...terrains].sort((a, b) => {
    if (a.id === preferredTerrainId) return -1;
    if (b.id === preferredTerrainId) return 1;
    return 0;
  });

  for (let offset = 0; offset <= maxDaySpill; offset++) {
    const date = addDays(targetDate, offset);
    if (teamBusy.has(teamBusyKey(homeTeamId, date)) || teamBusy.has(teamBusyKey(awayTeamId, date))) continue;
    const dow = date.getUTCDay();

    for (const terrain of ordered) {
      const hours = candidateHours(terrain, dow, durationHours);
      for (const h of hours) {
        const hourEnd = h + durationHours;
        if (isBlocked(terrain, date, h, hourEnd)) continue;
        let free = true;
        const keys: string[] = [];
        for (let hh = h; hh < hourEnd; hh++) {
          const k = slotUsageKey(terrain.id, date, hh);
          if (used.has(k)) {
            free = false;
            break;
          }
          keys.push(k);
        }
        if (!free) continue;
        return {
          scheduled_at: atHour(date, h),
          venue_terrain_id: terrain.id,
          venue: terrain.name,
          usageKeys: keys,
        };
      }
    }
  }
  return null;
}

/** Clé jour (UTC) pour comparer/indexer les dates sans l'heure. */
function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

/** Date UTC à minuit + une heure donnée. */
function atHour(date: Date, hour: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return d;
}

/** Un terrain est-il bloqué sur [hour, hourEnd) à cette date ? */
function isBlocked(terrain: TerrainInput, date: Date, hour: number, hourEnd: number): boolean {
  const dk = dayKey(date);
  return terrain.blocks.some((b) => {
    if (dayKey(new Date(b.blocked_date)) !== dk) return false;
    if (b.start_hour == null || b.end_hour == null) return true; // journée entière
    return b.start_hour < hourEnd && b.end_hour > hour;
  });
}

/** Heures de début candidates d'un terrain pour un jour de semaine donné,
 *  triées croissant, filtrant les créneaux inactifs. */
function candidateHours(terrain: TerrainInput, dow: number, durationHours: number): number[] {
  return terrain.slots
    .filter((s) => s.is_active && s.day_of_week === dow && s.end_hour - s.start_hour >= durationHours)
    .map((s) => s.start_hour)
    .sort((a, b) => a - b);
}

export function scheduleMatches(fixtures: Fixture[], config: ScheduleConfig): ScheduledMatch[] {
  const { startDate, roundIntervalDays, matchDurationMin, homeTerrainByTeam, terrains } = config;
  const durationHours = Math.max(1, Math.ceil(matchDurationMin / 60));
  const maxSpill = config.maxDaySpill ?? 120;
  const terrainById = new Map(terrains.map((t) => [t.id, t]));
  const hasSlots = terrains.some((t) => t.slots.some((s) => s.is_active));

  const nameById = new Map(terrains.map((t) => [t.id, t.name]));

  // occupation : `${terrainId}|${dayKey}|${hour}` → pris
  const used = new Set<string>();
  // `${teamId}|${dayKey}` → l'équipe joue déjà ce jour
  const teamBusy = new Set<string>();

  const results: ScheduledMatch[] = [];

  // Journées triées croissant
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);

  for (const round of rounds) {
    const targetDate = addDays(startDate, (round - 1) * roundIntervalDays);
    const roundFixtures = fixtures.filter((f) => f.round === round);

    for (const fx of roundFixtures) {
      const placed = placeFixture(fx, targetDate);
      results.push(placed);
    }
  }

  return results;

  /** Place une affiche : cherche le 1er (terrain, jour, heure) libre à partir de
   *  la date cible, préférence au terrain domicile de l'équipe hôte. */
  function placeFixture(fx: Fixture, targetDate: Date): ScheduledMatch {
    const preferredTerrainId = homeTerrainByTeam.get(fx.home_team_id) ?? null;

    // Fallback : aucun créneau configuré nulle part → placement simple 16h.
    if (!hasSlots) {
      const at = atHour(targetDate, 16);
      return {
        ...fx,
        scheduled_at: at,
        venue_terrain_id: preferredTerrainId,
        venue: preferredTerrainId ? nameById.get(preferredTerrainId) ?? null : null,
      };
    }

    const found = findFreeSlot({
      homeTeamId: fx.home_team_id,
      awayTeamId: fx.away_team_id,
      targetDate,
      terrains,
      preferredTerrainId,
      durationHours,
      used,
      teamBusy,
      maxDaySpill: maxSpill,
    });
    if (found) {
      for (const k of found.usageKeys) used.add(k);
      teamBusy.add(teamBusyKey(fx.home_team_id, found.scheduled_at));
      teamBusy.add(teamBusyKey(fx.away_team_id, found.scheduled_at));
      return {
        ...fx,
        scheduled_at: found.scheduled_at,
        venue_terrain_id: found.venue_terrain_id,
        venue: found.venue,
      };
    }

    // Dernier recours : capacité saturée sur la fenêtre → placement forcé 16h
    // sur le terrain préféré (peut créer un chevauchement, signalé en amont).
    const at = atHour(targetDate, 16);
    return {
      ...fx,
      scheduled_at: at,
      venue_terrain_id: preferredTerrainId,
      venue: preferredTerrainId ? nameById.get(preferredTerrainId) ?? null : null,
    };
  }
}
