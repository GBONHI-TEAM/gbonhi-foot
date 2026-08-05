'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarDays, LineChart, Star } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

const FILTERS = ["Aujourd'hui", '7 jours', '30 jours', 'Ce mois', 'Période'] as const;
type PeriodFilter = (typeof FILTERS)[number];

interface OperationSeries { date: string; registrations: number; reservations: number; activity: number }
interface Overview {
  summary: { activeLeagues: number; teams: number; activeTerrains: number; usersCreated: number; matchesScheduled: number; reservations: number; confirmedReservations: number; reviewsCreated: number; openIncidents: number };
  series: OperationSeries[];
  recent: {
    reservations: { id: string; status: string; created_at: string; terrain: { name: string } | null; user: { full_name: string | null } | null }[];
    leagues: { id: string; name: string; created_at: string }[];
  };
}

const reservationMeta: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Réservation confirmée', color: '#1E7A3A' },
  completed: { label: 'Réservation terminée', color: '#2563EB' },
  pending: { label: 'Réservation en attente', color: '#F7921E' },
  cancelled: { label: 'Réservation annulée', color: '#DC2626' },
};

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function daysBefore(today: Date, days: number) { const date = new Date(today); date.setDate(date.getDate() - days); return date; }
function rangeFor(filter: PeriodFilter, customFrom: string, customTo: string) {
  const today = new Date();
  if (filter === "Aujourd'hui") return { from: isoDate(today), to: isoDate(today) };
  if (filter === '7 jours') return { from: isoDate(daysBefore(today, 6)), to: isoDate(today) };
  if (filter === '30 jours') return { from: isoDate(daysBefore(today, 29)), to: isoDate(today) };
  if (filter === 'Ce mois') return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
  return { from: customFrom, to: customTo };
}
function relative(iso: string) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-3xl font-black" style={{ color: accent ?? '#111827' }}>{value.toLocaleString('fr-FR')}</p></div>;
}

export default function DashboardPage() {
  const today = isoDate(new Date());
  const [activeFilter, setActiveFilter] = useState<PeriodFilter>("Aujourd'hui");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => rangeFor(activeFilter, customFrom, customTo), [activeFilter, customFrom, customTo]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    void apiFetch<Overview>(`/analytics/operations-overview?from=${range.from}&to=${range.to}`)
      .then((result) => { if (!cancelled) setOverview(result); })
      .catch(() => { if (!cancelled) { setOverview(null); setError('Les indicateurs sont momentanément indisponibles. Réessaie dans quelques instants.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const summary = overview?.summary;
  const maxActivity = Math.max(1, ...(overview?.series.map((row) => row.activity + row.registrations + row.reservations) ?? [1]));
  const recentItems = [
    ...(overview?.recent.reservations ?? []).map((reservation) => {
      const meta = reservationMeta[reservation.status.toLowerCase()] ?? { label: 'Réservation', color: '#6B7280' };
      return { id: `reservation-${reservation.id}`, text: `${meta.label}${reservation.terrain?.name ? ` · ${reservation.terrain.name}` : ''}${reservation.user?.full_name ? ` (${reservation.user.full_name})` : ''}`, color: meta.color, at: reservation.created_at };
    }),
    ...(overview?.recent.leagues ?? []).map((league) => ({ id: `league-${league.id}`, text: `Ligue « ${league.name} » créée`, color: '#2563EB', at: league.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);

  return <>
    <Header title="Dashboard Opérations" />
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {FILTERS.map((label) => <button key={label} onClick={() => setActiveFilter(label)} className="rounded-full border px-4 py-1.5 text-sm font-medium transition" style={{ backgroundColor: activeFilter === label ? '#1E7A3A' : 'white', color: activeFilter === label ? 'white' : '#374151', borderColor: activeFilter === label ? '#1E7A3A' : '#E5E7EB' }}>{label}</button>)}
      {activeFilter === 'Période' && <div className="ml-1 flex flex-wrap items-center gap-2 text-sm"><input aria-label="Début de période" type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="h-9 rounded-lg border border-gray-200 px-2" /><span className="text-gray-400">au</span><input aria-label="Fin de période" type="date" value={customTo} min={customFrom} max={today} onChange={(event) => setCustomTo(event.target.value)} className="h-9 rounded-lg border border-gray-200 px-2" /></div>}
    </div>
    {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"><KpiCard label="Ligues actives" value={summary?.activeLeagues ?? 0} /><KpiCard label="Équipes inscrites" value={summary?.teams ?? 0} /><KpiCard label="Matchs sur la période" value={summary?.matchesScheduled ?? 0} /><KpiCard label="Nouveaux utilisateurs" value={summary?.usersCreated ?? 0} /><KpiCard label="Terrains actifs" value={summary?.activeTerrains ?? 0} /></div>
    <div className="mb-8 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Réservations" value={summary?.reservations ?? 0} accent="#1E7A3A" /><KpiCard label="Réservations confirmées" value={summary?.confirmedReservations ?? 0} accent="#2563EB" /><KpiCard label="Incidents ouverts" value={summary?.openIncidents ?? 0} accent={(summary?.openIncidents ?? 0) > 0 ? '#DC2626' : '#111827'} /><KpiCard label="Avis reçus" value={summary?.reviewsCreated ?? 0} accent="#B45309" /></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3"><section className="lg:col-span-2 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-gray-900">Activité de la plateforme</h2><p className="text-xs text-gray-400">Connexions et actions enregistrées, inscriptions et réservations.</p></div><LineChart size={20} className="text-primary" /></div>{loading ? <div className="flex h-56 items-center justify-center text-sm text-gray-400">Chargement des données…</div> : (overview?.series.length ?? 0) === 0 ? <div className="flex h-56 flex-col items-center justify-center text-center"><Activity size={26} className="mb-2 text-gray-300" /><p className="text-sm text-gray-400">Aucune activité sur cette période.</p></div> : <div className="flex h-56 items-end gap-1.5">{overview?.series.map((row) => { const value = row.activity + row.registrations + row.reservations; const height = Math.max(value > 0 ? 8 : 2, Math.round((value / maxActivity) * 100)); return <div key={row.date} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${row.date} · ${value} actions`}><div className="rounded-t bg-primary transition group-hover:bg-primaryMedium" style={{ height: `${height}%` }} /><span className="mt-1 truncate text-center text-[9px] text-gray-400">{row.date.slice(8)}</span></div>; })}</div>}</section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="mb-4 font-bold text-gray-900">Activité récente</h2>{loading ? <p className="py-10 text-center text-sm text-gray-400">Chargement…</p> : recentItems.length === 0 ? <div className="flex flex-col items-center py-10 text-center"><CalendarDays size={24} className="mb-2 text-gray-300" /><p className="text-sm text-gray-400">Aucune activité récente.</p></div> : <ul className="space-y-4">{recentItems.map((item) => <li key={item.id} className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><div className="min-w-0"><p className="text-sm text-gray-800">{item.text}</p><p className="mt-0.5 text-xs text-gray-400">{relative(item.at)}</p></div></li>)}</ul>}</section></div>
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500"><span className="inline-flex items-center gap-1.5"><AlertTriangle size={13} className="text-red-600" />Les incidents ouverts proviennent des signalements non résolus.</span><span className="inline-flex items-center gap-1.5"><Star size={13} className="text-amber-600" />Les avis sont comptés sur la période sélectionnée.</span></div>
  </>;
}
