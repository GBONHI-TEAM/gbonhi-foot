'use client';
import { useEffect, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { PlayerProfileDrawer } from '../../../components/players/player-profile-drawer';
import { apiFetch } from '../../../lib/api';

type TeamStatus = 'ACTIF' | 'SUSPENDU';

interface TeamPlayer {
  id: string;
  jersey: number | null;
  name: string;
  position: string;
  avatarUrl: string | null;
  isStarter: boolean;
}

interface Team {
  id: string;
  abbr: string;
  name: string;
  captain: string;
  city: string;
  code: string;
  players: number;
  league: string;
  status: TeamStatus;
  color: string;
  members: TeamPlayer[];
}

interface ApiTeam {
  id: string;
  name: string;
  status: string;
  primary_color?: string | null;
  city?: string | null;
  invitation_code?: string | null;
  _count?: { members: number };
  home_terrain?: { name: string } | null;
}

interface ApiMember {
  id: string;
  jersey_num: number | null;
  role: string;
  user?: { id: string; full_name?: string | null; avatar_url?: string | null; position?: string | null } | null;
}

const STOP_WORDS = new Set(['FC', 'SC', 'AS', 'UNITED', 'STARS', 'CLUB']);

/** Dérive une abréviation à 3 lettres à partir du nom d'équipe. */
function toAbbr(name: string): string {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean);
  const main = words.find((w) => !STOP_WORDS.has(w)) ?? words[0] ?? '';
  return main.slice(0, 3).padEnd(3, main.slice(0, 1) || 'X');
}

function mapTeam(t: ApiTeam): Team {
  return {
    id: t.id,
    abbr: toAbbr(t.name),
    name: t.name,
    captain: '—',
    city: t.city?.trim() ? t.city : '—',
    code: t.invitation_code?.trim() ? t.invitation_code : '—',
    players: t._count?.members ?? 0,
    league: t.home_terrain?.name ?? '—',
    status: (t.status ?? '').toLowerCase() === 'suspended' ? 'SUSPENDU' : 'ACTIF',
    color: t.primary_color?.trim() ? t.primary_color : '#1E7A3A',
    members: [],
  };
}

const TAB_FILTERS = ['Toutes', 'En ligue', 'Sans ligue', 'Suspendues'];
const DRAWER_TABS = ['Joueurs', 'Résultats', 'Calendrier', 'Ligue', 'Actions'];

const MENU_ACTIONS: { label: string; tab: string; color: string }[] = [
  { label: 'Voir les détails', tab: 'Joueurs', color: '#111827' },
  { label: 'Voir les résultats', tab: 'Résultats', color: '#111827' },
  { label: 'Voir le calendrier', tab: 'Calendrier', color: '#111827' },
];

interface ApiMatchFull {
  id: string;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  home_score: number;
  away_score: number;
  status: string;
  scheduled_at: string;
  venue?: string | null;
}

interface DrawerMatch {
  id: string;
  date: string;
  opponent: string;
  home: boolean;
  status: string;
  teamScore: number;
  oppScore: number;
  venue?: string | null;
}

