'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, User, Radio } from 'lucide-react';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';

type MatchStatus =
  | 'PROGRAMMÉ'
  | 'PUBLIÉ'
  | 'EN_COURS'
  | 'TERMINÉ'
  | 'VALIDÉ'
  | 'REPORTÉ'
  | 'ANNULÉ';

type EventType = 'BUT' | 'PASSE' | 'CARTON_JAUNE' | 'CARTON_ROUGE' | 'CSC' | 'BLESSURE';

interface TeamRef {
  id: string;
  name: string;
  primary_color?: string | null;
}

interface MatchEvent {
  id: string;
  type: EventType;
  minute: number;
  team: { id: string; name: string } | null;
  player: { id: string; full_name: string } | null;
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
  events?: MatchEvent[];
}

const STATUS_META: Record<MatchStatus, { label: string; bg: string; color: string }> = {
  PROGRAMMÉ: { label: 'À VENIR', bg: '#DBEAFE', color: '#1D4ED8' },
  PUBLIÉ: { label: 'PUBLIÉ', bg: '#EDE9FE', color: '#6D28D9' },
  EN_COURS: { label: 'EN DIRECT', bg: '#FEE2E2', color: '#DC2626' },
  TERMINÉ: { label: 'TERMINÉ', bg: '#DCFCE7', color: '#15803D' },
  VALIDÉ: { label: 'VALIDÉ', bg: '#DCFCE7', color: '#15803D' },
  REPORTÉ: { label: 'REPORTÉ', bg: '#FEF3C7', color: '#B45309' },
  ANNULÉ: { label: 'ANNULÉ', bg: '#F3F4F6', color: '#6B7280' },
};

const EVENT_META: Record<EventType, { icon: string; label: string }> = {
  BUT: { icon: '⚽', label: 'But' },
  PASSE: { icon: '🅰️', label: 'Passe décisive' },
  CARTON_JAUNE: { icon: '🟨', label: 'Carton jaune' },
  CARTON_ROUGE: { icon: '🟥', label: 'Carton rouge' },
  CSC: { icon: '⚽', label: 'Csc' },
  BLESSURE: { icon: '➕', label: 'Blessure' },
};

function teamColor(t: TeamRef | null, fallback: string) {
  return t?.primary_color?.trim() ? t.primary_color! : fallback;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{children}</span>
    </div>
  );
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id;

  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ApiMatch>(`/matches/${matchId}`);
        if (!cancelled) setMatch(data);
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const events = useMemo(
    () => [...(match?.events ?? [])].sort((a, b) => a.minute - b.minute),
    [match]
  );

  if (loading) {
    return (
      <>
        <Header title="Détail du match" />
        <p className="text-center text-gray-400 text-sm py-16">Chargement…</p>
      </>
    );
  }

  if (!match) {
    return (
      <>
        <Header title="Détail du match" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          Match introuvable.
          <div className="mt-4">
            <Link href="/matchs" className="text-sm font-semibold" style={{ color: '#1E7A3A' }}>← Retour aux matchs</Link>
          </div>
        </div>
      </>
    );
  }

  const meta = STATUS_META[match.status] ?? STATUS_META.PROGRAMMÉ;
  const scored = match.status !== 'PROGRAMMÉ' && match.status !== 'PUBLIÉ' && match.status !== 'REPORTÉ' && match.status !== 'ANNULÉ';
  const canLive = match.status === 'EN_COURS' || match.status === 'PROGRAMMÉ' || match.status === 'PUBLIÉ';

  return (
    <>
      <Header title="Détail du match" />

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <Link href="/matchs" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft size={15} /> Matchs
        </Link>
        <span className="text-gray-300">›</span>
        <span className="font-semibold" style={{ color: '#1E7A3A' }}>
          {match.home_team?.name ?? '—'} vs {match.away_team?.name ?? '—'}
          {match.round != null ? ` · J${match.round}` : ''}
        </span>
      </div>

      {/* Bandeau score */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="w-10 h-10 rounded-lg flex-shrink-0" style={{ backgroundColor: teamColor(match.home_team, '#1E7A3A') }} />
          <span className="text-lg font-bold text-gray-900 truncate">{match.home_team?.name ?? '—'}</span>
        </div>
        <div className="flex flex-col items-center px-6">
          {scored ? (
            <div className="text-4xl font-black text-gray-900 tabular-nums whitespace-nowrap">
              {match.home_score} <span className="text-gray-300">—</span> {match.away_score}
            </div>
          ) : (
            <div className="text-2xl font-black text-gray-400">VS</div>
          )}
          <span className="mt-2 inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-4 flex-1 min-w-0 justify-end">
          <span className="text-lg font-bold text-gray-900 truncate text-right">{match.away_team?.name ?? '—'}</span>
          <span className="w-10 h-10 rounded-lg flex-shrink-0" style={{ backgroundColor: teamColor(match.away_team, '#F7921E') }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Colonne infos */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[15px] text-gray-900 mb-3">Général</h3>
            <InfoRow label="Tournoi">{match.tournament?.name ?? '—'}</InfoRow>
            <InfoRow label="Journée">{match.round != null ? `J${match.round}` : '—'}</InfoRow>
            <InfoRow label="Date">{fmtDate(match.scheduled_at)}</InfoRow>
            <InfoRow label="Heure">{fmtTime(match.scheduled_at)}</InfoRow>
            <InfoRow label="Statut">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </InfoRow>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[15px] text-gray-900 mb-2 flex items-center gap-2">
              <MapPin size={16} style={{ color: '#DC2626' }} /> Terrain
            </h3>
            <p className="text-sm text-gray-700">{match.venue?.trim() || 'À définir'}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="font-bold text-[15px] text-gray-900 mb-2 flex items-center gap-2">
              <User size={16} className="text-gray-500" /> Arbitrage
            </h3>
            <p className="text-sm text-gray-700">{match.referee?.full_name ?? 'Non affecté'}</p>
          </div>

          {canLive && (
            <Link
              href={`/matchs/${match.id}/live`}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#F7921E' }}
            >
              <Radio size={16} /> Accéder à la saisie live
            </Link>
          )}
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-[15px] text-gray-900 mb-4">Timeline des événements</h3>
          {events.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Aucun événement enregistré pour ce match.</p>
          ) : (
            <ul className="space-y-1">
              {events.map((ev) => {
                const em = EVENT_META[ev.type] ?? EVENT_META.BUT;
                const isHome = ev.team?.id === match.home_team?.id;
                return (
                  <li key={ev.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-lg w-6 text-center flex-shrink-0">{em.icon}</span>
                    <span className="font-bold text-gray-900 w-12 flex-shrink-0 tabular-nums">{ev.minute}&apos;</span>
                    <span className="font-semibold text-gray-800">{ev.player?.full_name ?? em.label}</span>
                    <span className="text-xs text-gray-400">{em.label}</span>
                    <span
                      className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: '#F3F4F6', color: isHome ? '#1E7A3A' : '#B45309' }}
                    >
                      {ev.team?.name ?? '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
