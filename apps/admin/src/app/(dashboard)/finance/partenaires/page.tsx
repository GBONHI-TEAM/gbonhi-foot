'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, Search, Sheet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';
import { createPdfBlob, createXlsxBlob, downloadBlob } from '../../../../lib/file-export';

interface PartnerRow { partnerId: string; partnerName: string; terrains: string[]; amountOwed: number; transactions: number; status: string; }
const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} F`;

function Badge({ status }: { status: string }) {
  const paid = status.toLocaleLowerCase('fr').includes('payé');
  const waiting = status.toLocaleLowerCase('fr').includes('attente');
  return <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: paid ? '#D1FAE5' : waiting ? '#E5E7EB' : '#FEF3C7', color: paid ? '#15803D' : waiting ? '#64748B' : '#B45309' }}>{status}</span>;
}

export default function PartenairesAPayerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [search, setSearch] = useState('');

  useEffect(() => { void apiFetch<PartnerRow[]>('/finance/partners').then((data) => setRows(Array.isArray(data) ? data : [])).catch(() => setRows([])).finally(() => setLoaded(true)); }, [searchParams]);
  const filtered = useMemo(() => rows.filter((row) => (statusFilter === 'Tous' || row.status === statusFilter) && `${row.partnerName} ${row.terrains.join(' ')}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))), [rows, statusFilter, search]);
  const net = filtered.reduce((sum, row) => sum + row.amountOwed, 0);
  const gross = Math.round(net / 0.9);
  const commission = gross - net;
  const exportRows = filtered.map((row) => [row.partnerName, row.terrains.join(', '), row.transactions, Math.round(row.amountOwed / 0.9), Math.round(row.amountOwed / 0.9) - row.amountOwed, row.amountOwed, row.status]);
  const fileName = `gbonhi-foot-partenaires-${new Date().toISOString().slice(0, 10)}`;

  return <>
    <Header title="Partenaires à payer" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{['Tous', 'À payer', 'Payé', 'En attente'].map((status) => <button key={status} onClick={() => setStatusFilter(status)} className="h-10 rounded-lg border px-4 text-sm font-semibold" style={{ backgroundColor: statusFilter === status ? '#F7921E' : 'white', borderColor: statusFilter === status ? '#F7921E' : '#E2E8F0', color: statusFilter === status ? '#1F2937' : '#64748B' }}>{status}</button>)}</div><div className="flex flex-wrap gap-2"><button onClick={() => router.push('/finance')} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">Dashboard Finance</button><button onClick={() => downloadBlob(createXlsxBlob('Partenaires à payer', [['Partenaire', 'Terrains', 'Réservations', 'Brut', 'Commission 10%', 'Net à reverser', 'Statut'], ...exportRows]), `${fileName}.xlsx`)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#24883F] px-3 text-sm font-semibold text-[#24883F]"><Sheet size={15} /> XLSX</button><button onClick={() => downloadBlob(createPdfBlob('Partenaires à payer', 'Période active', [['Total net à reverser', net], ['Commission GBONHI', commission], ['Dossiers', filtered.length]]), `${fileName}.pdf`)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#24883F] px-3 text-sm font-semibold text-[#24883F]"><FileDown size={15} /> PDF</button></div></div>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><article className="rounded-2xl border-t-4 border-[#F7921E] bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Total à payer</p><p className="mt-1 text-2xl font-black text-[#F7921E]">{fcfa(net)}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Déjà payé</p><p className="mt-1 text-2xl font-black text-[#24883F]">0 F</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">En attente</p><p className="mt-1 text-2xl font-black text-[#B45309]">{filtered.filter((row) => row.status !== 'Payé').length} dossier{filtered.filter((row) => row.status !== 'Payé').length > 1 ? 's' : ''}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">Commission GBONHI</p><p className="mt-1 text-2xl font-black text-[#24883F]">{fcfa(commission)}</p></article></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Versements partenaires</h2><label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher…" className="h-9 w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#24883F]" /></label></div><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Partenaire / Terrain</th><th className="px-4 py-3">Réservations</th><th className="px-4 py-3">Montant brut</th><th className="px-4 py-3">Commission 10%</th><th className="px-4 py-3">Net à reverser</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Relevé</th></tr></thead><tbody className="divide-y divide-slate-100">{!loaded ? <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Chargement…</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="px-5 py-9 text-center text-slate-400">Aucun versement sur cette période.</td></tr> : filtered.map((row) => { const rowGross = Math.round(row.amountOwed / 0.9); const rowCommission = rowGross - row.amountOwed; return <tr key={row.partnerId} className="hover:bg-slate-50/70"><td className="px-5 py-3"><p className="font-bold text-slate-900">{row.terrains[0] ?? 'Terrain partenaire'}</p><p className="mt-0.5 text-xs text-slate-400">{row.partnerName}{row.terrains.length > 1 ? ` · +${row.terrains.length - 1} terrain(s)` : ''}</p></td><td className="px-4 py-3 text-slate-700">{row.transactions}</td><td className="px-4 py-3 text-slate-700">{fcfa(rowGross)}</td><td className="px-4 py-3 font-semibold text-[#24883F]">{fcfa(rowCommission)}</td><td className="px-4 py-3 font-bold text-[#F7921E]">{fcfa(row.amountOwed)}</td><td className="px-4 py-3"><Badge status={row.status} /></td><td className="px-4 py-3"><button onClick={() => downloadBlob(createPdfBlob('Relevé partenaire', 'Période active', [['Partenaire', row.partnerName], ['Terrains', row.terrains.join(', ')], ['Réservations', row.transactions], ['Net à reverser', row.amountOwed]]), `releve-${row.partnerName.toLocaleLowerCase('fr').replaceAll(/[^a-z0-9]+/g, '-')}.pdf`)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"><Download size={13} /> Reçu</button></td></tr>; })}</tbody>{filtered.length > 0 && <tfoot><tr style={{ backgroundColor: '#0D1F0D' }} className="font-bold text-white"><td className="px-5 py-3">TOTAL</td><td className="px-4 py-3">{filtered.reduce((sum, row) => sum + row.transactions, 0)}</td><td className="px-4 py-3">{fcfa(gross)}</td><td className="px-4 py-3 text-emerald-300">{fcfa(commission)}</td><td className="px-4 py-3 text-[#FFB830]">{fcfa(net)}</td><td colSpan={2} /></tr></tfoot>}</table></div></section>
  </>;
}
