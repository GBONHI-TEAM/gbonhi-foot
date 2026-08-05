'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileDown, Plus, Sheet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';
import { createPdfBlob, createXlsxBlob, downloadBlob } from '../../../lib/file-export';

interface Summary { ca: number; commission: number; reverse: number; transactions: number; costs: number; marge: number; }
interface Cost { id: string; category: string; amount: number; }
interface Reservation { id: string; reservation_date: string; total_price: number | null; status: string; }

const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} F`;
const isPaid = (status: string) => ['confirmed', 'completed', 'CONFIRMED', 'COMPLETED'].includes(status);

function RangeChips() {
  const router = useRouter();
  const params = useSearchParams();
  const activeFrom = params.get('from') ?? '';
  const activeTo = params.get('to') ?? '';
  const today = new Date();

  function format(value: Date) { return value.toISOString().slice(0, 10); }
  function apply(days?: number) {
    const end = new Date();
    const start = new Date();
    if (days === undefined) start.setDate(1);
    else if (days === 0) start.setHours(0, 0, 0, 0);
    else start.setDate(start.getDate() - days + 1);
    const next = new URLSearchParams(params.toString());
    next.set('from', format(start)); next.set('to', format(end));
    router.replace(`/finance?${next.toString()}`);
  }
  const currentMonth = activeFrom === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  return <div className="flex flex-wrap gap-2">
    <button onClick={() => apply()} className={`h-10 rounded-lg border px-4 text-sm font-semibold ${currentMonth ? 'border-[#24883F] bg-[#24883F] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Ce mois</button>
    <button onClick={() => apply(0)} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">Aujourd&apos;hui</button>
    <button onClick={() => apply(7)} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">7j</button>
    <button onClick={() => apply(30)} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">30j</button>
    <span className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500">Période</span>
  </div>;
}

