'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '../../../../../components/layout/header';
import { apiFetch } from '../../../../../lib/api';

type ResultStatus = 'JOUÉ' | 'À VENIR' | 'REPORTÉ';

interface ResultMatch {
  id: string;
  round: number;
  roundLabel: string;
  date: string;
  time: string;
  venue: string;
  home: string;
  away: string;
  homeColor: string;
  awayColor: string;
  homeScore: number | null;
  awayScore: number | null;
  status: ResultStatus;
}

interface ApiTeamRef {
  name: string;
  primary_color?: string | null;
}

interface ApiMatch {
  id: string;
  round: number | null;
  status: string;
  scheduled_at: string;
  venue?: string | null;
  home_score: number;
  away_score: number;
  home_team?: ApiTeamRef | null;
  away_team?: ApiTeamRef | null;
}

interface ApiLeagueDetail {
  id: string;
  name: string;
  matches?: ApiMatch[];
}

const STATUS_META: Record<ResultStatus, { bg: string; color: string }> = {
  'JOUÉ': { bg: '#DCFCE7', color: '#15803D' },
  'À VENIR': { bg: '#DBEAFE', color: '#1D4ED8' },
  'REPORTÉ': { bg: '#FEF3C7', color: '#B45309' },
};

function mapStatus(raw: string): ResultStatus {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('VALID')) return 'JOUÉ';
  if (s.includes('REPORT')) return 'REPORTÉ';
  return 'À VENIR';
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function mapMatch(m: ApiMatch): ResultMatch {
  const status = mapStatus(m.status);
  const played = status === 'JOUÉ';
  return {
    id: m.id,
    round: m.round ?? 0,
    roundLabel: `J${m.round ?? 0}`,
    date: fmtDate(m.scheduled_at),
    time: fmtTime(m.scheduled_at),
    venue: m.venue?.trim() ? m.venue : 'À définir',
    home: m.home_team?.name ?? '—',
    away: m.away_team?.name ?? '—',
    homeColor: m.home_team?.primary_color?.trim() ? m.home_team.primary_color! : '#1E7A3A',
    awayColor: m.away_team?.primary_color?.trim() ? m.away_team.primary_color! : '#F7921E',
    homeScore: played ? m.home_score : null,
    awayScore: played ? m.away_score : null,
    status,
  };
}

function StatusBadge({ status }: { status: ResultStatus }) {
  const { bg, color } = STATUS_META[status];
  return (
    <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: bg, color }}>
      {status}
    </span>
  );
}

function ResultCard({ match }: { match: ResultMatch }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center px-6 py-5">
        {/* Méta gauche */}
        <div className="w-44 flex-shrink-0">
          <p className="text-sm font-bold" style={{ color: '#1E7A3A' }}>{match.roundLabel} · {match.date}</p>
          <p className="text-xs text-gray-400 mt-0.5">{match.time} · {match.venue}</p>
        </div>

        {/* Score centre */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <span className="font-bold text-gray-900 text-right w-40">{match.home}</span>
          <span className="w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: match.homeColor }} />
          {match.status === 'À VENIR' ? (
            <span className="text-gray-400 font-semibold text-sm px-2">vs</span>
          ) : (
            <span className="text-2xl font-black text-gray-900 tabular-nums px-1">
              {match.homeScore} <span style={{ color: '#1E7A3A' }}>—</span> {match.awayScore}
            </span>
          )}
          <span className="w-6 h-6 rounded-md flex-shrink-0" style={{ backgroundColor: match.awayColor }} />
          <span className="font-bold text-gray-900 w-40">{match.away}</span>
        </div>

        {/* Statut */}
        <div className="w-40 flex-shrink-0 flex items-center justify-end gap-3">
          <StatusBadge status={match.status} />
        </div>
      </div>
    </div>
  );
}

export default function LigueResultatsPage() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;

  const [leagueName, setLeagueName] = useState<string>('');
  const [matches, setMatches] = useState<ResultMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChip, setActiveChip] = useState<string>('Toutes');
  const [statusFilter, setStatusFilter] = useState<ResultStatus | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await apiFetch<ApiLeagueDetail>(`/leagues/${leagueId}`);
        if (cancelled) return;
        setLeagueName(data.name ?? '');
        setMatches(Array.isArray(data.matches) ? data.matches.map(mapMatch) : []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const roundChips = useMemo(() => {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    return ['Toutes', ...rounds.map((r) => `J${r}`)];
  }, [matches]);

  const visible = matches.filter((m) => {
    if (activeChip !== 'Toutes' && m.roundLabel !== activeChip) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  const STATUS_FILTERS: { label: string; value: ResultStatus }[] = [
    { label: 'Joués', value: 'JOUÉ' },
    { label: 'À venir', value: 'À VENIR' },
    { label: 'Reportés', value: 'REPORTÉ' },
  ];

  return (
    <>
      <Header title={`Résultats — ${leagueName || 'Ligue'}`} />

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <span className="text-gray-400">Ligues</span>
        <span className="text-gray-300">›</span>
        <span className="font-semibold" style={{ color: '#1E7A3A' }}>Résultats</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {roundChips.map((c) => {
          const active = activeChip === c;
          return (
            <button
              key={c}
              onClick={() => setActiveChip(c)}
              className="h-9 px-4 rounded-full text-sm font-medium border transition"
              style={{
                backgroundColor: active ? '#1E7A3A' : 'white',
                color: active ? 'white' : '#374151',
                borderColor: active ? '#1E7A3A' : '#E5E7EB',
              }}
            >
              {c}
            </button>
          );
        })}

        <div className="ml-auto flex gap-2.5">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(active ? null : f.value)}
                className="h-9 px-4 rounded-full text-sm font-medium border transition"
                style={{
                  backgroundColor: active ? '#F7921E' : 'white',
                  color: active ? 'white' : '#4B5563',
                  borderColor: active ? '#F7921E' : '#E5E7EB',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cartes de résultats */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          {loading ? 'Chargement des résultats…' : 'Aucun match pour ce filtre.'}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((m) => (
            <ResultCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </>
  );
}
