'use client';
import { useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Wallet, CalendarCheck, TrendingUp, Gauge, LineChart, Star } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useCurrentUser } from '../../../lib/use-user';
import {
  ApiReservation,
  ApiReservationStats,
  ApiTerrain,
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

export default function PartnerDashboardPage() {
  const user = useCurrentUser();
  const [stats, setStats] = useState<ApiReservationStats | null>(null);
  const [terrain, setTerrain] = useState<ApiTerrain | null>(null);
  const [resaJour, setResaJour] = useState<ResaJour[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, terrains, resas] = await Promise.all([
          apiFetch<ApiReservationStats>('/reservations/stats/summary'),
          apiFetch<ApiTerrain[]>('/terrains/mine'),
          apiFetch<ApiReservation[]>(`/reservations?date=${todayISO()}`),
        ]);
        if (cancelled) return;
        setStats(s);
        if (Array.isArray(terrains) && terrains.length > 0) setTerrain(terrains[0]);
        if (Array.isArray(resas)) {
          setResaJour(
            resas
              .slice()
              .sort((a, b) => a.start_hour - b.start_hour)
              .map((r) => ({
                heure: `${String(r.start_hour).padStart(2, '0')}h00`,
                client: r.user?.full_name ?? 'Client',
                detail: `Terrain · ${fcfa(r.total_price)}`,
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
  }, []);

  const nomUser = displayName(user);
  const nomTerrain = terrain?.name ?? '';
  const dateLongue = dateLongueFR();
  const sousTitre = nomTerrain ? `${nomTerrain} · ${dateLongue}` : dateLongue;

  const revenuMois = stats ? fcfa(stats.month_revenue) : '—';
  const revenuSemaine = stats ? fcfa(stats.week_revenue) : '—';
  const resaAujourdhui = stats ? String(stats.today_count) : '—';
  const tauxOccupation = stats ? `${Math.round(stats.occupancy_rate)}%` : '—';
  const caJour = stats ? fcfa(stats.today_revenue) : '—';
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
              {nbResaJour} réservation{nbResaJour > 1 ? 's' : ''} aujourd&apos;hui · CA du jour : <span className="font-semibold" style={{ color: '#1E7A3A' }}>{caJour}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Wallet size={16} />} iconColor="#1E7A3A" label="Revenu du mois" value={revenuMois} />
        <KpiCard icon={<TrendingUp size={16} />} iconColor="#1E7A3A" label="Revenu de la semaine" value={revenuSemaine} />
        <KpiCard icon={<CalendarCheck size={16} />} iconColor="#F7921E" label="Réservations aujourd'hui" value={resaAujourdhui} sub="terrain" />
        <KpiCard icon={<Gauge size={16} />} iconColor="#1E7A3A" label="Taux d'occupation" value={tauxOccupation} sub="ce mois" />
      </div>

      {/* Historique (pas encore d'endpoint) + réservations du jour */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Revenus — 30 derniers jours</h2>
          <div className="h-52 flex flex-col items-center justify-center text-center">
            <LineChart size={28} className="text-gray-300 mb-3" />
            <p className="text-[13px] font-medium text-gray-500">Historique bientôt disponible</p>
            <p className="text-[12px] text-gray-400 mt-1 max-w-xs">La courbe des revenus s&apos;affichera dès que l&apos;historique quotidien sera collecté.</p>
          </div>
        </div>

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

      {/* Derniers avis — pas d'endpoint : état vide propre */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Derniers avis</h2>
        <div className="flex flex-col items-center justify-center text-center py-8">
          <Star size={28} className="text-gray-300 mb-3" />
          <p className="text-[13px] font-medium text-gray-500">Aucun avis pour le moment</p>
          <p className="text-[12px] text-gray-400 mt-1">Les avis laissés par vos clients apparaîtront ici.</p>
        </div>
      </div>
    </>
  );
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
