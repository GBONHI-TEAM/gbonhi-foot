'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Trash2, ArrowLeft } from 'lucide-react';
import { Header } from '../../../../../components/layout/header';
import { apiFetch } from '../../../../../lib/api';
import { useCurrentUser } from '../../../../../lib/use-current-user';
import { normalizeAdminRole } from '../../../../../lib/admin-access';

type MatchStatus =
  | 'PROGRAMMÉ'
  | 'PUBLIÉ'
  | 'EN_COURS'
  | 'TERMINÉ'
  | 'VALIDÉ'
  | 'REPORTÉ'
  | 'ANNULÉ';

type EventType = 'BUT' | 'PENALTY' | 'PASSE' | 'CARTON_JAUNE' | 'CARTON_ROUGE' | 'CSC' | 'BLESSURE' | 'REMPLACEMENT';

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
  note?: string | null;
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
  referee?: { id: string; full_name: string | null } | null;
  events?: MatchEvent[];
}

interface TeamMember {
  user: { id: string; full_name: string };
  jersey_num: number | null;
  role: string | null;
}

const EVENT_META: Record<EventType, { icon: string; label: string; color: string }> = {
  BUT: { icon: '⚽', label: 'But', color: '#1E7A3A' },
  PENALTY: { icon: '🎯', label: 'Penalty', color: '#1E7A3A' },
  PASSE: { icon: '🅰️', label: 'Passe décisive', color: '#6B7280' },
  CARTON_JAUNE: { icon: '🟨', label: 'Carton jaune', color: '#CA8A04' },
  CARTON_ROUGE: { icon: '🟥', label: 'Carton rouge', color: '#DC2626' },
  CSC: { icon: '🥅', label: 'But c.s.c', color: '#DC2626' },
  BLESSURE: { icon: '➕', label: 'Blessure', color: '#DC2626' },
  REMPLACEMENT: { icon: '🔁', label: 'Remplacement', color: '#2563EB' },
};

interface Control {
  controller_name: string | null;
  phase: string | null;
  status: string;
  is_paused: boolean;
  added_time_first: number | null;
  added_time_second: number | null;
}

// Progression LINÉAIRE du match (une seule active à la fois). L'arrêt de jeu et
// le temps additionnel ne sont plus des « phases » mais des actions dédiées.
const PHASES: { key: string; label: string }[] = [
  { key: 'PREMIERE_MP', label: 'Coup d’envoi (1re MT)' },
  { key: 'MI_TEMPS', label: 'Mi-temps' },
  { key: 'DEUXIEME_MP', label: '2e mi-temps' },
  { key: 'TERMINE', label: 'Fin du match' },
];
const PHASE_LABEL: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.key, p.label]));

