'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

const PERIOD_FILTERS = ['Saison', 'Ce mois', '5 derniers matchs', 'Période'];

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
  const [leagueId, setLeagueId] = useState<string>('');
  const [activePeriod, setActivePeriod] = useState('Saison');
  const [standings, setStandings] = useState<Standing[]>([]);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [assisters, setAssisters] = useState<ScorerRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Charge la liste des ligues pour le sélecteur.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<LeagueOption[]>('/leagues');
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }
        setLeagues(data.map((l) => ({ id: l.id, name: l.name })));
        setLeagueId(data[0].id);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge le classement de la ligue sélectionnée.
  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch<ApiStanding[]>(`/leagues/${leagueId}/standings`);
        if (cancelled) return;
        setStandings(Array.isArray(data) ? data.map(mapStanding) : []);
      } catch {
        if (!cancelled) setStandings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  // Charge les top buteurs / passeurs de la ligue sélectionnée.
  useEffect(() => {
    if (!leagueId) {
      setScorers([]);
      setAssisters([]);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    (async () => {
      try {
        const data = await apiFetch<ScorersResponse>(`/matches/scorers?tournament_id=${leagueId}`);
        if (cancelled) return;
        setScorers(Array.isArray(data?.scorers) ? data.scorers : []);
        setAssisters(Array.isArray(data?.assisters) ? data.assisters : []);
      } catch {
        if (!cancelled) {
          setScorers([]);
          setAssisters([]);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return (
    <>
      <Header title="Classements" />

      {/* Filtres */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="relative">
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="h-11 w-80 pl-4 pr-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:border-primary appearance-none"
          >
            {leagues.length === 0 && <option value="">Aucune ligue</option>}
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="flex gap-2.5">
          {PERIOD_FILTERS.map((f) => {
            const active = activePeriod === f;
            return (
              <button
                key={f}
                onClick={() => setActivePeriod(f)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition"
                style={{
                  backgroundColor: active ? '#F7921E' : 'white',
                  color: active ? 'white' : '#374151',
                  borderColor: active ? '#F7921E' : '#E5E7EB',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table classement */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100" style={{ backgroundColor: '#F9FAFB' }}>
              {['Pos', 'Équipe', 'J', 'G', 'N', 'P', 'Bp', 'Bc', 'Diff', 'Pts'].map((h) => (
                <th key={h} className="px-4 py-3.5 text-xs font-semibold text-gray-500" style={{ textAlign: h === 'Équipe' ? 'left' : 'center' }}>
                  {h}
                </th>
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
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">
                  {loading ? 'Chargement…' : 'Aucun classement disponible pour le moment.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top Buteurs & Top Passeurs — données réelles GET /matches/scorers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatCard title="Top Buteurs" rows={scorers} loading={statsLoading} />
        <StatCard title="Top Passeurs" rows={assisters} loading={statsLoading} />
      </div>
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
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: i === 0 ? '#FEF3C7' : '#F3F4F6', color: i === 0 ? '#B45309' : '#6B7280' }}
              >
                {i + 1}
              </span>
              <span className="font-semibold text-gray-900 flex-1 truncate">{r.player.full_name}</span>
              <span className="font-black text-gray-900 tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