const FINISHED = ['TERMINÉ', 'VALIDÉ'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function TeamDrawer({
  team,
  initialTab = 'Joueurs',
  onClose,
  onSelectPlayer,
  onStatusChange,
}: {
  team: Team;
  initialTab?: string;
  onClose: () => void;
  onSelectPlayer: (p: TeamPlayer) => void;
  onStatusChange: () => void;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [members, setMembers] = useState<TeamPlayer[]>(team.members);
  const [matches, setMatches] = useState<DrawerMatch[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [status, setStatus] = useState<TeamStatus>(team.status);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => setActiveTab(initialTab), [initialTab, team.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ApiMember[]>(`/teams/${team.id}/members`);
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setMembers(
          data.map((m, i) => ({
            id: m.user?.id ?? m.id,
            jersey: m.jersey_num,
            name: m.user?.full_name ?? '—',
            position: m.user?.position ?? '—',
            avatarUrl: m.user?.avatar_url ?? null,
            isStarter: i < 11,
          })),
        );
      } catch { /* garde members initiaux */ }
    })();
    return () => { cancelled = true; };
  }, [team.id]);

  // Matchs de l'équipe (résultats + calendrier) — filtrés depuis /matches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await apiFetch<ApiMatchFull[]>('/matches');
        if (cancelled) return;
        const mine: DrawerMatch[] = (Array.isArray(all) ? all : [])
          .filter((m) => m.home_team?.id === team.id || m.away_team?.id === team.id)
          .map((m) => {
            const home = m.home_team?.id === team.id;
            const opp = home ? m.away_team : m.home_team;
            return {
              id: m.id,
              date: m.scheduled_at,
              opponent: opp?.name ?? '—',
              home,
              status: m.status,
              teamScore: home ? m.home_score : m.away_score,
              oppScore: home ? m.away_score : m.home_score,
              venue: m.venue,
            };
          });
        setMatches(mine);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setMatchesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [team.id]);

  async function toggleStatus() {
    const next = status === 'ACTIF' ? 'suspended' : 'active';
    setStatusBusy(true);
    try {
      await apiFetch(`/teams/${team.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setStatus(next === 'suspended' ? 'SUSPENDU' : 'ACTIF');
      onStatusChange();
    } catch {
      alert("Action impossible. Vérifie tes droits ou que le backend est démarré.");
    } finally {
      setStatusBusy(false);
    }
  }

  const results = matches.filter((m) => FINISHED.includes(m.status.toUpperCase())).sort((a, b) => b.date.localeCompare(a.date));
  const calendar = matches.filter((m) => !FINISHED.includes(m.status.toUpperCase())).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-40 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: '#1E7A3A' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0" style={{ backgroundColor: team.color }}>
          {team.abbr}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-white text-base truncate">{team.name}</p>
          <p className="text-white/70 text-xs truncate">Capitaine · {team.captain}</p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: status === 'ACTIF' ? '#065F46' : '#7F1D1D', color: 'white' }}>
          {status}
        </span>
        <button onClick={onClose} className="text-white/60 hover:text-white ml-1 text-xl leading-none">×</button>
      </div>

      <div className="flex border-b border-gray-100 overflow-x-auto">
        {DRAWER_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="flex-1 whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition"
            style={{ borderBottomColor: activeTab === t ? '#1E7A3A' : 'transparent', color: activeTab === t ? '#1E7A3A' : '#6B7280' }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'Joueurs' && (
          <div className="pb-6">
            {members.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">N°</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Joueur</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Poste</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelectPlayer(p)}>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.jersey ?? '—'}</td>
                      <td className="px-5 py-3 font-medium text-gray-900"><span className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1E7A3A] text-[10px] font-black text-white">{p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : p.name.slice(0, 2).toUpperCase()}</span>{p.name}</span></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{p.position}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold" style={{ color: p.isStarter ? '#15803D' : '#9CA3AF' }}>
                          {p.isStarter ? 'Titulaire' : 'Remplaçant'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">Aucun joueur enregistré.</div>
            )}
          </div>
        )}

        {activeTab === 'Résultats' && (
          <div className="p-4">
            {!matchesLoaded ? (
              <p className="p-6 text-center text-gray-400 text-sm">Chargement…</p>
            ) : results.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">Aucun résultat pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {results.map((m) => {
                  const win = m.teamScore > m.oppScore;
                  const draw = m.teamScore === m.oppScore;
                  const color = win ? '#15803D' : draw ? '#B45309' : '#DC2626';
                  const letter = win ? 'V' : draw ? 'N' : 'D';
                  return (
                    <li key={m.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0" style={{ backgroundColor: color }}>{letter}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.home ? 'vs' : '@'} {m.opponent}</p>
                        <p className="text-xs text-gray-400">{fmtDate(m.date)}</p>
                      </div>
                      <span className="font-black text-gray-900 tabular-nums">{m.teamScore} - {m.oppScore}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'Calendrier' && (
          <div className="p-4">
            {!matchesLoaded ? (
              <p className="p-6 text-center text-gray-400 text-sm">Chargement…</p>
            ) : calendar.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">Aucun match à venir.</p>
            ) : (
              <ul className="space-y-2">
                {calendar.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                    <div className="w-11 flex flex-col items-center flex-shrink-0">
                      <span className="text-sm font-black text-gray-900">{new Date(m.date).getDate()}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{new Date(m.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.home ? 'vs' : '@'} {m.opponent}</p>
                      <p className="text-xs text-gray-400">{fmtTime(m.date)}{m.venue ? ` · ${m.venue}` : ''} · {m.home ? 'Domicile' : 'Extérieur'}</p>
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: '#F7921E' }}>{m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'Ligue' && (
          <div className="p-5">
            {team.league !== '—' ? (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="text-sm font-semibold text-green-800">{team.league}</p>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-sm">Cette équipe n&apos;est rattachée à aucune ligue.</div>
            )}
          </div>
        )}

        {activeTab === 'Actions' && (
          <div className="p-5">
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone actions</p>
              </div>
              <div className="p-4">
                <button
                  onClick={toggleStatus}
                  disabled={statusBusy}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: status === 'ACTIF' ? '#DC2626' : '#15803D' }}
                >
                  {statusBusy ? 'Enregistrement…' : status === 'ACTIF' ? 'Suspendre l\'équipe' : 'Réactiver l\'équipe'}
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  {status === 'ACTIF'
                    ? 'Une équipe suspendue reste visible mais marquée « Suspendu ».'
                    : 'Réactive l\'équipe pour la remettre en statut actif.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EquipesPage() {
  const [activeTab, setActiveTab] = useState('Toutes');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [drawerTab, setDrawerTab] = useState('Joueurs');
  const [selectedPlayer, setSelectedPlayer] = useState<TeamPlayer | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    try {
      const data = await apiFetch<ApiTeam[]>('/teams');
      setTeams(Array.isArray(data) ? data.map(mapTeam) : []);
    } catch {
      setTeams([]);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => { reload(); }, []);

  function openTeam(team: Team, tab: string) {
    setSelectedTeam(team);
    setDrawerTab(tab);
    setOpenMenu(null);
  }

  const filtered = teams.filter((t) => {
    if (activeTab === 'Toutes') return true;
    if (activeTab === 'En ligue') return t.league !== '—';
    if (activeTab === 'Sans ligue') return t.league === '—';
    if (activeTab === 'Suspendues') return t.status === 'SUSPENDU';
    return true;
  });

  return (
    <>
      <Header title="Gestion des Équipes" />

      {selectedTeam && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => { setSelectedTeam(null); setSelectedPlayer(null); }} />
          <TeamDrawer team={selectedTeam} initialTab={drawerTab} onClose={() => { setSelectedTeam(null); setSelectedPlayer(null); }} onSelectPlayer={setSelectedPlayer} onStatusChange={reload} />
          {selectedPlayer && (
            <>
              <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelectedPlayer(null)} />
              <PlayerProfileDrawer
                playerId={selectedPlayer.id}
                teamName={selectedTeam.name}
                jerseyNumber={selectedPlayer.jersey}
                membershipStatus={selectedPlayer.isStarter ? 'Titulaire' : 'Remplaçant'}
                onClose={() => setSelectedPlayer(null)}
              />
            </>
          )}
        </>
      )}

      {/* Chips filtre */}
      <div className="flex gap-2.5 mb-6">
        {TAB_FILTERS.map((t) => {
          const active = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
              style={{
                backgroundColor: active ? '#1E7A3A' : 'white',
                color: active ? 'white' : '#374151',
                borderColor: active ? '#1E7A3A' : '#E5E7EB',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Équipe', 'Code invitation', 'Joueurs', 'Terrain', 'Statut', 'Actions'].map((h, i) => (
                <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-500" style={{ textAlign: i === 5 ? 'right' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((team) => (
              <tr key={team.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black flex-shrink-0" style={{ backgroundColor: team.color }}>
                      {team.abbr}
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 block">{team.name}</span>
                      <span className="text-xs text-gray-400">{team.city}</span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-gray-600">{team.code}</td>
                <td className="px-5 py-4 text-gray-700">{team.players}</td>
                <td className="px-5 py-4 text-gray-500">{team.league}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: team.status === 'ACTIF' ? '#DCFCE7' : '#FEE2E2', color: team.status === 'ACTIF' ? '#15803D' : '#B91C1C' }}>
                    {team.status === 'ACTIF' ? 'Actif' : 'Suspendu'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="relative flex items-center justify-end gap-2">
                    <button onClick={() => openTeam(team, 'Joueurs')} className="text-sm font-medium hover:underline" style={{ color: '#1E7A3A' }}>
                      Voir
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => setOpenMenu(openMenu === team.id ? null : team.id)}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === team.id && (
                      <div className="absolute right-0 top-8 z-50 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5" onMouseLeave={() => setOpenMenu(null)}>
                        {MENU_ACTIONS.map((a) => (
                          <button
                            key={a.label}
                            onClick={() => openTeam(team, a.tab)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition"
                            style={{ color: a.color }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-gray-400 text-sm">
                  {!loaded
                    ? 'Chargement…'
                    : teams.length === 0
                    ? 'Aucune équipe pour le moment.'
                    : 'Aucune équipe dans cette catégorie.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
