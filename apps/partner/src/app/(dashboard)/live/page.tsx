'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Check, Heart, Clock, Info } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import {
  ApiReservation,
  ApiReservationStats,
  STATUS_FR,
  fcfa,
  todayISO,
} from '../../../lib/domain';

const RESA_BADGE: Record<string, { bg: string; color: string; icon?: React.ReactNode }> = {
  Terminée: { bg: '#D1FAE5', color: '#065F46', icon: <Check size={12} /> },
  Confirmée: { bg: '#DBEAFE', color: '#1D4ED8', icon: <Clock size={12} /> },
  'En attente': { bg: '#FEF3C7', color: '#92400E', icon: <Clock size={12} /> },
  'En cours': { bg: '#FEE2E2', color: '#B91C1C', icon: <Heart size={12} /> },
  Annulée: { bg: '#FEE2E2', color: '#B91C1C' },
  Libre: { bg: '#F3F4F6', color: '#6B7280' },
};

interface ResaRow {
  heure: string;
  client: string;
  montant: string;
  statut: string;
}

export default function LivePage() {
  const [stats, setStats] = useState<ApiReservationStats | null>(null);
  const [resas, setResas] = useState<ResaRow[]>([]);
  const [totalCreneaux, setTotalCreneaux] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, terrains, today] = await Promise.all([
          apiFetch<ApiReservationStats>('/reservations/stats/summary'),
          apiFetch<{ slots?: { day_of_week: number; is_active: boolean }[] }[]>('/terrains/mine'),
          apiFetch<ApiReservation[]>(`/reservations?date=${todayISO()}`),
        ]);
        if (cancelled) return;
        setStats(s);
        if (Array.isArray(terrains) && terrains.length > 0) {
          const day = (new Date().getDay() + 6) % 7; // 0 = lundi
          const count = (terrains[0].slots ?? []).filter((sl) => sl.day_of_week === day && sl.is_active).length;
          setTotalCreneaux(count);
        }
        if (Array.isArray(today)) {
          setResas(
            today
              .slice()
              .sort((a, b) => a.start_hour - b.start_hour)
              .map((r) => ({
                heure: `${String(r.start_hour).padStart(2, '0')}h00`,
                client: r.user?.full_name ?? 'Client',
                montant: fcfa(r.total_price),
                statut: STATUS_FR[r.status],
              }))
          );
        }
      } catch {
        /* état vide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const caJour = stats ? fcfa(stats.today_revenue) : '—';
  const nbResa = stats ? stats.today_count : resas.length;
  const taux = stats ? `${Math.round(stats.occupancy_rate)}%` : '—';
  const majHeure = useMemo(
    () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    []
  );
  const dateLongue = useMemo(() => {
    const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, []);

  return (
    <>
      <Header title="Live" subtitle="Vue temps réel du jour" />

      {/* Statut live */}
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold text-white" style={{ backgroundColor: '#EF4444' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN DIRECT
        </span>
        <span className="text-[12px] text-gray-500">Mis à jour à {majHeure} · {dateLongue}</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4 shadow-sm" style={{ backgroundColor: '#1A3D2B' }}>
          <p className="text-white/60 text-[12px] mb-1">CA aujourd&apos;hui</p>
          <p className="text-[22px] font-black text-white">{stats ? stats.today_revenue.toLocaleString('fr-FR') : '—'} <span className="text-[13px] font-medium text-white/70">FCFA</span></p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-[12px] mb-1">Réservations</p>
          <p className="text-[22px] font-black text-gray-900">{nbResa} <span className="text-[13px] font-medium text-gray-400">{totalCreneaux > 0 ? `/ ${totalCreneaux} créneaux` : ''}</span></p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-gray-500 text-[12px] mb-1">Taux d&apos;occupation</p>
          <p className="text-[22px] font-black text-gray-900">{taux}</p>
        </div>
      </div>

      {/* Réservations du jour */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-[14px]">Réservations du jour</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: '#1E7A3A' }}>
                {['Heure', 'Client', 'Montant', 'Statut'].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-[11px] font-semibold text-white uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resas.map((r, i) => {
                const badge = RESA_BADGE[r.statut] ?? { bg: '#F3F4F6', color: '#6B7280' };
                return (
                  <tr key={`${r.heure}-${i}`}>
                    <td className="px-5 py-3 text-[13px] font-bold text-gray-700">{r.heure}</td>
                    <td className="px-5 py-3 text-[13px] font-medium text-gray-900">{r.client}</td>
                    <td className="px-5 py-3 text-[13px] text-gray-600">{r.montant}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                        {badge.icon} {r.statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {resas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-gray-400 text-sm">
                    Aucune réservation aujourd&apos;hui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-1.5 px-5 py-3 border-t border-gray-100">
          <Info size={13} className="text-gray-400" />
          <p className="text-[12px] text-gray-400">Cette vue reflète les réservations du jour. Aucune action requise.</p>
        </div>
      </div>
    </>
  );
}
