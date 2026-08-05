'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '../../../../components/layout/header';
import { apiFetch } from '../../../../lib/api';

interface Cost { id: string; label: string; category: string; amount: number; incurred_on: string; }
const CATEGORIES = [{ value: 'ARBITRAGE', label: 'Arbitrage' }, { value: 'SUPERVISION', label: 'Supervision' }, { value: 'LOGISTIQUE', label: 'Logistique' }, { value: 'MARKETING', label: 'Marketing' }, { value: 'INFRASTRUCTURE', label: 'Infrastructure' }, { value: 'AUTRE', label: 'Autre coût' }];
const fcfa = (value: number) => `${value.toLocaleString('fr-FR')} F`;
const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const categoryLabel = (value: string) => CATEGORIES.find((category) => category.value === value)?.label ?? value;

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-600">{label}{children}</label>; }

export default function DeclarerCoutsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [category, setCategory] = useState('ARBITRAGE');
  const [beneficiary, setBeneficiary] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() { try { const data = await apiFetch<Cost[]>('/finance/costs'); setCosts(Array.isArray(data) ? data : []); } catch { setCosts([]); } finally { setLoaded(true); } }
  useEffect(() => { void load(); }, [searchParams]);
  const total = useMemo(() => costs.reduce((sum, cost) => sum + cost.amount, 0), [costs]);

  async function submit() {
    setError('');
    const parsedAmount = Number.parseInt(amount.replace(/\s/g, ''), 10);
    if (!beneficiary.trim()) return setError('Indique le bénéficiaire ou le libellé du coût.');
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) return setError('Le montant doit être un nombre entier supérieur à 0.');
    setSaving(true);
    try {
      const label = description.trim() ? `${beneficiary.trim()} — ${description.trim()}` : beneficiary.trim();
      await apiFetch('/finance/costs', { method: 'POST', body: JSON.stringify({ label, category, amount: parsedAmount, incurred_on: date }) });
      setBeneficiary(''); setDescription(''); setAmount(''); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer ce coût."); } finally { setSaving(false); }
  }
  async function remove(id: string) { const previous = costs; setCosts((current) => current.filter((cost) => cost.id !== id)); try { await apiFetch(`/finance/costs/${id}`, { method: 'DELETE' }); } catch { setCosts(previous); } }

  return <>
    <Header title="Déclarer des coûts" />
    <p className="mb-5 text-sm text-slate-400">Finance <span className="mx-1">›</span> <strong className="text-[#24883F]">Déclarer des coûts</strong></p>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.85fr)]"><section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><div className="grid grid-cols-1 gap-5 md:grid-cols-2"><Field label="Type de coût"><select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#24883F]">{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><Field label="Montant (FCFA)"><input value={amount} inputMode="numeric" onChange={(event) => setAmount(event.target.value)} placeholder="45 000" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#24883F]" /></Field><Field label="Date"><div className="relative mt-2"><CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#24883F]" /></div></Field><Field label={<>Bénéficiaire <span className="font-normal text-slate-400">ou libellé</span></>}><input value={beneficiary} onChange={(event) => setBeneficiary(event.target.value)} placeholder="Arbitre Koffi Yao" className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#24883F]" /></Field></div><Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Indemnité d'arbitrage pour la journée 3…" className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 outline-none focus:border-[#24883F]" /></Field>{error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button onClick={() => router.push('/finance')} className="h-11 rounded-lg border border-slate-200 px-5 text-sm font-bold text-slate-600">Annuler</button><button disabled={saving} onClick={submit} className="h-11 rounded-lg bg-[#F7921E] px-5 text-sm font-bold text-slate-900 disabled:opacity-60">{saving ? 'Enregistrement…' : 'Enregistrer le coût'}</button></div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-900">Coûts récents</h2><span className="text-sm font-bold text-red-500">{fcfa(total)}</span></div><div className="overflow-x-auto"><table className="min-w-[540px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Bénéficiaire / libellé</th><th className="px-4 py-3 text-right">Montant</th><th /></tr></thead><tbody className="divide-y divide-slate-100">{!loaded ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Chargement…</td></tr> : costs.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Aucun coût déclaré.</td></tr> : costs.slice(0, 12).map((cost) => <tr key={cost.id}><td className="px-5 py-3 text-slate-600">{formatDate(cost.incurred_on)}</td><td className="px-4 py-3 text-slate-700">{categoryLabel(cost.category)}</td><td className="px-4 py-3 font-medium text-slate-800">{cost.label}</td><td className="px-4 py-3 text-right font-bold text-slate-900">{fcfa(cost.amount)}</td><td className="px-4 py-3 text-right"><button onClick={() => remove(cost.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Supprimer"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div></section></div>
  </>;
}
