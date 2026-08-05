'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../../components/layout/header';
import { Download, ChevronLeft, ChevronRight, Trash2, FileDown, Sheet } from 'lucide-react';
import { apiDownload, apiFetch } from '../../../lib/api';
import { usePartnerAccess } from '../../../components/auth/partner-access-provider';
import { ApiReservation, ApiReservationStats, fcfa } from '../../../lib/domain';
import { createXlsxBlob } from '../../../lib/xlsx-export';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

interface RevenueHistoryPoint {
  date: string;
  amount: number;
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function RevenusPage() {
  const searchParams = useSearchParams();
  const { isOwner, loading: accessLoading } = usePartnerAccess();
  const [stats, setStats] = useState<ApiReservationStats | null>(null);
  const [reservations, setReservations] = useState<ApiReservation[]>([]);
  const [history, setHistory] = useState<RevenueHistoryPoint[]>([]);
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (accessLoading || !isOwner) return;
    (async () => {
      try {
        const [s, resas, revenueHistory] = await Promise.all([
          apiFetch<ApiReservationStats>('/reservations/stats/summary'),
          apiFetch<ApiReservation[]>('/reservations'),
          apiFetch<RevenueHistoryPoint[]>('/reservations/stats/revenue-history'),
        ]);
        if (cancelled) return;
        setStats(s);
        if (Array.isArray(resas)) setReservations(resas);
        if (Array.isArray(revenueHistory)) setHistory(revenueHistory);
      } catch {
        /* état vide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessLoading, isOwner, searchParams]);

  const now = new Date();
  const moisLabel = MOIS[now.getMonth()].charAt(0).toUpperCase() + MOIS[now.getMonth()].slice(1);
  const annee = now.getFullYear();
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const periodLabel = from || to ? `${from ?? 'Début'} au ${to ?? 'aujourd’hui'}` : `${moisLabel} ${annee}`;

  // Détail du mois courant à partir des réservations réelles.
  const moisResas = useMemo(
    () =>
      reservations.filter((r) => {
        const d = new Date(r.reservation_date);
        const inDefaultMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        return (from || to ? true : inDefaultMonth) && (r.status === 'confirmed' || r.status === 'completed');
      }),
    [reservations, now.getMonth(), now.getFullYear(), from, to]
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
  const maxHistoryAmount = Math.max(...history.map((point) => point.amount), 1);

  const exportCsv = () => {
    setDownloadError(null);
    setDownloading('csv');
    try {
      const content = [
        ['Date', 'Terrain', 'Client', 'Début', 'Fin', 'Statut', 'Montant brut (FCFA)', 'Commission (FCFA)', 'Net reversé (FCFA)'],
        ...moisResas.map((reservation) => [
          new Date(reservation.reservation_date).toLocaleDateString('fr-FR'),
          reservation.terrain?.name ?? 'Terrain',
          reservation.user?.full_name ?? 'Client',
          reservation.start_hour,
          reservation.end_hour,
          reservation.status,
          reservation.total_price,
          reservation.platform_fee,
          reservation.partner_amount,
        ]),
      ]
        .map((row) => row.map(csvCell).join(';'))
        .join('\n');
      downloadBlob(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }), `gbonhi-foot-revenus-${from ?? annee}-${to ?? String(now.getMonth() + 1).padStart(2, '0')}.csv`);
    } finally {
      setDownloading(null);
    }
  };

  const exportStatement = async () => {
    setDownloadError(null);
    setDownloading('pdf');
    try {
      const pdf = await apiDownload('/reservations/stats/revenue-statement.pdf');
      downloadBlob(pdf, `gbonhi-foot-releve-${from ?? annee}-${to ?? String(now.getMonth() + 1).padStart(2, '0')}.pdf`);
    } catch {
      setDownloadError('Le relevé PDF n’a pas pu être généré. Réessaie dans quelques instants.');
    } finally {
      setDownloading(null);
    }
  };

  const exportXlsx = () => {
    const rows = [
      ['Date', 'Terrain', 'Client', 'Début', 'Fin', 'Statut', 'Montant brut (FCFA)', 'Commission (FCFA)', 'Net reversé (FCFA)'],
      ...moisResas.map((reservation) => [new Date(reservation.reservation_date).toLocaleDateString('fr-FR'), reservation.terrain?.name ?? 'Terrain', reservation.user?.full_name ?? 'Client', reservation.start_hour, reservation.end_hour, reservation.status, reservation.total_price, reservation.platform_fee, reservation.partner_amount]),
    ];
    downloadBlob(createXlsxBlob('Revenus partenaire', rows), `gbonhi-foot-revenus-${from ?? annee}-${to ?? String(now.getMonth() + 1).padStart(2, '0')}.xlsx`);
  };

  if (accessLoading) return <><Header title="Revenus & Finances" /><p className="text-sm text-gray-400">Vérification des accès…</p></>;
  if (!isOwner) return <><Header title="Accès restreint" /><div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">Les revenus et données de paiement sont réservés au propriétaire du partenaire.</div></>;

  return (
    <>
      <Header title="Revenus & Finances" subtitle={periodLabel} />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Stepper label={moisLabel} />
          <Stepper label={String(annee)} />
          <span className="inline-flex items-center gap-2 text-[12px] text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
            {periodLabel}
            <Trash2 size={13} className="text-gray-400" />
          </span>
        </div>
        <div className="flex items-center gap-2"><button onClick={exportXlsx} disabled={downloading !== null} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border border-[#1E7A3A] text-[#1E7A3A] disabled:cursor-not-allowed disabled:opacity-60"><Sheet size={14} /> Exporter XLSX</button><button onClick={exportCsv} disabled={downloading !== null} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold border disabled:cursor-not-allowed disabled:opacity-60" style={{ color: '#1E7A3A', borderColor: '#1E7A3A' }}><Download size={14} /> {downloading === 'csv' ? 'Export en cours…' : 'Exporter CSV'}</button></div>
      </div>

      {downloadError ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{downloadError}</p> : null}

      {/* Bannière CA cumulé */}
      <div className="rounded-xl p-5 mb-4 border flex items-center justify-between gap-6" style={{ backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }}>
        <div>
          <p className="text-[12px] text-gray-500">Chiffre d&apos;affaires — {periodLabel}</p>
          <p className="text-[26px] font-black text-gray-900 leading-tight">{stats ? stats.month_revenue.toLocaleString('fr-FR') : caTerrain.toLocaleString('fr-FR')} <span className="text-[14px] font-medium text-gray-400">FCFA</span></p>
          <p className="text-[12px] text-gray-600 mt-1">
            Revenu de la semaine : <span className="font-semibold">{weekRevenue}</span> · Net reversé : <span className="font-semibold">{fcfa(reverse)}</span> · Commission : <span className="font-semibold">{fcfa(commission)}</span>
          </p>
        </div>
      </div>

      {/* Card CA généré */}
      <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: '#1A3D2B' }}>
        <p className="text-[12px] text-white/60">Chiffre d&apos;affaires généré · {periodLabel}</p>
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
          <div className="h-56 flex items-end gap-1.5 pt-6" aria-label="Revenus nets des 30 derniers jours">
            {history.map((point) => {
              const height = Math.max(point.amount > 0 ? 7 : 2, Math.round((point.amount / maxHistoryAmount) * 100));
              return <div key={point.date} title={`${new Date(point.date).toLocaleDateString('fr-FR')} : ${fcfa(point.amount)}`} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-sm bg-[#2E9E4F] transition-opacity group-hover:opacity-75" style={{ height: `${height}%` }} /></div>;
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-gray-400"><span>Il y a 30 jours</span><span>Aujourd&apos;hui</span></div>
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
          <button onClick={() => void exportStatement()} disabled={downloading !== null} className="w-full mt-5 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            <FileDown size={14} /> {downloading === 'pdf' ? 'Génération du relevé…' : 'Télécharger le relevé PDF'}
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
