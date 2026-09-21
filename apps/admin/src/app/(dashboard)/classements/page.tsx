'use client';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft, Trophy } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface Standing {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  diff: number;
  points: number;
}

interface ApiStanding {
  rank: number;
  team: { name: string };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

interface LeagueOption {
  id: string;
  name: string;
}

interface ScorerRow {
  player: { id: string; full_name: string };
  count: number;
}

interface ScorersResponse {
  scorers: ScorerRow[];
  assisters: ScorerRow[];
}

const PERIOD_FILTERS = ['Saison', 'Ce mois', '5 derniers matchs', 'Période'] as const;
type PeriodFilter = (typeof PERIOD_FILTERS)[number];

// Libellé d'onglet → valeur `period` de l'API.
const PERIOD_PARAM: Record<PeriodFilter, string> = {
  'Saison': 'season',
  'Ce mois': 'month',
  '5 derniers matchs': 'last5',
  'Période': 'custom',
};

function mapStanding(s: ApiStanding): Standing {
  return {
    rank: s.rank,
    team: s.team.name,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.goals_for,
    ga: s.goals_against,
    diff: s.goal_diff,
    points: s.points,
  };
}

export default function ClassementsPage() {
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [standingsByLeague, setStandingsByLeague] = useState<Record<string, Standing[]>>({});
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodFilter>('Saison');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [detailStandings, setDetailStandings] = useState<Standing[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [assisters, setAssisters] = useState<ScorerRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Charge toutes les ligues + le classement de chacune (pour l'aperçu Top 5).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<LeagueOption[]>('/leagues');
        if (cancelled || !Array.isArray(data)) { if (!cancelled) setOverviewLoading(false); return; }
        const list = data.map((l) => ({ id: l.id, name: l.name }));
        setLeagues(list);
        const entries = await Promise.all(
          list.map(async (l) => {
            try {
              const s = await apiFetch<ApiStanding[]>(`/leagues/${l.id}/standings`);
              return [l.id, Array.isArray(s) ? s.map(mapStanding) : []] as const;
            } catch {
              return [l.id, [] as Standing[]] as const;
            }
          }),
        );
        if (cancelled) return;
        setStandingsByLeague(Object.fromEntries(entries));
      } catch {
        /* liste vide gérée à l'affichage */
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Top buteurs / passeurs de la ligue ouverte.
  const loadStats = useCallback(async (leagueId: string) => {
    setStatsLoading(true);
    try {
      const data = await apiFetch<ScorersResponse>(`/matches/scorers?tournament_id=${leagueId}`);
      setScorers(Array.isArray(data?.scorers) ? data.scorers : []);
      setAssisters(Array.isArray(data?.assisters) ? data.assisters : []);
    } catch {
      setScorers([]);
      setAssisters([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLeagueId) void loadStats(selectedLeagueId);
  }, [selectedLeagueId, loadStats]);

  // Recharge le classement détaillé selon la période choisie.
  useEffect(() => {
    if (!selectedLeagueId) return;
    const period = PERIOD_PARAM[activePeriod];
    // « Période » : on attend les deux dates avant d'interroger.
    if (period === 'custom' && (!customFrom || !customTo)) {
      setDetailStandings(standingsByLeague[selectedLeagueId] ?? []);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    const params = new URLSearchParams({ period });
    if (period === 'custom') { params.set('from', customFrom); params.set('to', customTo); }
    (async () => {
      try {
        const data = await apiFetch<ApiStanding[]>(`/leagues/${selectedLeagueId}/standings?${params.toString()}`);
        if (!cancelled) setDetailStandings(Array.isArray(data) ? data.map(mapStanding) : []);
      } catch {
        if (!cancelled) setDetailStandings([]);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLeagueId, activePeriod, customFrom, customTo, standingsByLeague]);

  const standings = detailStandings;

  // ─── Vue détaillée d'une ligue ────────────────────────────────────────────
  if (selectedLeagueId) {
    return (
      <>
        <Header title="Classements" />

        <button onClick={() => setSelectedLeagueId(null)} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16} /> Toutes les ligues
        </button>

        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}>
              <Trophy size={18} />
            </span>
            <div className="relative">
              {/* Sélecteur rapide pour changer de ligue sans revenir en arrière */}
              <select
                value={selectedLeagueId}
                onChange={(e) => setSelectedLeagueId(e.target.value)}
                className="h-11 w-80 pl-4 pr-10 rounded-lg border border-gray-200 text-base font-bold text-gray-900 bg-white focus:outline-none focus:border-primary appearance-none"
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {PERIOD_FILTERS.map((f) => {
              const active = activePeriod === f;
              return (
                <button key={f} onClick={() => setActivePeriod(f)} className="px-4 py-2 rounded-lg text-sm font-medium border transition"
                  style={{ backgroundColor: active ? '#F7921E' : 'white', color: active ? 'white' : '#374151', borderColor: active ? '#F7921E' : '#E5E7EB' }}>
                  {f}
                </button>
              );
            })}
            {activePeriod === 'Période' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-200 text-sm" />
                <span className="text-gray-400 text-sm">au</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-200 text-sm" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: '#F9FAFB' }}>
                {['Pos', 'Équipe', 'J', 'G', 'N', 'P', 'Bp', 'Bc', 'Diff', 'Pts'].map((h) => (
                  <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500" style={{ textAlign: h === 'Équipe' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {standings.map((s) => (
                <tr key={s.rank} className="hover:bg-gray-50 transition" style={{ backgroundColor: s.rank === 1 ? '#F0FDF4' : undefined }}>
                  <td className="px-4 py-3.5 text-center font-bold" style={{ color: s.rank === 1 ? '#15803D' : '#6B7280' }}>{s.rank}</td>
                  <td className="px-4 py-3.5 font-semibold" style={{ color: s.rank === 1 ? '#15803D' : '#111827' }}>{s.team}</td>
                  {[s.played, s.won, s.drawn, s.lost, s.gf, s.ga].map((v, i) => (
                    <td key={i} className="px-4 py-3.5 text-center text-gray-600">{v}</td>
                  ))}
                  <td className="px-4 py-3.5 text-center font-medium" style={{ color: s.diff > 0 ? '#1E7A3A' : s.diff < 0 ? '#DC2626' : '#6B7280' }}>
                    {s.diff > 0 ? `+${s.diff}` : s.diff < 0 ? `−${Math.abs(s.diff)}` : 0}
                  </td>
                  <td className="px-4 py-3.5 text-center font-black text-gray-900">{s.points}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {detailLoading ? 'Chargement…' : activePeriod === 'Période' && (!customFrom || !customTo) ? 'Choisis une date de début et de fin.' : 'Aucun match sur cette période.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatCard title="Top Buteurs" rows={scorers} loading={statsLoading} />
          <StatCard title="Top Passeurs" rows={assisters} loading={statsLoading} />
        </div>
      </>
    );
  }

  // ─── Vue d'ensemble : une carte par ligue avec aperçu du Top 5 ─────────────
  return (
    <>
      <Header title="Classements" />

      <p className="text-sm text-gray-500 mb-5">
        Aperçu de toutes les compétitions. Clique sur une ligue pour afficher le <strong>classement complet</strong>, les buteurs et les passeurs.
      </p>

      {overviewLoading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-16 text-center text-gray-400 text-sm shadow-sm">Chargement des classements…</div>
      ) : leagues.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-16 text-center text-gray-400 text-sm shadow-sm">Aucune ligue pour le moment.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leagues.map((l) => {
            const top = (standingsByLeague[l.id] ?? []).slice(0, 5);
            return (
              <button
                key={l.id}
                onClick={() => setSelectedLeagueId(l.id)}
                className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-[#1E7A3A]/40 transition"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}>
                      <Trophy size={16} />
                    </span>
                    <span className="font-bold text-gray-900 truncate">{l.name}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: '#1E7A3A' }}>
                    Classement complet <ChevronRight size={14} />
                  </span>
                </div>

                {top.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Aucun classement disponible.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-gray-400">
                        <th className="text-left px-5 py-2 font-semibold">#</th>
                        <th className="text-left py-2 font-semibold">Équipe</th>
                        <th className="px-2 py-2 font-semibold text-center">J</th>
                        <th className="px-2 py-2 font-semibold text-center">Diff</th>
                        <th className="px-5 py-2 font-semibold text-center">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((s) => (
                        <tr key={s.rank} className="border-t border-gray-50" style={{ backgroundColor: s.rank === 1 ? '#F0FDF4' : undefined }}>
                          <td className="px-5 py-2 font-bold" style={{ color: s.rank === 1 ? '#15803D' : '#9CA3AF' }}>{s.rank}</td>
                          <td className="py-2 font-semibold text-gray-800 truncate">{s.team}</td>
                          <td className="px-2 py-2 text-center text-gray-500">{s.played}</td>
                          <td className="px-2 py-2 text-center" style={{ color: s.diff > 0 ? '#1E7A3A' : s.diff < 0 ? '#DC2626' : '#6B7280' }}>
                            {s.diff > 0 ? `+${s.diff}` : s.diff < 0 ? `−${Math.abs(s.diff)}` : 0}
                          </td>
                          <td className="px-5 py-2 text-center font-black text-gray-900">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Carte Top Buteurs / Passeurs — liste rang · joueur · nombre. */
function StatCard({ title, rows, loading }: { title: string; rows: ScorerRow[]; loading: boolean }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-bold text-[15px] inline-block pb-1 border-b-2 mb-4" style={{ color: '#1E7A3A', borderColor: '#1E7A3A' }}>{title}</h3>
      {loading ? (
        <div className="py-8 text-center"><p className="text-sm text-gray-400">Chargement…</p></div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center"><p className="text-sm text-gray-400">Aucune statistique disponible</p></div>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={r.player.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: i === 0 ? '#FEF3C7' : '#F3F4F6', color: i === 0 ? '#B45309' : '#6B7280' }}>{i + 1}</span>
              <span className="font-semibold text-gray-900 flex-1 truncate">{r.player.full_name}</span>
              <span className="font-black text-gray-900 tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
