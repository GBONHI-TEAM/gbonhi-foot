'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Search, Sheet, Wallet, X, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';
import { createPdfBlob, createReceiptPdfBlob, createXlsxBlob, downloadBlob } from '../../../../lib/file-export';

interface PartnerRow { partnerId: string; partnerName: string; terrains: string[]; amountOwed: number; transactions: number; status: string; }
interface Settlement {
  id: string; partnerId: string; partnerName: string; amount: number; grossAmount: number; commission: number;
  transactions: number; method: string; reference: string | null; note: string | null;
  periodFrom: string | null; periodTo: string | null; createdAt: string;
}

const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} F`;
const METHOD_LABELS: Record<string, string> = { cash: 'Espèces', mobile_money: 'Mobile Money', bank_transfer: 'Virement bancaire', other: 'Autre' };
const slug = (s: string) => s.toLocaleLowerCase('fr').replaceAll(/[^a-z0-9]+/g, '-');

function Badge({ status }: { status: string }) {
  const paid = status.toLocaleLowerCase('fr').includes('payé');
  return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: paid ? '#D1FAE5' : '#FEF3C7', color: paid ? '#15803D' : '#B45309' }}>{status}</span>;
}

/** Génère et télécharge le reçu de reversement (PDF clair et explicite). */
function downloadReceipt(s: Settlement) {
  const lines: Array<[string, string]> = [];
  if (s.periodFrom || s.periodTo) lines.push(['Période couverte', `${s.periodFrom ?? '—'} au ${s.periodTo ?? '—'}`]);
  lines.push(
    ['Nombre de réservations soldées', String(s.transactions)],
    ['Montant total encaissé (brut)', fcfa(s.grossAmount)],
    ['Commission GBONHI (10%)', `- ${fcfa(s.commission)}`],
  );
  const payment: Array<[string, string]> = [
    ['Méthode de paiement', METHOD_LABELS[s.method] ?? s.method],
    ['Référence', s.reference || '—'],
  ];
  if (s.note) payment.push(['Note', s.note]);

  downloadBlob(
    createReceiptPdfBlob({
      docTitle: 'Reçu de reversement',
      reference: `N° ${s.id.slice(0, 8).toUpperCase()}`,
      dateLabel: new Date(s.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      statusLabel: 'PAYÉ',
      beneficiary: { name: s.partnerName, sub: 'Partenaire GBONHI FOOT' },
      lines,
      highlight: { label: 'MONTANT NET REVERSÉ AU PARTENAIRE', value: fcfa(s.amount) },
      payment,
      footerNote: 'Ce reçu atteste du reversement ci-dessus au partenaire. Statut : PAYÉ.',
    }),
    `recu-reversement-${slug(s.partnerName)}-${s.createdAt.slice(0, 10)}.pdf`,
  );
}

export default function PartenairesAPayerPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('À payer');
  const [search, setSearch] = useState('');
  const [settleTarget, setSettleTarget] = useState<PartnerRow | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const [partners, hist] = await Promise.all([
        apiFetch<PartnerRow[]>('/finance/partners').catch(() => []),
        apiFetch<Settlement[]>('/finance/settlements').catch(() => []),
      ]);
      setRows(Array.isArray(partners) ? partners : []);
      setSettlements(Array.isArray(hist) ? hist : []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const showingPaid = statusFilter === 'Payé';

  const filtered = useMemo(
    () => rows.filter((row) => `${row.partnerName} ${row.terrains.join(' ')}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))),
    [rows, search],
  );
  const filteredSettlements = useMemo(
    () => settlements.filter((s) => `${s.partnerName} ${s.reference ?? ''}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))),
    [settlements, search],
  );

  const net = filtered.reduce((sum, row) => sum + row.amountOwed, 0);
  const gross = Math.round(net / 0.9);
  const commission = gross - net;
  const totalPaid = settlements.reduce((sum, s) => sum + s.amount, 0);
  const exportRows = filtered.map((row) => [row.partnerName, row.terrains.join(', '), row.transactions, Math.round(row.amountOwed / 0.9), Math.round(row.amountOwed / 0.9) - row.amountOwed, row.amountOwed, row.status]);
  const fileName = `gbonhi-foot-partenaires-${new Date().toISOString().slice(0, 10)}`;

  return (
    <>
      <Header title="Partenaires à payer" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['À payer', 'Payé'].map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className="h-10 rounded-lg border px-4 text-sm font-semibold" style={{ backgroundColor: statusFilter === status ? '#F7921E' : 'white', borderColor: statusFilter === status ? '#F7921E' : '#E2E8F0', color: statusFilter === status ? '#1F2937' : '#64748B' }}>{status}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/finance')} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">Dashboard Finance</button>
          <button onClick={() => downloadBlob(createXlsxBlob('Partenaires à payer', [['Partenaire', 'Terrains', 'Réservations', 'Brut', 'Commission 10%', 'Net à reverser', 'Statut'], ...exportRows]), `${fileName}.xlsx`)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#24883F] px-3 text-sm font-semibold text-[#24883F]"><Sheet size={15} /> XLSX</button>
          <button onClick={() => downloadBlob(createPdfBlob('Partenaires à payer', 'Période active', [['Total net à reverser', net], ['Commission GBONHI', commission], ['Dossiers', filtered.length]]), `${fileName}.pdf`)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#24883F] px-3 text-sm font-semibold text-[#24883F]"><FileDown size={15} /> PDF</button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border-t-4 border-[#F7921E] bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Total à payer</p><p className="mt-1 text-2xl font-black text-[#F7921E]">{fcfa(net)}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Déjà payé</p><p className="mt-1 text-2xl font-black text-[#24883F]">{fcfa(totalPaid)}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">À reverser</p><p className="mt-1 text-2xl font-black text-[#B45309]">{filtered.length} dossier{filtered.length > 1 ? 's' : ''}</p></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Commission GBONHI</p><p className="mt-1 text-2xl font-black text-[#24883F]">{fcfa(commission)}</p></article>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-900">{showingPaid ? 'Reversements effectués' : 'Versements partenaires'}</h2>
          <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher…" className="h-9 w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#24883F]" /></label>
        </div>

        <div className="overflow-x-auto">
          {showingPaid ? (
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Partenaire</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Méthode</th><th className="px-4 py-3">Référence</th><th className="px-4 py-3">Réservations</th><th className="px-4 py-3">Montant reversé</th><th className="px-4 py-3">Reçu</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {!loaded ? (
                  <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Chargement…</td></tr>
                ) : filteredSettlements.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Aucun reversement enregistré.</td></tr>
                ) : filteredSettlements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-bold text-slate-900">{s.partnerName}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(s.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-slate-600">{METHOD_LABELS[s.method] ?? s.method}</td>
                    <td className="px-4 py-3 text-slate-600">{s.reference || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.transactions}</td>
                    <td className="px-4 py-3 font-bold text-[#24883F]">{fcfa(s.amount)}</td>
                    <td className="px-4 py-3"><button onClick={() => downloadReceipt(s)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"><Download size={13} /> Reçu</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Partenaire / Terrain</th><th className="px-4 py-3">Réservations</th><th className="px-4 py-3">Montant brut</th><th className="px-4 py-3">Commission 10%</th><th className="px-4 py-3">Net à reverser</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {!loaded ? (
                  <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Aucun versement en attente.</td></tr>
                ) : filtered.map((row) => {
                  const rowGross = Math.round(row.amountOwed / 0.9);
                  const rowCommission = rowGross - row.amountOwed;
                  return (
                    <tr key={row.partnerId} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3"><p className="font-bold text-slate-900">{row.terrains[0] ?? 'Terrain partenaire'}</p><p className="mt-0.5 text-xs text-slate-400">{row.partnerName}{row.terrains.length > 1 ? ` · +${row.terrains.length - 1} terrain(s)` : ''}</p></td>
                      <td className="px-4 py-3 text-slate-700">{row.transactions}</td>
                      <td className="px-4 py-3 text-slate-700">{fcfa(rowGross)}</td>
                      <td className="px-4 py-3 font-semibold text-[#24883F]">{fcfa(rowCommission)}</td>
                      <td className="px-4 py-3 font-bold text-[#F7921E]">{fcfa(row.amountOwed)}</td>
                      <td className="px-4 py-3"><Badge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSettleTarget(row)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: '#24883F' }}>
                          <Wallet size={13} /> Solder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot><tr style={{ backgroundColor: '#0D1F0D' }} className="font-bold text-white"><td className="px-5 py-3">TOTAL</td><td className="px-4 py-3">{filtered.reduce((sum, row) => sum + row.transactions, 0)}</td><td className="px-4 py-3">{fcfa(gross)}</td><td className="px-4 py-3 text-emerald-300">{fcfa(commission)}</td><td className="px-4 py-3 text-[#FFB830]">{fcfa(net)}</td><td colSpan={2} /></tr></tfoot>
              )}
            </table>
          )}
        </div>
      </section>

      {settleTarget && (
        <SettleModal
          partner={settleTarget}
          onClose={() => setSettleTarget(null)}
          onDone={(receipt) => { setSettleTarget(null); void load(); if (receipt) downloadReceipt(receipt); }}
        />
      )}
    </>
  );
}

// ─── Modale de reversement ──────────────────────────────────────────────────

function SettleModal({ partner, onClose, onDone }: { partner: PartnerRow; onClose: () => void; onDone: (receipt: Settlement | null) => void; }) {
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm(printReceipt: boolean) {
    setBusy(true);
    setError('');
    try {
      const receipt = await apiFetch<Settlement>(`/finance/partners/${partner.partnerId}/settle`, {
        method: 'POST',
        body: JSON.stringify({ method, reference: reference.trim() || undefined, note: note.trim() || undefined }),
      });
      onDone(printReceipt ? receipt : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reversement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Solder le partenaire</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-xl bg-slate-50 p-4 mb-4">
            <p className="text-sm text-slate-500">{partner.partnerName}</p>
            <p className="text-xs text-slate-400 mb-2">{partner.terrains.join(', ') || '—'} · {partner.transactions} réservation(s)</p>
            <p className="text-sm text-slate-500">Montant net à reverser</p>
            <p className="text-2xl font-black text-[#F7921E]">{fcfa(partner.amountOwed)}</p>
          </div>

          <label className="block text-xs font-semibold text-slate-600 mb-3">
            Méthode de paiement
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement bancaire</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600 mb-3">
            Référence (n° transaction, chèque…) — optionnel
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Ex. MTN-2026-0912" />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Note — optionnel
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          </label>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-[11px] text-slate-400">Confirmer marque ces réservations comme payées : elles sortent du « à payer » et ne pourront plus être reversées deux fois.</p>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => confirm(false)} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold border disabled:opacity-50" style={{ borderColor: '#24883F', color: '#24883F' }}>
            {busy ? '…' : 'Marquer payé'}
          </button>
          <button onClick={() => confirm(true)} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: '#24883F' }}>
            <Check size={15} /> Payer + reçu
          </button>
        </div>
      </div>
    </div>
  );
}
