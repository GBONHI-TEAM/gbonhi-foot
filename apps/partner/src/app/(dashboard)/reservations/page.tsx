'use client';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { Info, Search, Check, Clock, X } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { usePartnerAccess } from '../../../components/auth/partner-access-provider';
import {
  ApiReservation,
  ReservationStatus,
  STATUS_FR,
  fcfa,
  heureRange,
  dateCourteFR,
} from '../../../lib/domain';

const TABS = ['Toutes', 'Confirmées', 'En attente', 'Annulées'];

const PAIEMENT_COLOR: Record<string, string> = {
  Wave: '#1D4ED8',
  wave: '#1D4ED8',
  MTN: '#CA8A04',
  mtn: '#CA8A04',
  'Orange Money': '#EA580C',
  orange_money: '#EA580C',
  orange: '#EA580C',
};

const STATUT_BADGE: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  Confirmée: { bg: '#D1FAE5', color: '#065F46', icon: <Check size={12} /> },
  Terminée: { bg: '#D1FAE5', color: '#065F46', icon: <Check size={12} /> },
  'En attente': { bg: '#FEF3C7', color: '#92400E', icon: <Clock size={12} /> },
  Annulée: { bg: '#FEE2E2', color: '#B91C1C', icon: <X size={12} /> },
  Absent: { bg: '#F3F4F6', color: '#6B7280', icon: <X size={12} /> },
};

interface Row {
  id: string;
  ref: string;
  client: string;
  date: string;
  creneau: string;
  montant: string;
  paiement: string;
  statut: string;
  status: ReservationStatus;
}

function mapRow(r: ApiReservation, showFinancials: boolean): Row {
  return {
    id: r.id,
    ref: r.id.slice(0, 8).toUpperCase(),
    client: r.user?.full_name ?? 'Client',
    date: dateCourteFR(r.reservation_date),
    creneau: heureRange(r.start_hour, r.end_hour),
    montant: showFinancials && typeof r.total_price === 'number' ? fcfa(r.total_price) : '—',
    paiement: showFinancials ? r.payment?.payment_method ?? '—' : '—',
    statut: STATUS_FR[r.status],
    status: r.status,
  };
}

export default function ReservationsPage() {
  const { isOwner, loading: accessLoading } = usePartnerAccess();
  const [tab, setTab] = useState('Toutes');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(signal?: { cancelled: boolean }) {
    try {
      const data = await apiFetch<ApiReservation[]>('/reservations');
      if (signal?.cancelled) return;
      if (Array.isArray(data)) setRows(data.map((reservation) => mapRow(reservation, isOwner)));
    } catch {
      /* liste vide */
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [isOwner, accessLoading]);

  async function changeStatus(
    id: string,
    status: ReservationStatus,
    cancel_reason?: string,
  ) {
    setActingId(id);
    setError(null);
    try {
      await apiFetch(`/reservations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(cancel_reason ? { cancel_reason } : {}) }),
      });
      await load();
    } catch {
      setError('Action impossible. Veuillez réessayer.');
    } finally {
      setActingId(null);
    }
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const okTab =
          tab === 'Toutes' ||
          (tab === 'Confirmées' && (r.statut === 'Confirmée' || r.statut === 'Terminée')) ||
          (tab === 'En attente' && r.statut === 'En attente') ||
          (tab === 'Annulées' && r.statut === 'Annulée');
        const okQuery = !query || r.client.toLowerCase().includes(query.toLowerCase());
        return okTab && okQuery;
      }),
    [rows, tab, query]
  );

  return (
    <>
      <Header title="Réservations" subtitle={`${rows.length} réservation${rows.length > 1 ? 's' : ''}`} />

      {/* Bandeau info */}
      <div className="flex items-start gap-2 rounded-xl p-4 mb-5 border" style={{ backgroundColor: '#F0FDF4', borderColor: '#A7F3D0' }}>
        <Info size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#1E7A3A' }} />
        <p className="text-[13px] text-gray-600">
          Les réservations sont confirmées automatiquement après paiement du client dans l&apos;app GBONHI FOOT. Aucune validation manuelle requise de votre part.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3.5 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor: tab === t ? '#1A3D2B' : 'white',
                color: tab === t ? 'white' : '#6B7280',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher client…"
              className="h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-[13px] focus:outline-none focus:border-[#1E7A3A]"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg p-3 mb-4 border text-[13px]" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', color: '#B91C1C' }}>
          <X size={15} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr style={{ backgroundColor: '#1E7A3A' }}>
                {['Réf', 'Client', 'Date', 'Créneau', ...(isOwner ? ['Montant', 'Paiement'] : []), 'Statut', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold text-white uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const badge = STATUT_BADGE[r.statut] ?? { bg: '#F3F4F6', color: '#6B7280', icon: null };
                return (
                  <tr key={r.ref} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[12px] text-gray-400 font-mono whitespace-nowrap">#{r.ref}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-gray-900 whitespace-nowrap">{r.client}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600 whitespace-nowrap">{r.creneau}</td>
                    {isOwner && <><td className="px-4 py-3 text-[13px] font-medium text-gray-900 whitespace-nowrap">{r.montant}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap" style={{ color: PAIEMENT_COLOR[r.paiement] ?? '#9CA3AF' }}>{r.paiement}</td></>}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                        {badge.icon} {r.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === 'pending' || r.status === 'confirmed' ? (
                        <div className="flex items-center gap-2">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => changeStatus(r.id, 'confirmed')}
                              disabled={actingId === r.id}
                              className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#1E7A3A' }}
                            >
                              <Check size={13} /> Confirmer
                            </button>
                          )}
                          <button
                            onClick={() => changeStatus(r.id, 'cancelled')}
                            disabled={actingId === r.id}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                            style={{ borderColor: '#FCA5A5', color: '#B91C1C', backgroundColor: 'white' }}
                          >
                            <X size={13} /> Annuler
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12px] text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-gray-400 text-sm">
                    Aucune réservation dans cette catégorie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
