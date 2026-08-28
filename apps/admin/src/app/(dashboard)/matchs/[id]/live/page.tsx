'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Trash2, ArrowLeft } from 'lucide-react';
import { Header } from '../../../../../components/layout/header';
import { apiFetch } from '../../../../../lib/api';

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
  logo_url?: string | null;
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
  events?: MatchEvent[];
}

interface TeamMember {
  user: { id: string; full_name: string };
  jersey_num: number | null;
  role: string | null;
}

const EVENT_META: Record<EventType, { icon: string; label: string; color: string }> = {
  BUT: { icon: '⚽', label: 'But', color: '#1E7A3A' },
  PASSE: { icon: '🅰️', label: 'Passe décisive', color: '#6B7280' },
  CARTON_JAUNE: { icon: '🟨', label: 'Carton jaune', color: '#CA8A04' },
  CARTON_ROUGE: { icon: '🟥', label: 'Carton rouge', color: '#DC2626' },
  CSC: { icon: '⚽', label: 'CSC', color: '#DC2626' },
  BLESSURE: { icon: '➕', label: 'Blessure', color: '#DC2626' },
};

interface Control {
  controller_name: string | null;
  phase: string | null;
  status: string;
}

// Commandes de déroulement du match (Section 7).
const PHASES: { key: string; label: string }[] = [
  { key: 'PREMIERE_MP', label: 'Début du match' },
  { key: 'ARRET_JEU', label: 'Arrêt de jeu' },
  { key: 'ADDITIONNEL_1', label: 'Temps add. 1re MT' },
  { key: 'MI_TEMPS', label: 'Mi-temps' },
  { key: 'DEUXIEME_MP', label: 'Début 2e MT' },
  { key: 'ADDITIONNEL_2', label: 'Temps add. 2e MT' },
  { key: 'TERMINE', label: 'Fin du match' },
];
const PHASE_LABEL: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.key, p.label]));

function teamColor(t: TeamRef | null, fallback: string) {
  return t?.primary_color?.trim() ? t.primary_color! : fallback;
}

