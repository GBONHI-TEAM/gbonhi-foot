'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
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

const ROLE_FILTERS = [
  { label: 'Tous', value: '' },
  { label: 'Joueurs', value: 'player' },
  { label: 'Capitaines', value: 'captain' },
  { label: 'Partenaires', value: 'partner' },
  { label: 'Admins', value: 'admin' },
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
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loaded, setLoaded] = useState(false);

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

      {empty ? (
        <EmptyState icon={Users} title="Aucun utilisateur pour le moment" message="Les comptes créés sur la plateforme apparaîtront ici." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Utilisateur', 'Rôle', 'Ville', 'Équipes', 'Réservations', 'Inscription'].map((h) => (
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
                  </tr>
                );
              })}
              {!loaded && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400 text-sm">Chargement…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
