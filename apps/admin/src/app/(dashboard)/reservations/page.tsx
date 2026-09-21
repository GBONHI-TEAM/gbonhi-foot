'use client';
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, X, Clock, MapPin, User, Wallet, CalendarClock, Ban, Check } from 'lucide-react';
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
  client_name?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
  terrain?: { name?: string | null; city?: string | null } | null;
  user?: { full_name?: string | null; phone?: string | null; email?: string | null } | null;
  payment?: { status?: string | null; payment_method?: string | null } | null;
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

// NB : les statuts sont stockés en minuscules en base (confirmed/pending/cancelled/completed).
const STATUS_FILTERS = [
  { label: 'Toutes', value: '' },
  { label: 'Confirmées', value: 'confirmed' },
  { label: 'En attente', value: 'pending' },
  { label: 'Annulées', value: 'cancelled' },
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    const qs = params.toString();
    try {
      const data = await apiFetch<ApiReservation[]>(`/reservations/all${qs ? `?${qs}` : ''}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, [status, date]);

  useEffect(() => {
    void load();
  }, [load]);

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
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} className="hover:bg-gray-50 transition cursor-pointer">
                    <td className="px-5 py-4 font-semibold text-gray-900">{r.user?.full_name?.trim() || r.client_name?.trim() || '—'}</td>
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

      {selectedId && (
        <ReservationDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={() => { void load(); }}
        />
      )}
    </>
  );
}

// ─── Détail + actions d'une réservation ─────────────────────────────────────

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function ReservationDetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [res, setRes] = useState<ApiReservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [form, setForm] = useState({ date: '', start: 0, end: 0 });

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<ApiReservation>(`/reservations/${id}`);
      setRes(data);
      setForm({
        date: toDateInput(data.reservation_date),
        start: data.start_hour ?? 0,
        end: data.end_hour ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function changeStatus(newStatus: string, cancelReason?: string) {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/reservations/${id}/admin-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, ...(cancelReason ? { cancel_reason: cancelReason } : {}) }),
      });
      await reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (form.end <= form.start) { setError('L’heure de fin doit être après l’heure de début.'); return; }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/reservations/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ reservation_date: form.date, start_hour: form.start, end_hour: form.end }),
      });
      await reload();
      onChanged();
      setMode('view');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reprogrammation impossible.');
    } finally {
      setBusy(false);
    }
  }

  const meta = res ? statusMeta(res.status) : null;
  const isCancelled = (res?.status ?? '').toLowerCase() === 'cancelled' || (res?.status ?? '').toLowerCase() === 'annulee';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Détail de la réservation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {!res ? (
          <div className="p-8 text-center text-sm text-gray-400">{error || 'Chargement…'}</div>
        ) : (
          <div className="px-5 py-4 overflow-y-auto">
            {meta && (
              <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold mb-4" style={{ backgroundColor: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            )}

            <div className="space-y-3 text-sm">
              <Row icon={<User size={15} />} label="Client" value={res.user?.full_name?.trim() || res.client_name?.trim() || '—'} />
              {(res.user?.phone || res.user?.email) && (
                <Row icon={<User size={15} />} label="Contact" value={[res.user?.phone, res.user?.email].filter(Boolean).join(' · ') || '—'} />
              )}
              <Row icon={<MapPin size={15} />} label="Terrain" value={`${res.terrain?.name?.trim() || '—'}${res.terrain?.city?.trim() ? ` · ${res.terrain.city}` : ''}`} />
              <Row icon={<CalendarClock size={15} />} label="Date" value={fmtDate(res.reservation_date)} />
              <Row icon={<Clock size={15} />} label="Créneau" value={fmtSlot(res.start_hour, res.end_hour)} />
              <Row icon={<Wallet size={15} />} label="Montant" value={fmtFcfa(res.total_price)} />
              <Row icon={<Wallet size={15} />} label="Part partenaire" value={fmtFcfa(res.partner_amount)} />
              {res.payment?.status && <Row icon={<Wallet size={15} />} label="Paiement" value={`${res.payment.status}${res.payment.payment_method ? ` · ${res.payment.payment_method}` : ''}`} />}
              {res.notes && <Row icon={<CalendarCheck size={15} />} label="Notes" value={res.notes} />}
              {res.cancel_reason && <Row icon={<Ban size={15} />} label="Motif" value={res.cancel_reason} />}
            </div>

            {mode === 'reschedule' && (
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">Reporter à une autre date / heure</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-3 text-xs font-medium text-gray-600">
                    Date
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Début (h)
                    <input type="number" min={0} max={24} step={0.5} value={form.start} onChange={(e) => setForm({ ...form, start: Number(e.target.value) })}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Fin (h)
                    <input type="number" min={0} max={24} step={0.5} value={form.end} onChange={(e) => setForm({ ...form, end: Number(e.target.value) })}
                      className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                </div>
                <p className="mt-2 text-[11px] text-gray-400">Le montant est recalculé automatiquement si la durée change. La disponibilité du créneau est vérifiée.</p>
              </div>
            )}

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {res && (
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
            {mode === 'reschedule' ? (
              <>
                <button onClick={() => { setMode('view'); setError(''); }} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">Retour</button>
                <button onClick={reschedule} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#1E7A3A' }}>
                  {busy ? '…' : 'Confirmer le report'}
                </button>
              </>
            ) : (
              <>
                {!isCancelled && (
                  <button onClick={() => changeStatus('cancelled', 'Annulée par l’administration')} disabled={busy}
                    className="h-10 px-4 rounded-lg text-sm font-semibold border inline-flex items-center gap-1.5 disabled:opacity-50" style={{ borderColor: '#FCA5A5', color: '#B91C1C' }}>
                    <Ban size={15} /> Annuler
                  </button>
                )}
                {(res.status ?? '').toLowerCase() === 'pending' && (
                  <button onClick={() => changeStatus('confirmed')} disabled={busy}
                    className="h-10 px-4 rounded-lg text-sm font-semibold border inline-flex items-center gap-1.5 disabled:opacity-50" style={{ borderColor: '#86EFAC', color: '#15803D' }}>
                    <Check size={15} /> Confirmer
                  </button>
                )}
                <button onClick={() => { setMode('reschedule'); setError(''); }} disabled={busy}
                  className="h-10 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: '#F7921E' }}>
                  <CalendarClock size={15} /> Reporter
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}
