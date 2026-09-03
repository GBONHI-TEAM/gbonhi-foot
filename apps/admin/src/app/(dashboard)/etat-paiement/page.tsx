'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface Intent {
  id: string;
  mode: string;
  context: string | null;
  amount: number | null;
  payment_method: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  user?: { id: string; full_name?: string | null; username?: string | null } | null;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  opened: { label: 'Écran ouvert', bg: '#F3F4F6', color: '#6B7280' },
  pending: { label: 'En attente de validation', bg: '#FEF3C7', color: '#B45309' },
  validated: { label: 'Validé', bg: '#DCFCE7', color: '#15803D' },
  cancelled: { label: 'Annulé', bg: '#FEE2E2', color: '#B91C1C' },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, bg: '#F3F4F6', color: '#6B7280' };
}

const FILTERS = [
  { label: 'Tous', value: '' },
  { label: 'Écran ouvert', value: 'opened' },
  { label: 'En attente', value: 'pending' },
  { label: 'Validés', value: 'validated' },
  { label: 'Annulés', value: 'cancelled' },
];

function fcfa(v: number | null) {
  return v == null ? '—' : `${v.toLocaleString('fr-FR')} FCFA`;
}
function modeLabel(m: string) {
  return m === 'leagues' ? 'Ligue' : 'Réservation';
}
function methodLabel(m: string | null) {
  if (!m) return '—';
  const map: Record<string, string> = { cash: 'Espèces', wave: 'Wave', orange: 'Orange Money', mtn: 'MTN MoMo', moov: 'Moov Money' };
  return map[m.toLowerCase()] ?? m;
}
function fmt(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EtatPaiementPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Intent[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const qs = status ? `?status=${status}` : '';
      const data = await apiFetch<Intent[]>(`/payments/intents${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const name = (r.user?.full_name ?? r.user?.username ?? '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <>
      <Header title="État de paiement — traçage des tentatives" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className="h-10 rounded-lg border px-4 text-sm font-semibold"
              style={{ backgroundColor: status === f.value ? '#1E7A3A' : 'white', borderColor: status === f.value ? '#1E7A3A' : '#E2E8F0', color: status === f.value ? 'white' : '#64748B' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un utilisateur…" className="h-10 w-64 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#1E7A3A]" />
        </label>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3">Utilisateur</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Contexte</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Mis à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loaded ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Aucune tentative de paiement.</td></tr>
              ) : (
                filtered.map((r) => {
                  const meta = statusMeta(r.status);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-semibold text-slate-900">{r.user?.full_name ?? r.user?.username ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{modeLabel(r.mode)}</td>
                      <td className="px-4 py-3 text-slate-600">{r.context ?? '—'}</td>
                      <td className="px-4 py-3 font-bold text-[#F7921E]">{fcfa(r.amount)}</td>
                      <td className="px-4 py-3 text-slate-600">{methodLabel(r.payment_method)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{fmt(r.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
