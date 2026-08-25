'use client';

import { useEffect, useState } from 'react';
import { Banknote, RefreshCw, Info } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface PaymentMethod {
  code: string;
  label: string;
  enabled: boolean;
}

/** Logos officiels (servis depuis /public/payment). */
const METHOD_LOGO: Record<string, string> = {
  wave: '/payment/wave.png',
  orange: '/payment/orange.webp',
  mtn: '/payment/mtn.png',
};

export default function PaiementsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<PaymentMethod[]>('/payments/methods/all');
      setMethods(Array.isArray(data) ? data : []);
    } catch {
      setError('Impossible de charger les moyens de paiement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(method: PaymentMethod) {
    if (savingCode) return;
    const next = !method.enabled;
    setSavingCode(method.code);
    setMethods((prev) => prev.map((m) => (m.code === method.code ? { ...m, enabled: next } : m)));
    try {
      await apiFetch(`/payments/methods/${method.code}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: next }),
      });
    } catch {
      setMethods((prev) => prev.map((m) => (m.code === method.code ? { ...m, enabled: !next } : m)));
      setError('La modification a échoué. Réessaie.');
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <>
      <Header title="Moyens de paiement" />

      <div className="mb-5 flex items-center justify-between">
        <p className="max-w-2xl text-sm text-slate-500">
          Active ou désactive chaque moyen de paiement. Un moyen désactivé n&apos;apparaît plus dans l&apos;application — utile pour couper temporairement un service en cas de bug.
        </p>
        <button
          onClick={load}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={15} /> Rafraîchir
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement…</div>
        ) : methods.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Aucun moyen de paiement configuré.</div>
        ) : (
          methods.map((method) => (
            <div key={method.code} className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ opacity: method.enabled ? 1 : 0.5 }}>
                  {METHOD_LOGO[method.code] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={METHOD_LOGO[method.code]} alt={method.label} className="h-10 w-10 object-cover" />
                  ) : method.code === 'moov' ? (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: '#0A6DD8' }}>Moov</span>
                  ) : (
                    <Banknote size={18} style={{ color: method.enabled ? '#1E7A3A' : '#94A3B8' }} />
                  )}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{method.label}</p>
                  <p className="text-xs text-slate-400">{method.code === 'cash' ? 'À régler sur place' : 'Mobile Money'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold" style={{ color: method.enabled ? '#1E7A3A' : '#94A3B8' }}>
                  {method.enabled ? 'Activé' : 'Désactivé'}
                </span>
                <button
                  onClick={() => toggle(method)}
                  disabled={savingCode !== null}
                  aria-label={`Basculer ${method.label}`}
                  className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
                  style={{ backgroundColor: method.enabled ? '#1E7A3A' : '#CBD5E1' }}
                >
                  <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: method.enabled ? '22px' : '2px' }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
        <p className="text-xs leading-5 text-amber-700">
          Les paiements Mobile Money sont en mode simulé. Le paiement en espèces confirme la réservation (à régler sur place au partenaire).
        </p>
      </div>
    </>
  );
}
