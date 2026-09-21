'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CalendarClock, Check, Clock, MapPin, User, Wallet, CalendarCheck } from 'lucide-react';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';

interface Reservation {
  id: string;
  reservation_date: string | null;
  start_hour: number | null;
  end_hour: number | null;
  total_price: number | null;
  partner_amount: number | null;
  platform_fee?: number | null;
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
  PENDING: { label: 'En attente', bg: '#FEF3C7', color: '#B45309' },
  CANCELLED: { label: 'Annulée', bg: '#FEE2E2', color: '#B91C1C' },
  COMPLETED: { label: 'Terminée', bg: '#F3F4F6', color: '#6B7280' },
  NO_SHOW: { label: 'No-show', bg: '#FEE2E2', color: '#B91C1C' },
};
function statusMeta(s: string | null) {
  return STATUS_META[(s ?? '').toUpperCase()] ?? { label: s ?? '—', bg: '#F3F4F6', color: '#6B7280' };
}
const fcfa = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('fr-FR')} FCFA`);
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return '—'; }
}
function fmtSlot(a: number | null, b: number | null) {
  const h = (n: number | null) => (n == null ? '—' : `${String(Math.floor(n)).padStart(2, '0')}h${n % 1 ? '30' : ''}`);
  return `${h(a)} – ${h(b)}`;
}
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ''; }
}

export default function ReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [res, setRes] = useState<Reservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [form, setForm] = useState({ date: '', start: 0, end: 0 });

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<Reservation>(`/reservations/${id}`);
      setRes(data);
      setForm({ date: toDateInput(data.reservation_date), start: data.start_hour ?? 0, end: data.end_hour ?? 0 });
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function changeStatus(newStatus: string, cancelReason?: string) {
    if (!id) return;
    setBusy(true); setError('');
    try {
      await apiFetch(`/reservations/${id}/admin-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, ...(cancelReason ? { cancel_reason: cancelReason } : {}) }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally { setBusy(false); }
  }

  async function reschedule() {
    if (!id) return;
    if (form.end <= form.start) { setError('L’heure de fin doit être après l’heure de début.'); return; }
    setBusy(true); setError('');
    try {
      await apiFetch(`/reservations/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ reservation_date: form.date, start_hour: form.start, end_hour: form.end }),
      });
      await reload();
      setMode('view');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reprogrammation impossible.');
    } finally { setBusy(false); }
  }

  const meta = res ? statusMeta(res.status) : null;
  const st = (res?.status ?? '').toLowerCase();
  const isClosed = ['cancelled', 'annulee', 'completed', 'terminee', 'no_show'].includes(st);

  return (
    <>
      <Header title="Détail de la réservation" />

      <button onClick={() => router.push('/reservations')} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
        <ArrowLeft size={16} /> Retour aux réservations
      </button>

      {notFound ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-400 shadow-sm">Réservation introuvable.</div>
      ) : !res ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-400 shadow-sm">Chargement…</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Colonne détails */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Réservation</p>
                  <p className="font-mono text-sm text-gray-500">#{res.id.slice(0, 8).toUpperCase()}</p>
                </div>
                {meta && <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>{meta.label}</span>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field icon={<User size={16} />} label="Client" value={res.user?.full_name?.trim() || res.client_name?.trim() || '—'} />
                <Field icon={<User size={16} />} label="Contact" value={[res.user?.phone, res.user?.email].filter(Boolean).join(' · ') || '—'} />
                <Field icon={<MapPin size={16} />} label="Terrain" value={`${res.terrain?.name?.trim() || '—'}${res.terrain?.city?.trim() ? ` · ${res.terrain.city}` : ''}`} />
                <Field icon={<CalendarClock size={16} />} label="Date" value={fmtDate(res.reservation_date)} />
                <Field icon={<Clock size={16} />} label="Créneau" value={fmtSlot(res.start_hour, res.end_hour)} />
                <Field icon={<Wallet size={16} />} label="Paiement" value={res.payment?.status ? `${res.payment.status}${res.payment.payment_method ? ` · ${res.payment.payment_method}` : ''}` : '—'} />
                {res.notes && <Field icon={<CalendarCheck size={16} />} label="Notes" value={res.notes} full />}
                {res.cancel_reason && <Field icon={<Ban size={16} />} label="Motif d’annulation" value={res.cancel_reason} full />}
              </div>
            </div>

            {mode === 'reschedule' && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-1">Reporter à une autre date / heure</h3>
                <p className="text-xs text-gray-400 mb-4">La disponibilité du créneau est vérifiée et le montant recalculé si la durée change.</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-3 text-xs font-medium text-gray-600">Date
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Début (h)
                    <input type="number" min={0} max={24} step={0.5} value={form.start} onChange={(e) => setForm({ ...form, start: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Fin (h)
                    <input type="number" min={0} max={24} step={0.5} value={form.end} onChange={(e) => setForm({ ...form, end: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setMode('view'); setError(''); }} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
                  <button onClick={reschedule} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#1E7A3A' }}>{busy ? '…' : 'Confirmer le report'}</button>
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
          </div>

          {/* Colonne montants + actions */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Montants</p>
              <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Montant total</span><span className="font-bold text-gray-900">{fcfa(res.total_price)}</span></div>
              <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Part partenaire</span><span className="font-semibold text-gray-700">{fcfa(res.partner_amount)}</span></div>
              {res.platform_fee != null && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Commission GBONHI</span><span className="font-semibold text-[#1E7A3A]">{fcfa(res.platform_fee)}</span></div>}
            </div>

            {mode === 'view' && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Actions</p>
                <div className="space-y-2.5">
                  {st === 'pending' && (
                    <ActionBtn onClick={() => changeStatus('confirmed')} disabled={busy} color="#15803D" border="#86EFAC" icon={<Check size={16} />}>Confirmer</ActionBtn>
                  )}
                  <ActionBtn onClick={() => { setMode('reschedule'); setError(''); }} disabled={busy} color="white" bg="#F7921E" icon={<CalendarClock size={16} />}>Reporter / reprogrammer</ActionBtn>
                  {!isClosed && (
                    <>
                      <ActionBtn onClick={() => changeStatus('completed')} disabled={busy} color="#374151" border="#E5E7EB" icon={<Check size={16} />}>Marquer terminée</ActionBtn>
                      <ActionBtn onClick={() => changeStatus('no_show', 'Client absent (no-show)')} disabled={busy} color="#6B7280" border="#E5E7EB" icon={<Ban size={16} />}>No-show (client absent)</ActionBtn>
                      <ActionBtn onClick={() => changeStatus('cancelled', 'Annulée par l’administration')} disabled={busy} color="#B91C1C" border="#FCA5A5" icon={<Ban size={16} />}>Annuler la réservation</ActionBtn>
                    </>
                  )}
                  {isClosed && <p className="text-xs text-gray-400">Cette réservation est clôturée. Utilise « Reporter » pour la reprogrammer si besoin.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ icon, label, value, full }: { icon: React.ReactNode; label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">{icon} {label}</p>
      <p className="mt-1 text-gray-800 font-medium">{value}</p>
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, color, bg, border, icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; color: string; bg?: string; border?: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full h-11 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 transition"
      style={{ color, backgroundColor: bg ?? 'white', border: bg ? 'none' : `1px solid ${border ?? '#E5E7EB'}` }}>
      {icon} {children}
    </button>
  );
}
