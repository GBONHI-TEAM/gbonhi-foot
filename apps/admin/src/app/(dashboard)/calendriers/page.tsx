'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, MapPin, User, Check } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

type MatchStatus = 'VALIDÉ' | 'PUBLIÉ' | 'PROGRAMMÉ' | 'REPORTÉ';

interface CalMatch {
  id: string;
  time: string;
  venue: string;
  home: string;
  away: string;
  refereeId: string | null;
  refereeName: string | null;
  status: MatchStatus;
}

interface ApiUser {
  id: string;
  full_name: string | null;
}

interface Round {
  round: number;
  label: string;
  date: string;
  count: number;
  state: 'done' | 'current' | 'todo';
}

interface LeagueOption {
  id: string;
  name: string;
}

interface ApiTeamRef {
  name: string;
}

interface ApiMatch {
  id: string;
  round: number | null;
  status: string;
  scheduled_at: string;
  venue?: string | null;
  home_team?: ApiTeamRef | null;
  away_team?: ApiTeamRef | null;
  referee?: { id: string; full_name: string | null } | null;
}

interface ApiLeagueDetail {
  id: string;
  name: string;
  matches?: ApiMatch[];
}

/** Normalise le statut brut du match vers un statut d'affichage connu. */
function normalizeStatus(raw: string): MatchStatus {
  const s = (raw ?? '').toUpperCase();
  if (s.includes('VALID')) return 'VALIDÉ';
  if (s.includes('PUBLI')) return 'PUBLIÉ';
  if (s.includes('REPORT')) return 'REPORTÉ';
  return 'PROGRAMMÉ';
}

