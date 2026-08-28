/**
 * Construction de la configuration de planification (terrains + créneaux +
 * blocages) partagée par la génération championnat et la génération bracket.
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ScheduleConfig, TerrainInput } from './scheduler';

export interface LeagueForSchedule {
  start_date: Date;
  round_interval_days: number;
  match_duration_min: number;
  teams: { team_id: string; team: { home_terrain_id: string | null } }[];
}

export async function buildScheduleConfig(
  prisma: PrismaService,
  league: LeagueForSchedule,
): Promise<ScheduleConfig> {
  const startDate = new Date(
    Date.UTC(
      league.start_date.getUTCFullYear(),
      league.start_date.getUTCMonth(),
      league.start_date.getUTCDate(),
    ),
  );

  const homeTerrainByTeam = new Map<string, string | null>();
  const terrainIds = new Set<string>();
  for (const t of league.teams) {
    homeTerrainByTeam.set(t.team_id, t.team.home_terrain_id);
    if (t.team.home_terrain_id) terrainIds.add(t.team.home_terrain_id);
  }

  const terrains: TerrainInput[] = [];
  if (terrainIds.size > 0) {
    const rows = await prisma.terrain.findMany({
      where: { id: { in: [...terrainIds] }, is_active: true },
      include: {
        slots: { where: { is_active: true } },
        blocks: { where: { blocked_date: { gte: startDate } } },
      },
    });
    for (const r of rows) {
      terrains.push({
        id: r.id,
        name: r.name,
        slots: r.slots.map((s) => ({
          day_of_week: s.day_of_week,
          start_hour: s.start_hour,
          end_hour: s.end_hour,
          is_active: s.is_active,
        })),
        blocks: r.blocks.map((b) => ({
          blocked_date: b.blocked_date,
          start_hour: b.start_hour,
          end_hour: b.end_hour,
        })),
      });
    }
  }

  return {
    startDate,
    roundIntervalDays: league.round_interval_days ?? 7,
    matchDurationMin: league.match_duration_min ?? 60,
    homeTerrainByTeam,
    terrains,
  };
}
