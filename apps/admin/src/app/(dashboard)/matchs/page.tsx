'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, MapPin, User, Plus, Radio, Eye, Target } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';

type MatchStatus =
  | 'PROGRAMMÉ'
  | 'PUBLIÉ'
  | 'EN_COURS'
  | 'TERMINÉ'
  | 'VALIDÉ'
  | 'REPORTÉ'
  | 'ANNULÉ';

interface TeamRef {
  id: string;
  name: string;
  logo_url?: string | null;
  primary_color?: string | null;
}

interface ApiMatch {
  id: string;
  home_team: TeamRef | null;
  away_team: TeamRef | null;
  home_score: number;
  away_score: number;
  status: MatchStatus;
  round?: number | null;
  scheduled_at: string;
  venue?: string | null;
  tournament?: { id: string; name: string } | null;
  referee?: { id: string; full_name: string } | null;
}

interface LeagueOption {
  id: string;
  name: string;
}

interface LeagueTeam {
  id: string;
  name: string;
}

interface ApiLeagueDetail {
  id: string;
  name: string;
  teams?: { id: string; name: string }[] | { team: { id: string; name: string } }[];
}

/** Métadonnées d'affichage par statut de match (libellés FR + couleurs charte). */
const STATUS_META: Record<MatchStatus, { label: string; bg: string; color: string; live?: boolean }> = {
  PROGRAMMÉ: { label: 'À VENIR', bg: '#DBEAFE', color: '#1D4ED8' },
  PUBLIÉ: { label: 'PUBLIÉ', bg: '#EDE9FE', color: '#6D28D9' },
  EN_COURS: { label: 'EN DIRECT', bg: '#FEE2E2', color: '#DC2626', live: true },
  TERMINÉ: { label: 'TERMINÉ', bg: '#DCFCE7', color: '#15803D' },
  VALIDÉ: { label: 'VALIDÉ', bg: '#DCFCE7', color: '#15803D' },
  REPORTÉ: { label: 'REPORTÉ', bg: '#FEF3C7', color: '#B45309' },
  ANNULÉ: { label: 'ANNULÉ', bg: '#F3F4F6', color: '#6B7280' },
};

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'Tous', value: '' },
  { label: 'À venir', value: 'PROGRAMMÉ' },
  { label: 'En direct', value: 'EN_COURS' },
  { label: 'Terminés', value: 'TERMINÉ' },
  { label: 'Validés', value: 'VALIDÉ' },
  { label: 'Reportés', value: 'REPORTÉ' },
];

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function teamColor(t: TeamRef | null, fallback: string) {
  return t?.primary_color?.trim() ? t.primary_color! : fallback;
}

function StatusBadge({ status }: { status: MatchStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.PROGRAMMÉ;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide"
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      {meta.live && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />}
      {meta.label}
    </span>
  );
}