function MetricCard({ label, value, note, emphasis, color }: { label: string; value: string; note?: string; emphasis?: boolean; color?: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={emphasis ? { backgroundColor: '#0D1F0D', borderColor: '#0D1F0D' } : undefined}>
    <p className={emphasis ? 'text-sm text-white/60' : 'text-sm text-slate-500'}>{label}</p>
    <p className="mt-1 text-[26px] font-black leading-none" style={{ color: emphasis ? 'white' : color ?? '#102A18' }}>{value}</p>
    {note && <p className={`mt-2 text-xs font-semibold ${emphasis ? 'text-white/55' : 'text-slate-400'}`}>{note}</p>}
  </article>;
}

function BarChart({ reservations }: { reservations: Reservation[] }) {
  const values = useMemo(() => {
    const days = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (5 - index) * 5);
      return { timestamp: date.getTime(), label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }), value: 0 };
    });
    reservations.filter((reservation) => isPaid(reservation.status)).forEach((reservation) => {
      const index = Math.max(0, Math.min(5, Math.floor((new Date(reservation.reservation_date).getTime() - days[0].timestamp) / 432_000_000)));
      if (Number.isFinite(index)) days[index].value += reservation.total_price ?? 0;
    });
    return days;
  }, [reservations]);
  const max = Math.max(1, ...values.map((item) => item.value));
  return <div className="mt-8 flex h-56 items-end justify-between gap-4 px-3">{values.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-[190px] items-end gap-1"><span className="w-5 rounded-t bg-[#24883F]" style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }} /><span className="w-5 rounded-t bg-[#F7921E]" style={{ height: `${Math.max(6, (item.value / max) * 72)}%` }} /></div><span className="text-xs text-slate-400">{item.label}</span></div>)}</div>;
}

function CostBreakdown({ costs }: { costs: Cost[] }) {
  const grouped = useMemo(() => {
    const totals = new Map<string, number>();
    costs.forEach((cost) => totals.set(cost.category, (totals.get(cost.category) ?? 0) + cost.amount));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [costs]);
  const total = grouped.reduce((sum, [, amount]) => sum + amount, 0);
  const colors = ['#24883F', '#F7921E', '#FFB830', '#94A3B8'];
  const segments = grouped.length ? grouped.map(([, amount]) => (amount / Math.max(1, total)) * 100) : [100];
  const gradient = segments.reduce((text, part, index) => `${text}${colors[index % colors.length]} ${segments.slice(0, index).reduce((sum, value) => sum + value, 0)}% ${segments.slice(0, index + 1).reduce((sum, value) => sum + value, 0)}%, `, 'conic-gradient(').slice(0, -2) + ')';
  return <div className="flex flex-col justify-between"><div className="flex items-center gap-5"><div className="h-24 w-24 flex-none rounded-full" style={{ background: total ? gradient : '#E2E8F0', maskImage: 'radial-gradient(circle, transparent 51%, black 52%)' }} /><div className="space-y-2">{grouped.length ? grouped.slice(0, 4).map(([category, amount], index) => <p key={category} className="flex items-center gap-2 text-sm text-slate-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[index] }} />{category} <strong className="ml-auto text-slate-800">{fcfa(amount)}</strong></p>) : <p className="text-sm text-slate-400">Aucun coût sur cette période.</p>}</div></div><div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm"><div className="flex justify-between font-bold text-slate-800"><span>Total coûts</span><span className="text-red-500">{fcfa(total)}</span></div></div></div>;
}

export default function FinancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([
      apiFetch<Summary>('/finance/summary').catch(() => null),
      apiFetch<Cost[]>('/finance/costs').catch(() => []),
      apiFetch<Reservation[]>('/reservations/all').catch(() => []),
    ]).then(([summaryData, costData, reservationData]) => { setSummary(summaryData); setCosts(costData); setReservations(reservationData); setLoaded(true); });
  }, [searchParams]);

  const value = (amount?: number) => loaded && summary ? fcfa(amount ?? 0) : '—';
  const period = searchParams.get('from') || searchParams.get('to') ? `${searchParams.get('from') ?? 'Début'} au ${searchParams.get('to') ?? 'aujourd’hui'}` : 'Toutes les périodes';
  const rows: Array<[string, string | number]> = [['Chiffre d’affaires (FCFA)', summary?.ca ?? 0], ['Commission GBONHI (FCFA)', summary?.commission ?? 0], ['Reversé partenaires (FCFA)', summary?.reverse ?? 0], ['Coûts déclarés (FCFA)', summary?.costs ?? 0], ['Marge nette (FCFA)', summary?.marge ?? 0], ['Transactions', summary?.transactions ?? 0]];
  const fileName = `gbonhi-foot-finance-${new Date().toISOString().slice(0, 10)}`;

  return <>
    <Header title="Dashboard Finance" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><RangeChips /><div className="flex flex-wrap gap-2"><button onClick={() => router.push('/finance/partenaires')} className="h-10 rounded-lg border border-[#24883F] bg-white px-4 text-sm font-bold text-[#24883F]">Partenaires à payer</button><button onClick={() => router.push('/finance/couts')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F7921E] px-4 text-sm font-bold text-slate-900"><Plus size={16} /> Déclarer des coûts</button></div></div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5"><p className="text-sm text-slate-500">Période active : <strong className="text-slate-800">{period}</strong></p><div className="flex gap-2"><button onClick={() => downloadBlob(createXlsxBlob('Finance', [['Indicateur', 'Valeur'], ...rows]), `${fileName}.xlsx`)} className="inline-flex items-center gap-1 rounded-lg border border-[#24883F] px-3 py-1.5 text-sm font-semibold text-[#24883F]"><Sheet size={15} /> XLSX</button><button onClick={() => downloadBlob(createPdfBlob('Synthèse financière', period, rows), `${fileName}.pdf`)} className="inline-flex items-center gap-1 rounded-lg bg-[#24883F] px-3 py-1.5 text-sm font-semibold text-white"><FileDown size={15} /> PDF</button></div></div>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard emphasis label="Revenu total" value={value(summary?.ca)} note="Réservations confirmées" /><MetricCard label="Rev. Réservations" value={value(summary?.ca)} note="100% du CA actuel" /><MetricCard label="Rev. Ligues" value="—" note="Flux à raccorder" /><MetricCard label="Rev. Partenaires" value={value(summary?.reverse)} note="Montant à reverser" /><MetricCard label="Marge nette" value={value(summary?.marge)} color={summary && summary.marge < 0 ? '#EF4444' : '#16B978'} note="Commission − coûts" /></section>
    <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2"><MetricCard label="Autres coûts déclarés" value={value(summary?.costs)} /><MetricCard label="Marge nette (après coûts déclarés)" value={value(summary?.marge)} color={summary && summary.marge < 0 ? '#EF4444' : '#16B978'} /></section>
    <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Revenus Réservations vs Leagues · période</h2><p className="mt-1 text-sm text-slate-400">Les barres vertes reflètent les réservations payées. Les ligues seront visibles lorsque leurs paiements seront consolidés.</p><BarChart reservations={reservations} /></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">Coûts</h2><div className="mt-5"><CostBreakdown costs={costs} /></div><button onClick={() => router.push('/finance/couts')} className="mt-7 h-11 w-full rounded-lg bg-[#F7921E] text-sm font-bold text-slate-900">Déclarer des coûts</button></article></section>
  </>;
}
