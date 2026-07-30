'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Download, ChevronLeft, ChevronRight, Trash2, FileDown, BarChart3 } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { ApiReservation, ApiReservationStats, fcfa } from '../../../lib/domain';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export default function RevenusPage() {
  const [stats, setStats] = useState<ApiReservationStats | null>(null);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, resas] = await Promise.all([
          apiFetch<ApiReservationStats>('/reservations/stats/summary'),
          apiFetch<ApiReservation[]>('/reservations'),
        ]);
        if (cancelled) return;
        setStats(s);
        if (Array.isArray(resas)) setReservations(resas);
      } catch {
        /* état vide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const moisLabel = MOIS[now.getMonth()].charAt(0).toUpperCase() + MOIS[now.getMonth()].slice(1);
  const annee = now.getFullYear();

  // Détail du mois courant à partir des réservations réelles.
  const moisResas = useMemo(
    () =>
      reservations.filter((r) => {
        const d = new Date(r.reservation_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.status !== 'cancelled';
      }),
    [reservations, now]
  );

  // Répartition cohérente dérivée des réservations réelles du mois :
  // total encaissé = net reversé (partner_amount) + commission (platform_fee).
  const caTerrain = moisResas.reduce((sum, r) => sum + r.total_price, 0);
  const reverse = moisResas.reduce((sum, r) => sum + r.partner_amount, 0);
  const commission = moisResas.reduce((sum, r) => sum + r.platform_fee, 0);
  const nbResa = moisResas.length;

  // Le KPI « CA du mois » vient du summary (source canonique) ; fallback = somme des réservations.
  const caMois = stats ? fcfa(stats.month_revenue) : fcfa(caTerrain);
  const weekRevenue = stats ? fcfa(stats.week_revenue) : '—';

  return (
    <>
      <Header title="Revenus & Finances" subtitle={`${moisLabel} ${annee}`} />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Stepper label={moisLabel} />
          <Stepper label={String(annee)} />
          <span className="inline-flex items-center gap-2 text-[12px] text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
            {moisLabel} {annee}
            <Trash2 size={13} className="text-gray-400" />
          </span>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border" style={{ color: '#1E7A3A', borderColor: '#1E7A3A' }}>
          <Download size={14} /> Exporter CSV
        </button>
      </div>

      {/* Bannière CA cumulé */}
      <div className="rounded-xl p-5 mb-4 border flex items-center justify-between gap-6" style={{ backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }}>
        <div>
          <p className="text-[12px] text-gray-500">Chiffre d&apos;affaires du mois — {moisLabel} {annee}</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">{stats ? stats.month_revenue.toLocaleString('fr-FR') : caTerrain.toLocaleString('fr-FR')} <span className="text-[14px] font-medium text-gray-400">FCFA</span></p>
          <p className="text-[12px] text-gray-600 mt-1">
            Revenu de la semaine : <span className="font-semibold">{weekRevenue}</span> · Net reversé : <span className="font-semibold">{fcfa(reverse)}</span> · Commission : <span className="font-semibold">{fcfa(commission)}</span>
          </p>
        </div>
      </div>

      {/* Card CA généré */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#1A3D2B' }}>
        <p className="text-[12px] text-white/60">Chiffre d&apos;affaires généré · {moisLabel} {annee}</p>
        <p className="text-[28px] font-black text-white leading-tight">{caMois}</p>
        <p className="text-[12px] text-white/60 mt-1 max-w-2xl">
          Comprend les revenus des réservations terrain réglées via l&apos;application GBONHI FOOT. La commission GBONHI FOOT est déjà déduite du montant reversé.
        </p>
      </div>

      {/* 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[12px] text-gray-500 mb-1">CA Réservations terrain</p>
          <p className="text-[20px] font-black" style={{ color: '#F7921E' }}>{caTerrain.toLocaleString('fr-FR')} <span className="text-[12px] font-medium text-gray-400">FCFA</span></p>
          <p className="text-[11px] text-gray-400 mt-1">{nbResa} réservation{nbResa > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[12px] text-gray-500 mb-1">Montant net reversé</p>
          <p className="text-[20px] font-black" style={{ color: '#1E7A3A' }}>{reverse.toLocaleString('fr-FR')} <span className="text-[12px] font-medium text-gray-400">FCFA</span></p>
          <p className="text-[11px] text-gray-400 mt-1">après commission GBONHI FOOT</p>
        </div>
      </div>

      {/* Graphique + récap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-[14px]">Revenus par jour</h2>
          </div>
          <div className="h-56 flex flex-col items-center justify-center text-center">
            <BarChart3 size={28} className="text-gray-300 mb-3" />
            <p className="text-[13px] font-medium text-gray-500">Détail par jour bientôt disponible</p>
            <p className="text-[12px] text-gray-400 mt-1 max-w-xs">La répartition quotidienne des revenus s&apos;affichera dès que l&apos;historique sera collecté.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 text-[14px] mb-4">Récapitulatif</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-gray-600">Montant reversé</span>
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>{fcfa(reverse)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-[13px] text-gray-600">Réservations</span>
              <span className="text-[13px] font-bold text-gray-900">{nbResa}</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-[13px] text-gray-600">Revenu semaine</span>
              <span className="text-[13px] font-bold text-gray-900">{stats ? fcfa(stats.week_revenue) : '—'}</span>
            </div>
          </div>
          <button className="w-full mt-5 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">
            <FileDown size={14} /> Télécharger le relevé PDF
          </button>
        </div>
      </div>
    </>
  );
}

function Stepper({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-medium text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 bg-white">
      <ChevronLeft size={13} className="text-gray-400" />
      {label}
      <ChevronRight size={13} className="text-gray-400" />
    </span>
  );
}
