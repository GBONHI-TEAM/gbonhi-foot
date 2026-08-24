'use client';
import { useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Wallet, CalendarCheck, TrendingUp, Gauge, LineChart, Star, ListChecks } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useCurrentUser } from '../../../lib/use-user';
import { usePartnerAccess } from '../../../components/auth/partner-access-provider';
import { useTerrain } from '../../../lib/terrain-context';
import {
  ApiReservation,
  ApiReservationStats,
  ApiOperationalStats,
  STATUS_FR,
  STATUS_BADGE_FR,
  displayName,
  fcfa,
  todayISO,
  dateLongueFR,
} from '../../../lib/domain';

interface ResaJour {
  heure: string;
  client: string;
  detail: string;
  statut: string;
}

interface RevenuePoint { date: string; amount: number }
interface PartnerReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  terrain: { id: string; name: string };
  user: { id: string; full_name: string | null; avatar_url: string | null };
}

export default function PartnerDashboardPage() {
  const user = useCurrentUser();
  const { isOwner, loading: accessLoading } = usePartnerAccess();
  const { selectedTerrain: terrain } = useTerrain();
  const [stats, setStats] = useState<ApiReservationStats | ApiOperationalStats | null>(null);
  const [resaJour, setResaJour] = useState<ResaJour[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenuePoint[]>([]);
  const [latestReviews, setLatestReviews] = useState<PartnerReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (accessLoading) return;
    (async () => {
      try {
        const [s, resas, history, reviews] = await Promise.all([
          isOwner
            ? apiFetch<ApiReservationStats>('/reservations/stats/summary')
            : apiFetch<ApiOperationalStats>('/reservations/stats/operational-summary'),
          apiFetch<ApiReservation[]>(`/reservations?date=${todayISO()}`),
          isOwner ? apiFetch<RevenuePoint[]>('/reservations/stats/revenue-history') : Promise.resolve([] as RevenuePoint[]),
          apiFetch<PartnerReview[]>('/terrains/mine/reviews'),
        ]);
        if (cancelled) return;
        setStats(s);
        setRevenueHistory(Array.isArray(history) ? history : []);
        setLatestReviews(Array.isArray(reviews) ? reviews : []);
        if (Array.isArray(resas)) {
          setResaJour(
            resas
              .slice()
              .sort((a, b) => a.start_hour - b.start_hour)
              .map((r) => ({
                heure: `${String(r.start_hour).padStart(2, '0')}h00`,
                client: r.user?.full_name ?? 'Client',
                detail: isOwner && typeof r.total_price === 'number' ? `Terrain · ${fcfa(r.total_price)}` : 'Terrain',
                statut: STATUS_FR[r.status],
              }))
          );
        }
      } catch {
        /* état vide — aucune donnée fictive */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessLoading, isOwner]);

  const nomUser = displayName(user);
  const nomTerrain = terrain?.name ?? '';
  const dateLongue = dateLongueFR();
  const sousTitre = nomTerrain ? `${nomTerrain} · ${dateLongue}` : dateLongue;

  const financialStats = isOwner ? stats as ApiReservationStats | null : null;
  const revenuMois = financialStats ? fcfa(financialStats.month_revenue) : '—';
  const revenuSemaine = financialStats ? fcfa(financialStats.week_revenue) : '—';
  const resaAujourdhui = stats ? String(stats.today_count) : '—';
  const tauxOccupation = stats ? `${Math.round(stats.occupancy_rate)}%` : '—';
  const caJour = financialStats ? fcfa(financialStats.today_revenue) : '—';
  const occupWidth = stats ? `${Math.round(stats.occupancy_rate)}%` : '0%';
  const nbResaJour = stats ? stats.today_count : 0;

  return (
    <>
      <Header
        title={nomUser ? `Bonjour, ${nomUser} 👋` : 'Bonjour 👋'}
        subtitle={sousTitre}
      />

      {/* Bannière Terrain du jour */}
      <div
        className="rounded-2xl p-5 mb-6 border"
        style={{ backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1E7A3A' }}>
            <span className="text-xl">🏟️</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-[15px]">
              {nomTerrain ? `${nomTerrain} · ` : ''}Aujourd&apos;hui, {dateLongue}
            </p>
            <p className="text-[13px] text-gray-600 mt-0.5">
              {nbResaJour} réservation{nbResaJour > 1 ? 's' : ''} aujourd&apos;hui{isOwner ? <> · CA du jour : <span className="font-semibold" style={{ color: '#1E7A3A' }}>{caJour}</span></> : ''}
            </p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12px] text-gray-500 mb-1">
                <span>Taux d&apos;occupation du jour</span>
                <span className="font-semibold text-gray-700">{tauxOccupation}</span>
              </div>
              <div className="h-2 rounded-full bg-white overflow-hidden">
                <div className="h-full rounded-full" style={{ width: occupWidth, backgroundColor: '#1E7A3A' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI réels */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${isOwner ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 mb-6`}>
        {isOwner && <><KpiCard icon={<Wallet size={16} />} iconColor="#1E7A3A" label="Revenu du mois" value={revenuMois} />
        <KpiCard icon={<TrendingUp size={16} />} iconColor="#1E7A3A" label="Revenu de la semaine" value={revenuSemaine} /></>}
        <KpiCard icon={<CalendarCheck size={16} />} iconColor="#F7921E" label="Réservations aujourd'hui" value={resaAujourdhui} sub="terrain" />
        <KpiCard icon={<Gauge size={16} />} iconColor="#1E7A3A" label="Taux d'occupation" value={tauxOccupation} sub="ce mois" />
        {!isOwner && <KpiCard icon={<ListChecks size={16} />} iconColor="#1E7A3A" label="Réservations cumulées" value={stats ? String(stats.total_reservations) : '—'} sub="accès gérant" />}
      </div>

      {/* Historique réel des revenus (propriétaire) + réservations du jour */}
      <div className={`grid grid-cols-1 ${isOwner ? 'lg:grid-cols-2' : ''} gap-6 mb-6`}>
        {isOwner && <RevenueHistoryCard points={revenueHistory} />}

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Réservations du jour</h2>
          <div className="divide-y divide-gray-100">
            {resaJour.length === 0 && (
              <p className="py-6 text-center text-[13px] text-gray-400">Aucune réservation aujourd&apos;hui.</p>
            )}
            {resaJour.map((r, i) => {
              const badge = STATUS_BADGE_FR[r.statut] ?? { bg: '#F3F4F6', color: '#6B7280' };
              return (
                <div key={`${r.heure}-${i}`} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-gray-700 w-12">{r.heure}</span>
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">{r.client}</p>
                      <p className="text-[12px] text-gray-400">{r.detail}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                    {r.statut}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Derniers avis réellement laissés par les clients */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Derniers avis</h2>
        {latestReviews.length === 0 ? <div className="flex flex-col items-center justify-center text-center py-8"><Star size={28} className="text-gray-300 mb-3" /><p className="text-[13px] font-medium text-gray-500">Aucun avis pour le moment</p><p className="text-[12px] text-gray-400 mt-1">Les avis laissés par vos clients apparaîtront ici.</p></div> : <div className="divide-y divide-gray-100">{latestReviews.map((review) => <div key={review.id} className="py-3 first:pt-0 last:pb-0"><div className="flex items-center justify-between gap-3"><div><p className="text-[13px] font-semibold text-gray-900">{review.user.full_name?.trim() || 'Client GBONHI FOOT'}</p><p className="text-[11px] text-gray-400">{review.terrain.name}</p></div><span className="whitespace-nowrap text-sm font-bold text-amber-500">{'★'.repeat(review.rating)}<span className="text-gray-200">{'★'.repeat(5 - review.rating)}</span></span></div>{review.comment && <p className="mt-1.5 text-[13px] text-gray-600">{review.comment}</p>}</div>)}</div>}
      </div>
    </>
  );
}

function RevenueHistoryCard({ points }: { points: RevenuePoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.amount));
  const total = points.reduce((sum, point) => sum + point.amount, 0);
  return <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-gray-900 text-[14px]">Revenus — 30 derniers jours</h2><p className="text-[12px] text-gray-400">Montants nets reversables</p></div><LineChart size={18} className="text-primary" /></div>{points.length === 0 ? <p className="py-14 text-center text-[13px] text-gray-400">Aucun revenu sur cette période.</p> : <><div className="flex h-36 items-end gap-1">{points.map((point) => <div key={point.date} title={`${point.date} · ${fcfa(point.amount)}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end"><div className="rounded-t bg-primary transition-colors group-hover:bg-primaryMedium" style={{ height: `${Math.max(point.amount > 0 ? 5 : 1, Math.round((point.amount / max) * 100))}%` }} /></div>)}</div><div className="mt-3 flex items-center justify-between text-[12px] text-gray-400"><span>{points[0]?.date.slice(8)} {new Date(`${points[0]?.date}T00:00:00`).toLocaleDateString('fr-FR', { month: 'short' })}</span><span className="font-semibold text-primary">{fcfa(total)}</span><span>{points.at(-1)?.date.slice(8)} {new Date(`${points.at(-1)?.date}T00:00:00`).toLocaleDateString('fr-FR', { month: 'short' })}</span></div></>}</div>;
}

function KpiCard({ icon, iconColor, label, value, sub }: {
  icon: React.ReactNode; iconColor: string; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-gray-500 text-[12px]">{label}</p>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <p className="text-[22px] font-black text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-2">{sub}</p>}
    </div>
  );
}