function teamColor(t: TeamRef | null, fallback: string) {
  return t?.primary_color?.trim() ? t.primary_color! : fallback;
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
  const isGoal = eventType === 'BUT' || eventType === 'PENALTY';
  const isSub = eventType === 'REMPLACEMENT';
  const [teamId, setTeamId] = useState(match.home_team?.id ?? '');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [assistId, setAssistId] = useState('');
  const [entrantId, setEntrantId] = useState('');
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
    setEntrantId('');
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
    if (isSub && (!playerId || !entrantId)) {
      setError('Sélectionnez le joueur sortant et le joueur entrant.');
      return;
    }
    setSaving(true);
    setError(null);
    const entrant = members.find((m) => m.user.id === entrantId);
    try {
      await apiFetch(`/matches/${match.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          type: eventType,
          team_id: teamId,
          player_id: playerId || undefined,
          assist_player_id: isGoal && assistId ? assistId : undefined,
          minute: min,
          note: isSub && entrant ? `Entré : ${entrant.user.full_name}` : undefined,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(`Échec de l'enregistrement de l'événement. ${e instanceof Error ? e.message : 'Réessayez.'}`);
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
            <p className="text-[13px] font-semibold text-gray-500 mb-2">2 · {isGoal ? 'Buteur' : isSub ? 'Joueur sortant' : 'Joueur'}</p>
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

          {/* Joueur entrant (remplacement) */}
          {isSub && (
            <div>
              <p className="text-[13px] font-semibold text-gray-500 mb-2">3 · Joueur entrant</p>
              <div className="relative">
                <select value={entrantId} onChange={(e) => setEntrantId(e.target.value)} className={`${INPUT_CLS} appearance-none pr-10`}>
                  <option value="">Sélectionner…</option>
                  {members.filter((m) => m.user.id !== playerId).map((m) => (
                    <option key={m.user.id} value={m.user.id}>{memberLabel(m)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

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
            <p className="text-[13px] font-semibold text-gray-500 mb-2">{isGoal || isSub ? '4' : '3'} · Minute</p>
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

/** Sélecteur de minutes de temps additionnel : − / valeur / +, borné 0–30. */
function AddedTimeStepper({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="h-12 rounded-lg border flex items-center justify-between px-2 gap-1" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex flex-col leading-tight pl-1">
        <span className="text-[11px] font-semibold text-gray-500">{label}</span>
        <span className="text-[11px] text-gray-400">{value > 0 ? `+${value} min` : 'aucun'}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value <= 0}
          className="w-8 h-8 rounded-md border text-lg font-bold text-gray-600 disabled:opacity-30"
          style={{ borderColor: '#E5E7EB' }}
          aria-label="Diminuer"
        >
          −
        </button>
        <span className="w-7 text-center text-base font-bold tabular-nums text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(30, value + 1))}
          disabled={disabled || value >= 30}
          className="w-8 h-8 rounded-md text-lg font-bold text-white disabled:opacity-30"
          style={{ backgroundColor: '#1E7A3A' }}
          aria-label="Augmenter"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function MatchLivePage() {
  const params = useParams<{ id: string }>();
  const matchId = params?.id;

  const { user } = useCurrentUser();
  const role = user ? normalizeAdminRole(user.role ?? undefined) : null;
  // Seuls les comptes CONTRÔLEUR (et le SUPER_ADMIN superviseur) peuvent
  // contrôler un match. Aligné avec le backend.
  const canControl = role ? ['SUPER_ADMIN', 'CONTROLEUR'].includes(role) : null;

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

  // Le contrôleur s'auto-enregistre : l'identité est celle du COMPTE connecté
  // (le backend dérive le nom du profil), plus de saisie libre falsifiable.
  const saveController = useCallback(async () => {
    if (!matchId) return;
    await apiFetch(`/matches/${matchId}/controller`, { method: 'PATCH' });
    await load();
  }, [matchId, load]);

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

  // Bascule arrêt de jeu ↔ reprise. Mise à jour OPTIMISTE (instantanée) + envoi
  // réseau en arrière-plan, sans recharger tout le match → réponse immédiate.
  function togglePause(paused: boolean) {
    if (!matchId) return;
    setControl((c) => (c ? { ...c, is_paused: paused } : c));
    apiFetch(`/matches/${matchId}/pause`, {
      method: 'PATCH',
      body: JSON.stringify({ paused }),
    }).catch(() => { void load(); }); // réconciliation seulement en cas d'échec
  }

  // Temps additionnel : mise à jour OPTIMISTE immédiate + persistance réseau
  // « débouncée » par mi-temps (on n'envoie que la valeur finale après une
  // rafale de +/-), sans recharger tout le match.
  const addedTimeTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  function setAddedTime(half: 1 | 2, minutes: number) {
    if (!matchId) return;
    const clamped = Math.max(0, Math.min(30, minutes));
    setControl((c) => (c ? { ...c, [half === 1 ? 'added_time_first' : 'added_time_second']: clamped } : c));
    if (addedTimeTimers.current[half]) clearTimeout(addedTimeTimers.current[half]);
    addedTimeTimers.current[half] = setTimeout(() => {
      apiFetch(`/matches/${matchId}/added-time`, {
        method: 'PATCH',
        body: JSON.stringify({ half, minutes: clamped }),
      }).catch(() => { void load(); });
    }, 350);
  }

  useEffect(() => {
    load();
  }, [load]);

  // Enregistrement automatique du contrôleur désigné (identité = compte connecté)
  // dès qu'il ouvre le match, si aucun contrôleur n'est encore inscrit.
  useEffect(() => {
    const designated = !!user && !!match && match.referee?.id === user.id;
    if (designated && control && !control.controller_name) {
      void saveController();
    }
  }, [user, match, control, saveController]);

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

  // Accès refusé aux non-contrôleurs (la sécurité réelle est côté API : les
  // endpoints de contrôle renvoient 403 ; ici on affiche un message clair).
  // Un contrôleur qui n'est PAS le contrôleur désigné de CE match est aussi
  // refusé (seul le SUPER_ADMIN passe partout).
  const isDesignated = role === 'SUPER_ADMIN' || (!!user && match.referee?.id === user.id);
  if (canControl === false || (canControl === true && !isDesignated)) {
    const notDesignated = canControl === true;
    return (
      <>
        <Header title="Saisie score — Live" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-5xl mb-3">🔒</p>
          <p className="text-lg font-black text-gray-900">
            {notDesignated ? 'Tu n’es pas le contrôleur désigné' : 'Accès réservé aux contrôleurs'}
          </p>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            {notDesignated
              ? `Seul le contrôleur désigné pour ce match peut le contrôler${match.referee?.full_name ? ` (${match.referee.full_name})` : ''}.`
              : 'Seuls les comptes « contrôleur » désignés peuvent contrôler un match et saisir un score en direct.'}
          </p>
          <div className="mt-5">
            <Link href="/matchs" className="text-sm font-semibold" style={{ color: '#1E7A3A' }}>← Retour aux matchs</Link>
          </div>
        </div>
      </>
    );
  }

  const isLive = match.status === 'EN_COURS';
  const isFinished = match.status === 'TERMINÉ';
  const isValidated = match.status === 'VALIDÉ';
  // Saisie du score (événements) : réservée au contrôleur DÉSIGNÉ de ce match.
  // Le SUPER_ADMIN supervise (statut/phase) mais ne peut PAS saisir le score.
  // Peut saisir le score : le SUPER_ADMIN (superviseur, tous les droits) OU le
  // contrôleur désigné de ce match. C'est exactement la condition d'accès à la
  // page — donc tout compte qui parvient ici peut aussi saisir le score.
  const canEnterScore = isDesignated;

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
          <span className="text-xs text-gray-500 flex items-center gap-2">
            {control?.controller_name ? <span>Contrôleur : {control.controller_name}</span> : null}
            {control?.phase ? <span>· Phase : {PHASE_LABEL[control.phase] ?? control.phase}</span> : null}
            {control?.is_paused ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                ⏸ Jeu arrêté
              </span>
            ) : null}
          </span>
        </div>

        {/* Progression linéaire */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Progression</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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

        {/* Pendant le jeu : arrêt/reprise + temps additionnel */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Pendant le jeu</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Bascule arrêt de jeu ↔ reprise */}
          {control?.is_paused ? (
            <button
              onClick={() => togglePause(false)}
              disabled={busy || !isLive}
              className="h-12 rounded-lg text-sm font-bold text-white transition disabled:opacity-40 inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1E7A3A' }}
            >
              ▶ Reprendre le jeu
            </button>
          ) : (
            <button
              onClick={() => togglePause(true)}
              disabled={busy || !isLive}
              className="h-12 rounded-lg text-sm font-bold border transition disabled:opacity-40 inline-flex items-center justify-center gap-2"
              style={{ borderColor: '#F7921E', color: '#B45309', backgroundColor: 'white' }}
            >
              ⏸ Arrêt de jeu
            </button>
          )}

          {/* Temps additionnel 1re MT */}
          <AddedTimeStepper
            label="Temps add. 1re MT"
            value={control?.added_time_first ?? 0}
            disabled={busy || isValidated}
            onChange={(m) => setAddedTime(1, m)}
          />
          {/* Temps additionnel 2e MT */}
          <AddedTimeStepper
            label="Temps add. 2e MT"
            value={control?.added_time_second ?? 0}
            disabled={busy || isValidated}
            onChange={(m) => setAddedTime(2, m)}
          />
        </div>
      </div>

      {/* Boutons d'ajout d'événement */}
      <div className="rounded-2xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ backgroundColor: '#0F3D1E', opacity: canEnterScore ? 1 : 0.55 }}>
        {([
          { type: 'BUT', icon: '⚽', label: 'But', primary: true },
          { type: 'PENALTY', icon: '🎯', label: 'Penalty', primary: true },
          { type: 'CSC', icon: '🥅', label: 'But c.s.c' },
          { type: 'REMPLACEMENT', icon: '🔁', label: 'Remplacement' },
          { type: 'CARTON_JAUNE', icon: '🟨', label: 'Carton jaune' },
          { type: 'CARTON_ROUGE', icon: '🟥', label: 'Carton rouge' },
          { type: 'BLESSURE', icon: '➕', label: 'Blessure' },
        ] as { type: EventType; icon: string; label: string; primary?: boolean }[]).map((b) => (
          <button
            key={b.type}
            onClick={() => setModalType(b.type)}
            disabled={!canEnterScore}
            className="h-16 rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:hover:opacity-100"
            style={{ backgroundColor: b.primary ? '#1E7A3A' : 'rgba(255,255,255,0.06)', border: b.primary ? undefined : '1px solid rgba(255,255,255,0.12)' }}
          >
            <span className="text-lg">{b.icon}</span> {b.label}
          </button>
        ))}
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
                  <span className="text-sm text-gray-400 truncate flex-1">· {ev.team?.name ?? ''}{ev.note ? ` · ${ev.note}` : ''}</span>
                  {canEnterScore && (
                    <button
                      onClick={() => deleteEvent(ev.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title="Supprimer l'événement"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalType && canEnterScore && (
        <EventModal
          match={match}
          eventType={modalType}
          onClose={() => setModalType(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
