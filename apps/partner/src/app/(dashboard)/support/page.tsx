'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Header } from '../../../components/layout/header';
import { ChevronRight, LifeBuoy, Loader2, Mail, MessageCircle, Plus, X } from 'lucide-react';
import { apiFetch } from '../../../lib/api';

const FAQ = [
  "Comment fonctionne le statut d'ouverture de mon terrain ?",
  'Quand sont reversés mes revenus ?',
  'Que se passe-t-il pour un match de League ?',
];
const FILTERS = ['Toutes', 'Ouvertes', 'En cours', 'Résolues'] as const;
type Filter = (typeof FILTERS)[number];
type TicketStatus = 'ouvert' | 'en_cours' | 'resolu' | 'ferme';
interface Ticket { id: string; subject: string; message: string; category: string | null; priority: string; status: TicketStatus; response: string | null; created_at: string; updated_at: string }

const statusMeta: Record<TicketStatus, { label: string; bg: string; color: string }> = {
  ouvert: { label: 'Ouverte', bg: '#FEF3C7', color: '#92400E' },
  en_cours: { label: 'En cours', bg: '#DBEAFE', color: '#1D4ED8' },
  resolu: { label: 'Résolue', bg: '#DCFCE7', color: '#166534' },
  ferme: { label: 'Fermée', bg: '#F3F4F6', color: '#4B5563' },
};
function apiError(error: unknown) {
  if (!(error instanceof Error)) return 'Une erreur est survenue. Réessaie dans quelques instants.';
  const body = error.message.split(' — ')[1];
  if (!body) return 'Une erreur est survenue. Réessaie dans quelques instants.';
  try { const parsed = JSON.parse(body) as { message?: string | string[] }; return Array.isArray(parsed.message) ? parsed.message[0] : parsed.message ?? 'Une erreur est survenue.'; } catch { return 'Une erreur est survenue. Réessaie dans quelques instants.'; }
}

export default function SupportPage() {
  const [filter, setFilter] = useState<Filter>('Toutes');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normale');
  const [saving, setSaving] = useState(false);

  const status = filter === 'Toutes' ? '' : filter === 'Ouvertes' ? 'ouvert' : filter === 'En cours' ? 'en_cours' : 'resolu';
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const list = await apiFetch<Ticket[]>(`/support/tickets?kind=support${status ? `&status=${status}` : ''}`); setTickets(Array.isArray(list) ? list : []); }
    catch (reason) { setTickets([]); setError(apiError(reason)); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await apiFetch('/support/tickets', { method: 'POST', body: JSON.stringify({ kind: 'support', subject: subject.trim(), category: category.trim() || undefined, message: message.trim(), priority }) });
      setSubject(''); setCategory(''); setMessage(''); setPriority('normale'); setModal(false); await load();
    } catch (reason) { setError(apiError(reason)); }
    finally { setSaving(false); }
  }

  return <>
    <Header title="Support & Assistance" subtitle="Nous sommes là pour vous aider" />
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6"><div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="mb-4 text-[14px] font-semibold text-gray-900">Nous contacter</h2><div className="space-y-2.5"><a href="mailto:support@gbonhifoot.com" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50"><Mail size={15} className="text-gray-400" />support@gbonhifoot.com</a><button onClick={() => setModal(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold text-white" style={{ backgroundColor: '#1A3D2B' }}><MessageCircle size={15} />Écrire au support</button></div></div><div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="mb-2 text-[14px] font-semibold text-gray-900">FAQ rapide</h2><div className="divide-y divide-gray-100">{FAQ.map((question) => <button key={question} onClick={() => { setCategory('Question fréquente'); setSubject(question); setModal(true); }} className="flex w-full items-center justify-between py-3 text-left hover:text-gray-900"><span className="text-[13px] text-gray-600">{question}</span><ChevronRight size={15} className="shrink-0 text-gray-300" /></button>)}</div></div></div>
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-[14px] font-semibold text-gray-900">Mes demandes</h2><p className="text-[12px] text-gray-400">Suivez les réponses du support.</p></div><button onClick={() => setModal(true)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: '#1A3D2B' }}><Plus size={13} />Nouvelle demande</button></div><div className="mb-4 flex flex-wrap gap-1.5">{FILTERS.map((item) => <button key={item} onClick={() => setFilter(item)} className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors" style={{ backgroundColor: filter === item ? '#F0FDF4' : 'white', color: filter === item ? '#065F46' : '#6B7280', borderColor: filter === item ? '#A7F3D0' : '#E5E7EB' }}>{item}</button>)}</div>{loading ? <div className="flex justify-center gap-2 py-14 text-[13px] text-gray-400"><Loader2 size={16} className="animate-spin" />Chargement…</div> : tickets.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center"><LifeBuoy size={26} className="mb-3 text-gray-300" /><p className="text-[13px] font-medium text-gray-500">Aucune demande pour le moment</p><p className="mt-1 max-w-xs text-[12px] text-gray-400">Vos demandes de support et les réponses reçues apparaîtront ici.</p></div> : <div className="divide-y divide-gray-100">{tickets.map((ticket) => { const meta = statusMeta[ticket.status]; return <article key={ticket.id} className="py-3 first:pt-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-gray-900">{ticket.subject}</p><p className="mt-0.5 text-[11px] text-gray-400">{new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}{ticket.category ? ` · ${ticket.category}` : ''}</p></div><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>{meta.label}</span></div>{ticket.response && <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-800"><span className="font-semibold">Réponse GBONHI FOOT : </span>{ticket.response}</div>}</article>; })}</div>}</div>
    </div>
    {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-gray-900">Nouvelle demande</h2><p className="mt-1 text-sm text-gray-500">Le support vous répondra directement dans cet espace.</p></div><button type="button" onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-gray-700">Sujet<input required minLength={3} maxLength={150} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-gray-700">Catégorie<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ex. Créneau" className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary" /></label><label className="block text-sm font-medium text-gray-700">Priorité<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary"><option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option></select></label></div><label className="block text-sm font-medium text-gray-700">Votre message<textarea required minLength={3} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} rows={5} className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary" /></label></div><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setModal(false)} className="h-10 rounded-lg px-4 text-sm font-semibold text-gray-600 hover:bg-gray-100">Annuler</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Envoi…' : 'Envoyer'}</button></div></form></div>}
  </>;
}
