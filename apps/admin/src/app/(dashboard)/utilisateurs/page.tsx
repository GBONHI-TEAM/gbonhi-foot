'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Users, Eye, X } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';

interface ApiUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string | null;
  city: string | null;
  position?: string | null;
  created_at: string | null;
  _count?: { team_members: number; reservations: number };
}

const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  super_admin: { label: 'Super Admin', bg: '#FEF3C7', color: '#B45309' },
  admin: { label: 'Admin', bg: '#FEF3C7', color: '#B45309' },
  partner: { label: 'Partenaire', bg: '#DBEAFE', color: '#1D4ED8' },
  partenaire: { label: 'Partenaire', bg: '#DBEAFE', color: '#1D4ED8' },
  player: { label: 'Joueur', bg: '#DCFCE7', color: '#15803D' },
  joueur: { label: 'Joueur', bg: '#DCFCE7', color: '#15803D' },
  captain: { label: 'Capitaine', bg: '#E0E7FF', color: '#4338CA' },
  user: { label: 'Utilisateur', bg: '#F3F4F6', color: '#6B7280' },
};

function roleMeta(role: string | null) {
  const key = (role ?? '').toLowerCase();
  return ROLE_META[key] ?? { label: role ?? 'Utilisateur', bg: '#F3F4F6', color: '#6B7280' };
}