function MatchCard({ m }: { m: ApiMatch }) {
  const meta = STATUS_META[m.status] ?? STATUS_META.PROGRAMMÉ;
  const scored = m.status !== 'PROGRAMMÉ' && m.status !== 'PUBLIÉ' && m.status !== 'REPORTÉ' && m.status !== 'ANNULÉ';
  const canLive = m.status === 'EN_COURS' || m.status === 'PROGRAMMÉ' || m.status === 'PUBLIÉ';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* En-tête : statut + journée */}
      <div className="flex items-center justify-between px-5 pt-4">
        <StatusBadge status={m.status} />
        {m.round != null && <span className="text-xs font-semibold text-gray-400">J{m.round}</span>}
      </div>

      {/* Équipes + score */}
      <div className="flex items-center justify-center gap-4 px-5 py-7">
        <span className="font-bold text-gray-900 text-right flex-1 min-w-0 truncate">{m.home_team?.name ?? '—'}</span>
        <span className="w-7 h-7 rounded-md flex-shrink-0" style={{ backgroundColor: teamColor(m.home_team, '#1E7A3A') }} />
        {scored ? (
          <span className="text-2xl font-black tabular-nums px-1" style={{ color: meta.live ? '#DC2626' : '#111827' }}>
            {m.home_score} <span className="text-gray-300">—</span> {m.away_score}
          </span>
        ) : (
          <span className="text-sm font-bold text-gray-400 px-2">VS</span>
        )}
        <span className="w-7 h-7 rounded-md flex-shrink-0" style={{ backgroundColor: teamColor(m.away_team, '#F7921E') }} />
        <span className="font-bold text-gray-900 flex-1 min-w-0 truncate">{m.away_team?.name ?? '—'}</span>
      </div>

      {/* Pied : lieu / arbitre + actions */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-50 bg-gray-50/40">
        <div className="flex items-center gap-4 text-xs text-gray-500 min-w-0">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <MapPin size={13} className="flex-shrink-0" style={{ color: '#DC2626' }} />
            <span className="truncate">{m.venue?.trim() || 'À définir'}</span>
          </span>
          {m.referee?.full_name ? (
            <span className="flex items-center gap-1 truncate">
              <User size={13} className="flex-shrink-0" />
              <span className="truncate">{m.referee.full_name}</span>
            </span>
          ) : (
            <span className="text-gray-400">Non affecté</span>
          )}
          <span className="text-gray-400 whitespace-nowrap">{fmtTime(m.scheduled_at)}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/matchs/${m.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-white transition"
          >
            <Eye size={14} /> Voir
          </Link>
          {canLive && (
            <Link
              href={`/matchs/${m.id}/live`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#F7921E' }}
            >
              <Radio size={14} /> Saisir le score
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition';

/** Modal de programmation d'un nouveau match — POST /matches. */
function CreateMatchModal({
  leagues,
  onClose,
  onCreated,
}: {
  leagues: LeagueOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tournamentId, setTournamentId] = useState(leagues[0]?.id ?? '');
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [round, setRound] = useState('');
  const [venue, setVenue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge les équipes du tournoi sélectionné.
  useEffect(() => {
    if (!tournamentId) {
      setTeams([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ApiLeagueDetail>(`/leagues/${tournamentId}`);
        if (cancelled) return;
        const raw = data.teams ?? [];
        const mapped: LeagueTeam[] = raw.map((t) =>
          'team' in t ? { id: t.team.id, name: t.team.name } : { id: t.id, name: t.name }
        );
        setTeams(mapped);
      } catch {
        if (!cancelled) setTeams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  async function handleCreate() {
    if (!homeTeamId || !awayTeamId || !scheduledAt) {
      setError('Renseignez les équipes et la date du match.');
      return;
    }
    if (homeTeamId === awayTeamId) {
      setError('Les deux équipes doivent être différentes.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/matches', {
        method: 'POST',
        body: JSON.stringify({
          tournament_id: tournamentId || undefined,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          scheduled_at: new Date(scheduledAt).toISOString(),
          round: round ? Number(round) : undefined,
          venue: venue.trim() || undefined,
        }),
      });
      onCreated();
      onClose();
    } catch {
      setError('Échec de la programmation du match. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-black text-gray-900 mb-6">Programmer un match</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-2">Tournoi</label>
            <div className="relative">
              <select
                value={tournamentId}
                onChange={(e) => {
                  setTournamentId(e.target.value);
                  setHomeTeamId('');
                  setAwayTeamId('');
                }}
                className={`${INPUT_CLS} appearance-none pr-10`}
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Équipe à domicile</label>
              <div className="relative">
                <select value={homeTeamId} onChange={(e) => setHomeTeamId(e.target.value)} className={`${INPUT_CLS} appearance-none pr-10`}>
                  <option value="">Sélectionner…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Équipe à l&apos;extérieur</label>
              <div className="relative">
                <select value={awayTeamId} onChange={(e) => setAwayTeamId(e.target.value)} className={`${INPUT_CLS} appearance-none pr-10`}>
                  <option value="">Sélectionner…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Date &amp; heure</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Journée</label>
              <input value={round} onChange={(e) => setRound(e.target.value)} placeholder="Ex : 3" className={INPUT_CLS} />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-gray-800 mb-2">Terrain</label>
            <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ex : Five Arena Cocody" className={INPUT_CLS} />
          </div>
        </div>

        {error && <p className="mt-6 text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex justify-end gap-3 mt-8">
          <button onClick={onClose} className="px-6 h-11 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-6 h-11 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#1E7A3A' }}
          >
            {saving ? 'Programmation…' : 'Programmer le match'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchsPage() {
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [tournamentId, setTournamentId] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Charge la liste des tournois pour le sélecteur.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<LeagueOption[]>('/leagues');
        if (!cancelled && Array.isArray(data)) setLeagues(data.map((l) => ({ id: l.id, name: l.name })));
      } catch {
        if (!cancelled) setLeagues([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les matchs selon les filtres.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    const params = new URLSearchParams();
    if (tournamentId) params.set('tournament_id', tournamentId);
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    const qs = params.toString();
    (async () => {
      try {
        const data = await apiFetch<ApiMatch[]>(`/matches${qs ? `?${qs}` : ''}`);
        if (!cancelled) setMatches(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, status, date, reloadKey]);

  const counts = useMemo(() => {
    const c = { live: 0, upcoming: 0, played: 0, reported: 0 };
    for (const m of matches) {
      if (m.status === 'EN_COURS') c.live++;
      else if (m.status === 'PROGRAMMÉ' || m.status === 'PUBLIÉ') c.upcoming++;
      else if (m.status === 'TERMINÉ' || m.status === 'VALIDÉ') c.played++;
      else if (m.status === 'REPORTÉ') c.reported++;
    }
    return c;
  }, [matches]);

  return (
    <>
      <Header title="Matchs" />

      {/* Filtres */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="h-11 w-72 pl-4 pr-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 bg-white focus:outline-none focus:border-primary appearance-none"
            >
              <option value="">Tous les tournois</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-primary"
          />
        </div>

        {/* CTA orange — SANS glow */}
        <button
          onClick={() => setShowCreate(true)}
          disabled={leagues.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#F7921E' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Programmer un match
        </button>
      </div>

      {/* Chips statut */}
      <div className="flex gap-2.5 flex-wrap mb-6">
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
              style={{
                backgroundColor: active ? '#1E7A3A' : 'white',
                color: active ? 'white' : '#374151',
                borderColor: active ? '#1E7A3A' : '#E5E7EB',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <SummaryChip dot="#DC2626" value={counts.live} label="En direct" />
        <SummaryChip dot="#1D4ED8" value={counts.upcoming} label="À venir" />
        <SummaryChip dot="#15803D" value={counts.played} label="Joués" />
        <SummaryChip dot="#B45309" value={counts.reported} label="Reportés" />
      </div>

      {showCreate && (
        <CreateMatchModal
          leagues={leagues}
          onClose={() => setShowCreate(false)}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
      )}

      {loaded && matches.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Aucun match pour le moment"
          message="Ajustez les filtres ou programmez un nouveau match pour commencer."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {!loaded ? (
            <p className="col-span-full text-center text-gray-400 text-sm py-16">Chargement…</p>
          ) : (
            matches.map((m) => <MatchCard key={m.id} m={m} />)
          )}
        </div>
      )}
    </>
  );
}

function SummaryChip({ dot, value, label }: { dot: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
      <span className="text-lg font-black text-gray-900">{value}</span>
      <span className="text-sm font-medium text-gray-500">{label}</span>
    </div>
  );
}