/** Popup obligatoire : identité du contrôleur avant toute saisie. */
function ControllerModal({ onSubmit }: { onSubmit: (first: string, last: string) => Promise<void> }) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!first.trim() || !last.trim()) {
      setError('Renseigne le nom et le prénom du contrôleur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(first.trim(), last.trim());
    } catch {
      setError('Échec de l\'enregistrement. Réessaie.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-xl font-black text-gray-900 mb-1">Contrôleur du match</h2>
        <p className="text-sm text-gray-500 mb-6">
          Identifie-toi avant de commencer la saisie du score.
        </p>
        <label className="block text-sm text-gray-600 mb-1">Prénom</label>
        <input value={first} onChange={(e) => setFirst(e.target.value)} className={`${INPUT_CLS} mb-3`} placeholder="Prénom" />
        <label className="block text-sm text-gray-600 mb-1">Nom</label>
        <input value={last} onChange={(e) => setLast(e.target.value)} className={`${INPUT_CLS} mb-4`} placeholder="Nom" />
        {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}
        <button onClick={submit} disabled={saving}
          className="w-full h-12 rounded-lg font-bold text-white transition disabled:opacity-60"
          style={{ backgroundColor: '#1E7A3A' }}>
          {saving ? 'Validation…' : 'Valider et commencer'}
        </button>
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition';

/** Modal de saisie d'un événement (but, carton…) — Écran 11. */
function EventModal({
  match,
  eventType,
  onClose,
  onSaved,
}: {
  match: ApiMatch;
  eventType: EventType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isGoal = eventType === 'BUT';
  const [teamId, setTeamId] = useState(match.home_team?.id ?? '');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [assistId, setAssistId] = useState('');
  const [minute, setMinute] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = EVENT_META[eventType];

  // Charge les joueurs de l'équipe sélectionnée.
  useEffect(() => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setPlayerId('');
    setAssistId('');
    (async () => {
      try {
        const data = await apiFetch<TeamMember[]>(`/teams/${teamId}/members`);
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  async function handleConfirm() {
    if (!teamId) {
      setError('Sélectionnez une équipe.');
      return;
    }
    const min = Number(String(minute).replace(/[^\d]/g, ''));
    if (!Number.isFinite(min) || min <= 0) {
      setError('Renseignez une minute valide.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/matches/${match.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          type: eventType,
          team_id: teamId,
          player_id: playerId || undefined,
          assist_player_id: isGoal && assistId ? assistId : undefined,
          minute: min,
        }),
      });
      onSaved();
      onClose();
    } catch {
      setError("Échec de l'enregistrement de l'événement. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  function memberLabel(m: TeamMember) {
    const num = m.jersey_num != null ? `N°${m.jersey_num} — ` : '';
    return `${num}${m.user.full_name}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-2xl font-black text-gray-900 mb-6">
          {isGoal ? 'Enregistrer un but' : `Enregistrer — ${meta.label}`}
        </h2>

        <div className="space-y-5">
          {/* 1 · Équipe */}
          <div>
            <p className="text-[13px] font-semibold text-gray-500 mb-2">1 · Équipe {isGoal ? 'qui marque' : 'concernée'}</p>
            <div className="grid grid-cols-2 gap-3">
              {[match.home_team, match.away_team].map((t) => {
                if (!t) return null;
                const active = teamId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTeamId(t.id)}
                    className="h-12 rounded-lg text-sm font-bold border transition"
                    style={{
                      backgroundColor: active ? '#1E7A3A' : 'white',
                      color: active ? 'white' : '#374151',
                      borderColor: active ? '#1E7A3A' : '#E5E7EB',
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 · Joueur */}
          <div>
            <p className="text-[13px] font-semibold text-gray-500 mb-2">2 · {isGoal ? 'Buteur' : 'Joueur'}</p>
            <div className="relative">
              <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={`${INPUT_CLS} appearance-none pr-10`}>
                <option value="">Sélectionner…</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>{memberLabel(m)}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 3 · Passeur (buts seulement) */}
          {isGoal && (
            <div>
              <p className="text-[13px] font-semibold text-gray-500 mb-2">3 · Passeur (optionnel)</p>
              <div className="relative">
                <select value={assistId} onChange={(e) => setAssistId(e.target.value)} className={`${INPUT_CLS} appearance-none pr-10`}>
                  <option value="">Aucun</option>
                  {members
                    .filter((m) => m.user.id !== playerId)
                    .map((m) => (
                      <option key={m.user.id} value={m.user.id}>{memberLabel(m)}</option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Minute */}
          <div>
            <p className="text-[13px] font-semibold text-gray-500 mb-2">{isGoal ? '4' : '3'} · Minute</p>
            <input
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              placeholder="Ex : 67"
              inputMode="numeric"
              className={INPUT_CLS}
            />
          </div>
        </div>

        {error && <p className="mt-5 text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="px-6 h-12 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 h-12 rounded-lg text-sm font-bold text-gray-900 transition hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#F7921E' }}
          >
            {saving ? 'Enregistrement…' : isGoal ? 'Confirmer le but' : "Confirmer l'événement"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bouton de changement de statut du match. */
function StatusButton({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 h-12 rounded-lg text-sm font-bold border transition disabled:opacity-40"
      style={{
        backgroundColor: active ? '#F7921E' : 'white',
        color: active ? 'white' : '#374151',
        borderColor: active ? '#F7921E' : '#E5E7EB',
      }}
    >
      {label}
    </button>
  );
}

export default function MatchLivePage() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id;

  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<EventType | null>(null);
  const [busy, setBusy] = useState(false);
  const [control, setControl] = useState<Control | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const [data, ctrl] = await Promise.all([
        apiFetch<ApiMatch>(`/matches/${matchId}`),
        apiFetch<Control>(`/matches/${matchId}/control`).catch(() => null),
      ]);
      setMatch(data);
      setControl(ctrl);
    } catch {
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  async function saveController(first: string, last: string) {
    if (!matchId) return;
    await apiFetch(`/matches/${matchId}/controller`, {
      method: 'PATCH',
      body: JSON.stringify({ first_name: first, last_name: last }),
    });
    await load();
  }

  async function setPhase(phase: string) {
    if (!matchId) return;
    setBusy(true);
    try {
      await apiFetch(`/matches/${matchId}/phase`, {
        method: 'PATCH',
        body: JSON.stringify({ phase }),
      });
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: MatchStatus) {
    if (!matchId) return;
    setBusy(true);
    try {
      await apiFetch(`/matches/${matchId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!matchId) return;
    try {
      await apiFetch(`/matches/${matchId}/events/${eventId}`, { method: 'DELETE' });
      await load();
    } catch {
      /* ignore */
    }
  }

  const events = useMemo(
    () => [...(match?.events ?? [])].sort((a, b) => a.minute - b.minute),
    [match]
  );

  if (loading) {
    return (
      <>
        <Header title="Saisie score — Live" />
        <p className="text-center text-gray-400 text-sm py-16">Chargement…</p>
      </>
    );
  }

  if (!match) {
    return (
      <>
        <Header title="Saisie score — Live" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          Match introuvable.
          <div className="mt-4">
            <Link href="/matchs" className="text-sm font-semibold" style={{ color: '#1E7A3A' }}>← Retour aux matchs</Link>
          </div>
        </div>
      </>
    );
  }

  const isLive = match.status === 'EN_COURS';
  const isFinished = match.status === 'TERMINÉ';
  const isValidated = match.status === 'VALIDÉ';

  return (
    <>
      <Header title="Saisie score — Live" />

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <Link href="/matchs" className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition">
          <ArrowLeft size={15} /> Matchs
        </Link>
        <span className="text-gray-300">›</span>
        <span className="font-semibold text-gray-700">
          {match.tournament?.name ?? 'Match'}{match.round != null ? ` · Journée ${match.round}` : ''}
        </span>
      </div>

      {/* Bandeau score */}
      <div className="rounded-2xl p-8 mb-5 flex items-center justify-between" style={{ backgroundColor: '#0F3D1E' }}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden inline-flex items-center justify-center" style={{ backgroundColor: teamColor(match.home_team, '#1E7A3A') }}>
            {match.home_team?.logo_url ? <img src={match.home_team.logo_url} alt="" className="w-full h-full object-cover" /> : null}
          </span>
          <span className="text-xl font-bold text-white truncate">{match.home_team?.name ?? '—'}</span>
        </div>
        <div className="flex flex-col items-center px-6">
          <div className="text-5xl font-black text-white tabular-nums whitespace-nowrap">
            {match.home_score} <span className="text-white/40">—</span> {match.away_score}
          </div>
          <div className="mt-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: '#DC2626' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> EN DIRECT
              </span>
            ) : (
              <span className="text-[11px] font-bold tracking-wide" style={{ color: '#F7921E' }}>{match.status}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-1 min-w-0 justify-end">
          <span className="text-xl font-bold text-white truncate text-right">{match.away_team?.name ?? '—'}</span>
          <span className="w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden inline-flex items-center justify-center" style={{ backgroundColor: teamColor(match.away_team, '#F7921E') }}>
            {match.away_team?.logo_url ? <img src={match.away_team.logo_url} alt="" className="w-full h-full object-cover" /> : null}
          </span>
        </div>
      </div>

      {/* Contrôle du statut */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <p className="text-[13px] font-semibold text-gray-500 mb-3">Statut du match</p>
        <div className="flex gap-3">
          <StatusButton
            label="▶ Démarrer"
            active={isLive}
            disabled={busy || isLive || isFinished || isValidated}
            onClick={() => changeStatus('EN_COURS')}
          />
          <StatusButton
            label="⏹ Terminer"
            active={isFinished}
            disabled={busy || !isLive}
            onClick={() => changeStatus('TERMINÉ')}
          />
          <StatusButton
            label="✓ Valider"
            active={isValidated}
            disabled={busy || (!isFinished && !isValidated)}
            onClick={() => changeStatus('VALIDÉ')}
          />
        </div>
      </div>

      {/* Déroulement du match — commandes contrôleur (Section 7) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-[13px] font-semibold text-gray-500">Déroulement du match</p>
          <span className="text-xs text-gray-500">
            {control?.controller_name ? `Contrôleur : ${control.controller_name}` : ''}
            {control?.phase ? ` · Phase : ${PHASE_LABEL[control.phase] ?? control.phase}` : ''}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PHASES.map((p) => {
            const active = control?.phase === p.key;
            const isEnd = p.key === 'TERMINE';
            return (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                disabled={busy || isValidated || (isFinished && !isEnd)}
                className="h-11 rounded-lg text-sm font-bold border transition disabled:opacity-40"
                style={{
                  backgroundColor: active ? '#0F3D1E' : isEnd ? '#DC2626' : 'white',
                  color: active || isEnd ? 'white' : '#374151',
                  borderColor: active ? '#0F3D1E' : isEnd ? '#DC2626' : '#E5E7EB',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Boutons d'ajout d'événement */}
      <div className="rounded-2xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ backgroundColor: '#0F3D1E' }}>
        <button
          onClick={() => setModalType('BUT')}
          className="h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: '#1E7A3A' }}
        >
          <span className="text-lg">⚽</span> But
        </button>
        <button
          onClick={() => setModalType('CARTON_JAUNE')}
          className="h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="text-lg">🟨</span> Carton jaune
        </button>
        <button
          onClick={() => setModalType('CARTON_ROUGE')}
          className="h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="text-lg">🟥</span> Carton rouge
        </button>
        <button
          onClick={() => setModalType('BLESSURE')}
          className="h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-white transition hover:opacity-90"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <span className="text-lg">➕</span> Blessure
        </button>
      </div>

      {/* Timeline des événements */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-[15px] text-gray-900 mb-4">Timeline événements</h3>
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Aucun événement enregistré pour le moment.</p>
        ) : (
          <ul className="space-y-1">
            {events.map((ev) => {
              const meta = EVENT_META[ev.type] ?? EVENT_META.BUT;
              return (
                <li key={ev.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 group">
                  <span className="text-lg w-6 text-center flex-shrink-0">{meta.icon}</span>
                  <span className="font-bold text-gray-900 w-12 flex-shrink-0 tabular-nums">{ev.minute}&apos;</span>
                  <span className="font-semibold text-gray-800 flex-shrink-0">{ev.player?.full_name ?? meta.label}</span>
                  <span className="text-sm text-gray-400 truncate flex-1">· {ev.team?.name ?? ''}</span>
                  <button
                    onClick={() => deleteEvent(ev.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                    title="Supprimer l'événement"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalType && (
        <EventModal
          match={match}
          eventType={modalType}
          onClose={() => setModalType(null)}
          onSaved={load}
        />
      )}

      {/* Popup obligatoire : la saisie est bloquée tant que le contrôleur
          n'est pas identifié (Section 7). */}
      {!control?.controller_name && <ControllerModal onSubmit={saveController} />}
    </>
  );
}
