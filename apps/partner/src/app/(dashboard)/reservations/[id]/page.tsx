'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, Check, Clock, MapPin, User, Wallet, CalendarClock } from 'lucide-react';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';
import { usePartnerAccess } from '../../../../components/auth/partner-access-provider';
import { ReservationStatus, STATUS_FR, fcfa, heureRange } from '../../../../lib/domain';

interface Reservation {
  id: string;
  reservation_date: string;
  start_hour: number;
  end_hour: number;
  total_price: number | null;
  partner_amount: number | null;
  platform_fee: number | null;
  status: ReservationStatus;
  notes: string | null;
  cancel_reason: string | null;
  client_name: string | null;
  terrain: { name: string; city: string | null } | null;
  user: { full_name: string | null; phone?: string | null; email?: string | null } | null;
  payment: { status: string | null; payment_method: string | null } | null;
}

const BADGE: Record<string, { bg: string; color: string }> = {
  Confirmée: { bg: '#D1FAE5', color: '#065F46' },
  Terminée: { bg: '#D1FAE5', color: '#065F46' },
  'En attente': { bg: '#FEF3C7', color: '#92400E' },
  Annulée: { bg: '#FEE2E2', color: '#B91C1C' },
  Absent: { bg: '#F3F4F6', color: '#6B7280' },
};

function fmtLongDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; }
}

export default function PartnerReservationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { isOwner } = usePartnerAccess();
  const [res, setRes] = useState<Reservation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      setRes(await apiFetch<Reservation>(`/reservations/terrain/${id}`));
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function changeStatus(status: ReservationStatus, cancel_reason?: string) {
    if (!id) return;
    setBusy(true); setError('');
    try {
      await apiFetch(`/reservations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(cancel_reason ? { cancel_reason } : {}) }),
      });
      setCancelling(false);
      setReason('');
      await reload();
    } catch {
      setError('Action impossible. Veuillez réessayer.');
    } finally {
      setBusy(false);
    }
  }

  const statut = res ? STATUS_FR[res.status] : '';
  const badge = BADGE[statut] ?? { bg: '#F3F4F6', color: '#6B7280' };
  const active = res && (res.status === 'pending' || res.status === 'confirmed');

  return (
    <>
      <Header title="Détail de la réservation" subtitle={res ? `#${res.id.slice(0, 8).toUpperCase()}` : ''} />

      <button onClick={() => router.push('/reservations')} className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800">
        <ArrowLeft size={16} /> Retour aux réservations
      </button>

      {notFound ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-400 shadow-sm">Réservation introuvable.</div>
      ) : !res ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-gray-400 shadow-sm">Chargement…</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs uppercase tracking-wide text-gray-400">Réservation #{res.id.slice(0, 8).toUpperCase()}</p>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: badge.bg, color: badge.color }}>{statut}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field icon={<User size={16} />} label="Client" value={res.user?.full_name?.trim() || res.client_name?.trim() || 'Client'} />
                <Field icon={<User size={16} />} label="Contact" value={[res.user?.phone, res.user?.email].filter(Boolean).join(' · ') || '—'} />
                <Field icon={<MapPin size={16} />} label="Terrain" value={`${res.terrain?.name?.trim() || '—'}${res.terrain?.city?.trim() ? ` · ${res.terrain.city}` : ''}`} />
                <Field icon={<CalendarClock size={16} />} label="Date" value={fmtLongDate(res.reservation_date)} />
                <Field icon={<Clock size={16} />} label="Créneau" value={heureRange(res.start_hour, res.end_hour)} />
                <Field icon={<Wallet size={16} />} label="Paiement" value={res.payment?.status ? `${res.payment.status}${res.payment.payment_method ? ` · ${res.payment.payment_method}` : ''}` : '—'} />
                {res.notes && <Field icon={<CalendarClock size={16} />} label="Notes" value={res.notes} full />}
                {res.cancel_reason && <Field icon={<Ban size={16} />} label="Motif d’annulation" value={res.cancel_reason} full />}
              </div>
            </div>

            {cancelling && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-1">Motif de l’annulation</h3>
                <p className="text-xs text-gray-400 mb-3">Le client sera informé de la raison. Indique pourquoi ce créneau est annulé.</p>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex. Terrain indisponible (maintenance), intempéries…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1E7A3A]" />
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setCancelling(false); setReason(''); setError(''); }} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">Retour</button>
                  <button onClick={() => changeStatus('cancelled', reason.trim() || 'Annulée par le partenaire')} disabled={busy || reason.trim().length < 3}
                    className="h-10 px-4 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#B91C1C' }}>
                    {busy ? '…' : 'Confirmer l’annulation'}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-5">
            {isOwner && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Montants</p>
                <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Montant total</span><span className="font-bold text-gray-900">{res.total_price != null ? fcfa(res.total_price) : '—'}</span></div>
                <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Votre part</span><span className="font-semibold text-gray-700">{res.partner_amount != null ? fcfa(res.partner_amount) : '—'}</span></div>
                {res.platform_fee != null && <div className="flex justify-between py-1.5 text-sm"><span className="text-gray-500">Commission GBONHI</span><span className="font-semibold text-[#1E7A3A]">{fcfa(res.platform_fee)}</span></div>}
              </div>
            )}

            {!cancelling && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Actions</p>
                {active ? (
                  <div className="space-y-2.5">
                    {res.status === 'pending' && (
                      <button onClick={() => changeStatus('confirmed')} disabled={busy}
                        className="w-full h-11 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 border disabled:opacity-50" style={{ borderColor: '#86EFAC', color: '#15803D' }}>
                        <Check size={16} /> Confirmer
                      </button>
                    )}
                    <button onClick={() => { setCancelling(true); setError(''); }} disabled={busy}
                      className="w-full h-11 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 border disabled:opacity-50" style={{ borderColor: '#FCA5A5', color: '#B91C1C' }}>
                      <Ban size={16} /> Annuler (avec motif)
                    </button>
                    <p className="text-[11px] text-gray-400 pt-1">Annuler une réservation payée informe le client du motif. À utiliser en cas d’indisponibilité réelle du terrain.</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Cette réservation est clôturée : aucune action disponible.</p>
                )}
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