// Groupes logiques (résolus côté backend). « Joueurs » = utilisateurs de l'app
// (hors admins et partenaires), qui sont dans leurs propres onglets.
const ROLE_FILTERS = [
  { label: 'Joueurs', value: 'players' },
  { label: 'Capitaines', value: 'captains' },
  { label: 'Partenaires', value: 'partners' },
  { label: 'Admins', value: 'admins' },
  { label: 'Tous', value: 'all' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function UtilisateursPage() {
  const [role, setRole] = useState('players');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cardUserId, setCardUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search.trim()) params.set('search', search.trim());
    const qs = params.toString();
    const t = setTimeout(() => {
      (async () => {
        try {
          const data = await apiFetch<ApiUser[]>(`/users${qs ? `?${qs}` : ''}`);
          if (!cancelled) setUsers(Array.isArray(data) ? data : []);
        } catch {
          if (!cancelled) setUsers([]);
        } finally {
          if (!cancelled) setLoaded(true);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [role, search]);

  const displayName = (u: ApiUser) => u.full_name?.trim() || u.username?.trim() || '—';
  const empty = useMemo(() => loaded && users.length === 0, [loaded, users]);
  const completedProfiles = useMemo(() => users.filter((user) => Boolean(user.position?.trim())).length, [users]);
  const completionRate = users.length ? Math.round((completedProfiles / users.length) * 100) : 0;

  return (
    <>
      <Header title="Gestion des Utilisateurs" />

      {/* Filtres */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-2.5 flex-wrap">
          {ROLE_FILTERS.map((f) => {
            const active = role === f.value;
            return (
              <button
                key={f.label}
                onClick={() => setRole(f.value)}
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

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="h-11 w-72 pl-9 pr-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-gray-500">
        <p><span className="font-bold text-gray-800">{users.length.toLocaleString('fr-FR')}</span> utilisateurs affichés</p>
        <p className="text-xs">Les filtres de rôle sont appliqués directement aux comptes.</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-[#1E7A3A] bg-white p-5 shadow-sm">
          <p className="text-3xl font-black text-gray-900">{users.length.toLocaleString('fr-FR')}</p>
          <p className="mt-1 font-bold text-gray-700">Comptes affichés</p>
          <p className="text-sm text-gray-400">Selon les filtres de la liste</p>
        </div>
        <div className="rounded-xl border border-gray-100 border-t-4 border-t-[#F7921E] bg-white p-5 shadow-sm">
          <p className="text-3xl font-black text-gray-900">{completedProfiles.toLocaleString('fr-FR')}</p>
          <p className="mt-1 font-bold text-gray-700">Fiches joueurs renseignées</p>
          <p className="text-sm text-gray-400">Poste indiqué dans le profil</p>
        </div>
      </div>
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
        <p className="shrink-0 text-sm font-semibold text-gray-700">Taux de complétion des fiches</p>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#F7921E]" style={{ width: `${completionRate}%` }} /></div>
        <p className="shrink-0 text-sm font-bold text-[#F7921E]">{completedProfiles} / {users.length} = {completionRate}%</p>
      </div>

      {empty ? (
        <EmptyState icon={Users} title="Aucun utilisateur pour le moment" message="Les comptes créés sur la plateforme apparaîtront ici." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Utilisateur', 'Rôle', 'Ville', 'Équipes', 'Réservations', 'Inscription', 'Fiche'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => {
                const meta = roleMeta(u.role);
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-black flex-shrink-0" style={{ backgroundColor: '#1E7A3A' }}>
                          {initials(displayName(u))}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-gray-900 block truncate">{displayName(u)}</span>
                          {u.username && <span className="text-xs text-gray-400">@{u.username}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{u.city?.trim() || '—'}</td>
                    <td className="px-5 py-4 text-gray-700">{u._count?.team_members ?? 0}</td>
                    <td className="px-5 py-4 text-gray-700">{u._count?.reservations ?? 0}</td>
                    <td className="px-5 py-4 text-gray-500">{fmtDate(u.created_at)}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setCardUserId(u.id)}
                        title="Voir la fiche joueur"
                        className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-semibold text-[#1E7A3A] hover:bg-emerald-50"
                      >
                        <Eye size={15} /> Voir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loaded && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">Chargement…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {cardUserId && <PlayerCardModal userId={cardUserId} onClose={() => setCardUserId(null)} />}
    </>
  );
}

interface PlayerCard {
  id: string;
  full_name: string | null;
  username: string | null;
  position: string | null;
  city: string | null;
  current_team?: { name: string } | null;
  player_profile?: {
    birth_date: string | null; height_cm: string | null; weight_kg: string | null;
    preferred_foot: string | null; secondary_position: string | null; level: string | null;
  } | null;
  statistics?: { matches_played: number; goals: number; assists: number; yellow_cards: number; red_cards: number } | null;
}

const FOOT_FR: Record<string, string> = { right: 'Droit', left: 'Gauche', both: 'Les deux', droit: 'Droit', gauche: 'Gauche' };

/** Modal lecture seule de la fiche joueur (données Supabase + stats). */
function PlayerCardModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<PlayerCard>(`/users/${userId}/card`);
        if (!cancelled) setCard(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const pp = card?.player_profile;
  const st = card?.statistics;
  const rows: [string, string][] = [
    ['Poste', card?.position || '—'],
    ['Poste secondaire', pp?.secondary_position || '—'],
    ['Pied fort', pp?.preferred_foot ? (FOOT_FR[pp.preferred_foot.toLowerCase()] ?? pp.preferred_foot) : '—'],
    ['Niveau', pp?.level || '—'],
    ['Taille', pp?.height_cm ? `${pp.height_cm} cm` : '—'],
    ['Poids', pp?.weight_kg ? `${pp.weight_kg} kg` : '—'],
    ['Ville', card?.city || '—'],
    ['Équipe', card?.current_team?.name || '—'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-black text-gray-900">Fiche joueur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Chargement…</p>
        ) : error || !card ? (
          <p className="py-10 text-center text-sm text-gray-400">Fiche indisponible.</p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-lg font-bold text-gray-900">{card.full_name || 'Joueur'}</p>
              {card.username && <p className="text-sm text-gray-400">@{card.username}</p>}
            </div>

            {st && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[['Matchs', st.matches_played], ['Buts', st.goals], ['Passes', st.assists]].map(([label, val]) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-black text-[#1E7A3A]">{val}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
                <div className="col-span-3 flex gap-3">
                  <span className="text-xs text-gray-500">🟨 {st.yellow_cards} jaune(s)</span>
                  <span className="text-xs text-gray-500">🟥 {st.red_cards} rouge(s)</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-semibold text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
