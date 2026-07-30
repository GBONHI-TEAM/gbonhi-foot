'use client';
import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { EmptyState } from '../../../components/ui/empty-state';
import { apiFetch } from '../../../lib/api';

interface ApiReservation {
  id: string;
  reservation_date: string | null;
  start_hour: number | null;
  end_hour: number | null;
  total_price: number | null;
  partner_amount: number | null;
  status: string | null;
  terrain?: { name?: string | null; city?: string | null } | null;
  user?: { full_name?: string | null } | null;
  payment?: { status?: string | null } | null;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  CONFIRMED: { label: 'Confirmée', bg: '#DCFCE7', color: '#15803D' },
  CONFIRMEE: { label: 'Confirmée', bg: '#DCFCE7', color: '#15803D' },
  PENDING: { label: 'En attente', bg: '#FEF3C7', color: '#B45309' },
  EN_ATTENTE: { label: 'En attente', bg: '#FEF3C7', color: '#B45309' },
  CANCELLED: { label: 'Annulée', bg: '#FEE2E2', color: '#B91C1C' },
  ANNULEE: { label: 'Annulée', bg: '#FEE2E2', color: '#B91C1C' },
  COMPLETED: { label: 'Terminée', bg: '#F3F4F6', color: '#6B7280' },
  TERMINEE: { label: 'Terminée', bg: '#F3F4F6', color: '#6B7280' },
};

function statusMeta(s: string | null) {
  return STATUS_META[(s ?? '').toUpperCase()] ?? { label: s ?? '—', bg: '#F3F4F6', color: '#6B7280' };
}

const STATUS_FILTERS = [
  { label: 'Toutes', value: '' },
  { label: 'Confirmées', value: 'CONFIRMED' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Annulées', value: 'CANCELLED' },
];

function fmtFcfa(v: number | null) {
  if (v == null) return '—';
  return `${v.toLocaleString('fr-FR')} FCFA`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtSlot(start: number | null, end: number | null) {
  if (start == null && end == null) return '—';
  const h = (n: number | null) => (n == null ? '—' : `${String(n).padStart(2, '0')}h`);
  return `${h(start)} – ${h(end)}`;
}

export default function ReservationsPage() {
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<ApiReservation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    const qs = params.toString();
    (async () => {
      try {
        const data = await apiFetch<ApiReservation[]>(`/reservations/all${qs ? `?${qs}` : ''}`);
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, date]);

  return (
    <>
      <Header title="Réservations" />

      {/* Filtres */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex gap-2.5 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <button
                key={f.label}
                onClick={() => setStatus(f.value)}
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
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-primary"
        />
      </div>

      {loaded && rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Aucune réservation pour le moment" message="Les réservations effectuées sur la plateforme apparaîtront ici." />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Client', 'Terrain', 'Date', 'Créneau', 'Montant', 'Part partenaire', 'Statut'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const meta = statusMeta(r.status);
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-4 font-semibold text-gray-900">{r.user?.full_name?.trim() || '—'}</td>
                    <td className="px-5 py-4 text-gray-700">
                      {r.terrain?.name?.trim() || '—'}
                      {r.terrain?.city?.trim() && <span className="text-gray-400"> · {r.terrain.city}</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{fmtDate(r.reservation_date)}</td>
                    <td className="px-5 py-4 text-gray-600">{fmtSlot(r.start_hour, r.end_hour)}</td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#1E7A3A' }}>{fmtFcfa(r.total_price)}</td>
                    <td className="px-5 py-4 text-gray-600">{fmtFcfa(r.partner_amount)}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
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
    </>
  );
}