const STATUS_META: Record<MatchStatus, { label: string; bg: string; color: string }> = {
  VALIDÉ: { label: 'VALIDÉ', bg: '#DCFCE7', color: '#15803D' },
  PUBLIÉ: { label: 'PUBLIÉ', bg: '#DBEAFE', color: '#1D4ED8' },
  PROGRAMMÉ: { label: 'PROGRAMMÉ', bg: '#F3F4F6', color: '#6B7280' },
  REPORTÉ: { label: 'REPORTÉ', bg: '#FEF3C7', color: '#B45309' },
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function fmtLongDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

function StatusBadge({ status }: { status: MatchStatus }) {
  const { label, bg, color } = STATUS_META[status];
  return (
    <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

/** Pastille information (heure, terrain, arbitre) — style pilule bordée de la maquette. */
function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'time' | 'default' | 'warn' }) {
  const styles =
    tone === 'time'
      ? { borderColor: '#1E7A3A', color: '#1E7A3A' }
      : tone === 'warn'
      ? { borderColor: '#F7921E', color: '#F7921E' }
      : { borderColor: '#E5E7EB', color: '#4B5563' };
  return (
    <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium bg-white" style={styles}>
      {children}
    </span>
  );
}

export default function CalendriersPage() {
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [leagueId, setLeagueId] = useState<string>('');
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadMatches(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetch<ApiMatch[]>(`/matches?tournament_id=${id}`);
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  // Liste des contrôleurs possibles (utilisateurs).
  useEffect(() => {
    apiFetch<ApiUser[]>('/users')
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  async function generate() {
    if (!leagueId || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ message?: string; unplaced_warnings?: string[] }>(
        `/leagues/${leagueId}/calendar/generate`,
        { method: 'POST' },
      );
      await loadMatches(leagueId);
      const warnings = res?.unplaced_warnings ?? [];
      if (res?.message) {
        alert(
          res.message +
            (warnings.length ? `\n\n⚠️ ${warnings.length} avertissement(s) de planification :\n- ${warnings.join('\n- ')}` : ''),
        );
      }
    } catch (e) {
      alert('Génération impossible. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  async function publish(unpublish = false) {
    if (!leagueId || busy || activeRound == null) return;
    setBusy(true);
    try {
      await apiFetch(`/leagues/${leagueId}/calendar/${unpublish ? 'unpublish' : 'publish'}?round=${activeRound}`, { method: 'POST' });
      await loadMatches(leagueId);
    } catch (e) {
      alert('Action impossible. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  async function assignReferee(matchId: string, refereeId: string) {
    setBusy(true);
    try {
      await apiFetch(`/matches/${matchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ referee_id: refereeId || null }),
      });
      await loadMatches(leagueId);
    } catch (e) {
      alert("Assignation impossible. " + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  // Charge la liste des ligues pour le sélecteur.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<LeagueOption[]>('/leagues');
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setLeagues(data.map((l) => ({ id: l.id, name: l.name })));
        setLeagueId(data[0].id);
      } catch {
        /* sélecteur vide géré ci-dessous */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les matchs de la ligue à chaque changement de ligue.
  useEffect(() => {
    loadMatches(leagueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  // Construit la liste des journées à partir des matchs réels.
  const rounds = useMemo<Round[]>(() => {
    const byRound = new Map<number, ApiMatch[]>();
    for (const m of matches) {
      const r = m.round ?? 0;
      const arr = byRound.get(r) ?? [];
      arr.push(m);
      byRound.set(r, arr);
    }
    const ordered = [...byRound.keys()].sort((a, b) => a - b);
    const built: Round[] = ordered.map((r) => {
      const list = byRound.get(r)!;
      const allValidated = list.every((m) => normalizeStatus(m.status) === 'VALIDÉ');
      const someValidated = list.some((m) => normalizeStatus(m.status) === 'VALIDÉ');
      const firstDate = list
        .map((m) => m.scheduled_at)
        .filter(Boolean)
        .sort()[0];
      return {
        round: r,
        label: `J${r}`,
        date: firstDate ? fmtDate(firstDate) : '—',
        count: list.length,
        state: allValidated ? 'done' : someValidated ? 'current' : 'todo',
      };
    });
    // La journée "en cours" = première non entièrement validée ; sinon la dernière.
    const firstNotDone = built.find((b) => b.state !== 'done');
    return built.map((b) => ({
      ...b,
      state:
        b.state === 'done'
          ? 'done'
          : firstNotDone && b.round === firstNotDone.round
          ? 'current'
          : 'todo',
    }));
  }, [matches]);

  // Sélectionne la journée en cours par défaut dès que les journées changent.
  useEffect(() => {
    if (rounds.length === 0) {
      setActiveRound(null);
      return;
    }
    setActiveRound((prev) => {
      if (prev != null && rounds.some((r) => r.round === prev)) return prev;
      const current = rounds.find((r) => r.state === 'current');
      return current ? current.round : rounds[0].round;
    });
  }, [rounds]);

  const idx = rounds.findIndex((r) => r.round === activeRound);
  const activeRoundMeta = idx >= 0 ? rounds[idx] : null;

  const roundMatches: CalMatch[] = useMemo(() => {
    if (activeRound == null) return [];
    return matches
      .filter((m) => (m.round ?? 0) === activeRound)
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
      .map((m) => ({
        id: m.id,
        time: fmtTime(m.scheduled_at),
        venue: m.venue?.trim() ? m.venue : 'À définir',
        home: m.home_team?.name ?? '—',
        away: m.away_team?.name ?? '—',
        refereeId: m.referee?.id ?? null,
        refereeName: m.referee?.full_name ?? null,
        status: normalizeStatus(m.status),
      }));
  }, [matches, activeRound]);

  function shift(delta: number) {
    const next = rounds[idx + delta];
    if (next) setActiveRound(next.round);
  }

  const roundTitle =
    activeRoundMeta && roundMatches.length > 0
      ? `Journée ${activeRoundMeta.round} — ${fmtLongDate(
          matches.find((m) => (m.round ?? 0) === activeRoundMeta.round)?.scheduled_at ?? '',
        )}`
      : activeRoundMeta
      ? `Journée ${activeRoundMeta.round}`
      : 'Aucune journée';

  return (
    <>
      <Header title="Calendrier des matchs" />

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="h-11 w-72 pl-4 pr-9 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 bg-white appearance-none focus:outline-none focus:border-primary"
          >
            {leagues.length === 0 && <option value="">Aucune ligue</option>}
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Nav journée */}
        <div className="flex items-center h-11 px-2 rounded-lg border border-gray-200 bg-white gap-3">
          <button onClick={() => shift(-1)} className="text-gray-500 hover:text-gray-800 disabled:opacity-30" disabled={idx <= 0}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-gray-800 w-6 text-center">{activeRoundMeta?.label ?? '—'}</span>
          <button onClick={() => shift(1)} className="text-gray-500 hover:text-gray-800 disabled:opacity-30" disabled={idx < 0 || idx === rounds.length - 1}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="ml-auto flex gap-2.5">
          <button
            onClick={generate}
            disabled={busy || !leagueId}
            className="h-11 px-5 rounded-lg text-sm font-semibold border transition hover:bg-green-50 disabled:opacity-40"
            style={{ borderColor: '#1E7A3A', color: '#1E7A3A' }}
          >
            {busy ? '…' : 'Générer le calendrier'}
          </button>
          <button
            onClick={() => publish(false)}
            disabled={busy || activeRound == null}
            className="h-11 px-5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#1E7A3A' }}
          >
            Publier {activeRoundMeta?.label ?? ''}
          </button>
          <button
            onClick={() => publish(true)}
            disabled={busy || activeRound == null}
            className="h-11 px-5 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition disabled:opacity-40"
          >
            Dépublier {activeRoundMeta?.label ?? ''}
          </button>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Panneau Journées */}
        <div className="w-72 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Journées</h2>
          </div>
          <div className="p-2">
            {rounds.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-400">
                {loading ? 'Chargement…' : 'Aucune journée programmée.'}
              </p>
            )}
            {rounds.map((r) => {
              const active = activeRound === r.round;
              return (
                <button
                  key={r.round}
                  onClick={() => setActiveRound(r.round)}
                  className="w-full flex items-center px-3 py-3 rounded-lg mb-1 transition text-left"
                  style={{
                    backgroundColor: active ? '#F0FDF4' : 'transparent',
                    borderLeft: active ? '3px solid #1E7A3A' : '3px solid transparent',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {r.label} <span className="text-gray-400 font-normal">· {r.date}</span>
                    </p>
                    {r.state === 'current' ? (
                      <p className="text-xs font-semibold mt-0.5 flex items-center gap-1" style={{ color: '#1E7A3A' }}>
                        <span aria-hidden>🏆</span> En cours · {r.count} matchs
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">{r.count} matchs</p>
                    )}
                  </div>
                  {r.state === 'done' ? (
                    <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1E7A3A' }}>
                      <Check size={13} className="text-white" strokeWidth={3} />
                    </span>
                  ) : r.state === 'todo' ? (
                    <span className="w-5 h-5 rounded border border-gray-300 bg-gray-100 flex-shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Matchs de la journée */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{roundTitle}</h2>
            {activeRoundMeta?.state === 'current' && (
              <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold tracking-wide" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                EN COURS
              </span>
            )}
          </div>

          {roundMatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
              {loading ? 'Chargement des matchs…' : 'Aucun match programmé pour cette journée.'}
            </div>
          ) : (
            <div className="space-y-3">
              {roundMatches.map((m) => (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <Chip tone="time">
                    {m.time} <span aria-hidden>👟</span>
                  </Chip>
                  <Chip>
                    <MapPin size={13} /> {m.venue} <ChevronDown size={13} className="text-gray-400" />
                  </Chip>

                  <div className="flex-1 text-center">
                    <span className="font-bold text-gray-900">{m.home}</span>
                    <span className="text-gray-400 font-medium"> vs </span>
                    <span className="font-bold text-gray-900">{m.away}</span>
                  </div>

                  {/* Assigner / Modifier le contrôleur du match (arbitre) */}
                  <div className="relative">
                    <select
                      value={m.refereeId ?? ''}
                      onChange={(e) => assignReferee(m.id, e.target.value)}
                      disabled={busy}
                      className="h-9 pl-8 pr-8 rounded-lg border text-sm font-medium bg-white appearance-none focus:outline-none disabled:opacity-50"
                      style={{ borderColor: m.refereeId ? '#1E7A3A' : '#F7921E', color: m.refereeId ? '#1E7A3A' : '#B45309', minWidth: '11rem' }}
                    >
                      <option value="">Non assigné</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name ?? 'Utilisateur'}</option>
                      ))}
                    </select>
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: m.refereeId ? '#1E7A3A' : '#F7921E' }} />
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>

                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BracketPanel leagueId={leagueId} />
    </>
  );
}

// ─── Tableau à élimination directe ──────────────────────────────────────────

interface BracketTeamRef {
  id: string;
  name: string;
  logo_url?: string | null;
}
interface BracketMatch {
  id: string; // node id
  slot: number;
  match_id: string | null;
  home: BracketTeamRef | null;
  away: BracketTeamRef | null;
  home_source: string | null;
  away_source: string | null;
  winner: BracketTeamRef | null;
}
interface BracketRound {
  round_size: number;
  round_name: string;
  matches: BracketMatch[];
}

const ROUND_LABEL: Record<number, string> = {
  2: 'Finale', 4: 'Demi-finales', 8: 'Quarts', 16: '8es de finale', 32: '16es', 64: '32es',
};

function BracketPanel({ leagueId }: { leagueId: string }) {
  const [rounds, setRounds] = useState<BracketRound[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!leagueId) return;
    try {
      const data = await apiFetch<{ rounds: BracketRound[] }>(`/leagues/${leagueId}/calendar/bracket`);
      setRounds(data?.rounds ?? []);
    } catch {
      setRounds([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function setWinner(nodeId: string, teamId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/leagues/${leagueId}/calendar/bracket/nodes/${nodeId}/winner`, {
        method: 'POST',
        body: JSON.stringify({ team_id: teamId }),
      });
      await load();
    } catch (e) {
      alert('Action impossible. ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  if (rounds.length === 0) return null;

  const label = (rs: number) => ROUND_LABEL[rs] ?? `Tour de ${rs}`;
  const teamCell = (t: BracketTeamRef | null, source: string | null, isWinner: boolean) => (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded"
      style={{ backgroundColor: isWinner ? '#DCFCE7' : 'transparent', fontWeight: isWinner ? 700 : 500 }}
    >
      <span className="text-sm text-gray-800 truncate">
        {t ? t.name : <span className="text-gray-400 italic">{sourceLabel(source)}</span>}
      </span>
    </div>
  );

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-bold text-gray-900 mb-4">Tableau du tournoi</h2>
      <div className="flex gap-6 overflow-x-auto pb-2">
        {rounds.map((r) => (
          <div key={r.round_size} className="flex-shrink-0 w-64">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">{label(r.round_size)}</div>
            <div className="space-y-3">
              {r.matches.map((m) => {
                const needsWinner = !!m.match_id && !!m.home && !!m.away && !m.winner;
                return (
                  <div key={m.id} className="rounded-lg border border-gray-200 overflow-hidden">
                    {teamCell(m.home, m.home_source, m.winner?.id === m.home?.id && !!m.winner)}
                    <div className="h-px bg-gray-100" />
                    {teamCell(m.away, m.away_source, m.winner?.id === m.away?.id && !!m.winner)}
                    {needsWinner && (
                      <div className="flex gap-1 p-1.5 bg-amber-50 border-t border-amber-100">
                        <span className="text-[10px] text-amber-700 self-center mr-1">Égalité ? Vainqueur :</span>
                        <button disabled={busy} onClick={() => setWinner(m.id, m.home!.id)}
                          className="text-[11px] px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-green-500">{m.home!.name}</button>
                        <button disabled={busy} onClick={() => setWinner(m.id, m.away!.id)}
                          className="text-[11px] px-2 py-0.5 rounded bg-white border border-gray-200 hover:border-green-500">{m.away!.name}</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "winner:8#0" / "seed:3" → libellé lisible pour un emplacement encore vide. */
function sourceLabel(source: string | null): string {
  if (!source) return 'À déterminer';
  if (source.startsWith('seed:')) return `Tête de série ${source.slice(5)}`;
  if (source.startsWith('winner:')) return 'Vainqueur qualifié';
  return 'À déterminer';
}
