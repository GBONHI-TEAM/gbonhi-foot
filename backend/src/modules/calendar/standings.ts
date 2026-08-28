/**
 * Calcul de classement (points, différence de buts, buts pour) partagé par le
 * classement général d'un championnat et les classements par poule.
 */

export interface StandingTeam {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
}

export interface StandingMatchRow {
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
}

export interface StandingRow {
  rank: number;
  team: StandingTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

/** Classe une liste d'équipes à partir des matchs joués (validés). */
export function computeStandings(teams: StandingTeam[], matches: StandingMatchRow[]): StandingRow[] {
  const rows = teams.map((team) => {
    const teamMatches = matches.filter((m) => m.home_team_id === team.id || m.away_team_id === team.id);
    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;
    for (const m of teamMatches) {
      const isHome = m.home_team_id === team.id;
      const ts = isHome ? m.home_score : m.away_score;
      const os = isHome ? m.away_score : m.home_score;
      played++;
      gf += ts;
      ga += os;
      if (ts > os) won++;
      else if (ts === os) drawn++;
      else lost++;
    }
    return {
      team,
      played,
      won,
      drawn,
      lost,
      goals_for: gf,
      goals_against: ga,
      goal_diff: gf - ga,
      points: won * 3 + drawn,
    };
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
    return b.goals_for - a.goals_for;
  });

  return rows.map((r, i) => ({ rank: i + 1, ...r }));
}
