'use client';
import { useEffect, useMemo, useState } from 'react';
import { Activity, LineChart } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

const FILTERS = ["Aujourd'hui", '7 jours', '30 jours', 'Ce mois', 'Période'];

interface League {
  id: string;
  name: string;
  status: string;
  created_at?: string | null;
  _count?: { teams: number; matches: number };
}
interface Team {
  id: string;
}
interface Terrain {
  id: string;
  is_active?: boolean;
}
interface Reservation {
  id: string;
  reservation_date?: string | null;
  start_hour?: number | null;
  status?: string | null;
  terrain?: { name?: string | null } | null;
  user?: { full_name?: string | null } | null;
}
interface AdminUser {
  id: string;
}

const ACTIVE_STATUSES = ['INSCRIPTIONS_OUVERTES', 'INSCRIPTIONS_CLOSES', 'EN_COURS'];

const RESERVATION_STATUS_META: Record<string, { label: string; dot: string }> = {
  CONFIRMED: { label: 'Réservation confirmée', dot: '#1E7A3A' },
  CONFIRMEE: { label: 'Réservation confirmée', dot: '#1E7A3A' },
  PENDING: { label: 'Réservation en attente', dot: '#F7921E' },
  EN_ATTENTE: { label: 'Réservation en attente', dot: '#F7921E' },
  CANCELLED: { label: 'Réservation annulée', dot: '#DC2626' },
  ANNULEE: { label: 'Réservation annulée', dot: '#DC2626' },
};

interface ActivityItem {
  key: string;
  dot: string;
  text: string;
  when: string;
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} j`;
}

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [leaguesActive, setLeaguesActive] = useState<number | null>(null);
  const [teamsCount, setTeamsCount] = useState<number | null>(null);
  const [matchsCount, setMatchsCount] = useState<number | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [terrainsCount, setTerrainsCount] = useState<number | null>(null);
  const [reservationsCount, setReservationsCount] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [leagues, teams, users, terrains, reservations] = await Promise.all([
        apiFetch<League[]>('/leagues').catch(() => [] as League[]),
        apiFetch<Team[]>('/teams').catch(() => [] as Team[]),
        apiFetch<AdminUser[]>('/users').catch(() => [] as AdminUser[]),
        apiFetch<Terrain[]>('/terrains').catch(() => [] as Terrain[]),
        apiFetch<Reservation[]>('/reservations/all').catch(() => [] as Reservation[]),
      ]);
      if (cancelled) return;

      setLeaguesActive(leagues.filter((l) => ACTIVE_STATUSES.includes(l.status)).length);
      setTeamsCount(teams.length);
      setMatchsCount(leagues.reduce((acc, l) => acc + (l._count?.matches ?? 0), 0));
      setUsersCount(users.length);
      setTerrainsCount(terrains.filter((t) => t.is_active !== false).length);
      setReservationsCount(reservations.length);

      // Activité récente dérivée d'éléments réels (réservations + dernières ligues).
      const items: ActivityItem[] = [];
      for (const r of reservations.slice(0, 6)) {
        const meta = RESERVATION_STATUS_META[(r.status ?? '').toUpperCase()] ?? {
          label: 'Réservation',
          dot: '#6B7280',
        };
        const who = r.user?.full_name?.trim();
        const where = r.terrain?.name?.trim();
        items.push({
          key: `res-${r.id}`,
          dot: meta.dot,
          text: `${meta.label}${where ? ` · ${where}` : ''}${who ? ` (${who})` : ''}`,
          when: fmtRelative(r.reservation_date),
        });
      }
      const recentLeagues = [...leagues]
        .filter((l) => l.created_at)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .slice(0, 3);
      for (const l of recentLeagues) {
        items.push({
          key: `league-${l.id}`,
          dot: '#2563EB',
          text: `Ligue « ${l.name} » créée`,
          when: fmtRelative(l.created_at),
        });
      }
      setActivity(items.slice(0, 6));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (v: number | null) => (v == null ? '—' : v.toLocaleString('fr-FR'));

  // KPIs réels calculés à partir de l'API.
  const REAL_KPIS = [
    { label: 'Ligues actives', value: fmt(leaguesActive) },
    { label: 'Équipes inscrites', value: fmt(teamsCount) },
    { label: 'Matchs programmés', value: fmt(matchsCount) },
    { label: 'Utilisateurs', value: fmt(usersCount) },
    { label: 'Terrains actifs', value: fmt(terrainsCount) },
  ];

  // KPIs sans source de données réelle → affichés à 0 (jamais de valeur inventée).
  const ZERO_KPIS = useMemo(
    () => [
      { label: 'Réservations', value: fmt(reservationsCount), color: '#111827' },
      { label: 'Sessions actives', value: '0', color: '#9CA3AF' },
      { label: 'Incidents ouverts', value: '0', color: '#9CA3AF' },
      { label: 'Avis en attente', value: '0', color: '#9CA3AF' },
    ],
    [reservationsCount],
  );

  return (
    <>
      <Header title="Dashboard Opérations" />

      {/* Filtres période */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTERS.map((label) => {
          const active = activeFilter === label;
          return (
            <button
              key={label}
              onClick={() => setActiveFilter(label)}
              className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
              style={{
                backgroundColor: active ? '#1E7A3A' : 'white',
                color: active ? 'white' : '#374151',
                borderColor: active ? '#1E7A3A' : '#E5E7EB',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* KPI — données réelles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {REAL_KPIS.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">{label}</p>
            <p className="text-3xl font-black mt-1 text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* KPI — modules sans données pour le moment (0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {ZERO_KPIS.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">{label}</p>
            <p className="text-3xl font-black mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Graphe (pas de source temporelle) + Activité récente réelle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Activité de la plateforme · 30 jours</h2>
          <div className="h-56 flex flex-col items-center justify-center text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}
            >
              <LineChart size={26} strokeWidth={1.8} />
            </div>
            <p className="text-sm font-bold text-gray-900">Pas encore de données</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Les courbes s&apos;afficheront dès que l&apos;activité de la plateforme sera enregistrée.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-900 mb-4">Activité récente</h2>
          {activity.length > 0 ? (
            <ul className="space-y-4">
              {activity.map((a) => (
                <li key={a.key} className="flex gap-3">
                  <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: a.dot }} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800">{a.text}</p>
                    {a.when && <p className="text-xs text-gray-400 mt-0.5">{a.when}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <Activity size={24} className="text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">{loaded ? 'Aucune activité pour le moment' : 'Chargement…'}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
