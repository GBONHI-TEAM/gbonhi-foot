'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { TicketsManager } from '../../../components/support/tickets-manager';
import { apiFetch } from '../../../lib/api';

const TYPES = ['Blessure', 'Altercation physique', 'Comportement', 'Tricherie', 'Autre'];
const PRIORITIES = ['basse', 'normale', 'haute', 'critique'] as const;

export default function IncidentsPage() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  return <>
    <Header title="Incidents" />
    <div className="mb-5 flex items-center justify-between gap-4"><p className="text-sm text-gray-500">Signalements liés aux matchs, aux équipes ou aux terrains.</p><button onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#F7921E] px-5 text-sm font-bold text-white"><AlertTriangle size={17} />Signaler un incident</button></div>
    <TicketsManager kind="incident" refreshKey={refreshKey} />
    {open && <IncidentModal onClose={() => setOpen(false)} onCreated={() => { setOpen(false); setRefreshKey((key) => key + 1); }} />}
  </>;
}

function IncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [category, setCategory] = useState(TYPES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('normale');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 3) { setError('Renseignez un intitulé et une description précis.'); return; }
    setSaving(true); setError('');
    try { await apiFetch('/support/tickets', { method: 'POST', body: JSON.stringify({ kind: 'incident', category, subject: subject.trim(), message: message.trim(), priority }) }); onCreated(); }
    catch { setError('L’incident n’a pas pu être enregistré. Vérifie la connexion puis réessaie.'); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
    <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl">
      <div className="flex items-start justify-between"><div><h2 className="text-2xl font-black text-gray-900">Signaler un incident</h2><p className="mt-1 text-sm text-gray-500">Décris les faits pour permettre leur traitement.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X size={19} /></button></div>
      <label className="mt-6 block text-sm font-bold text-gray-700">Intitulé de l’incident<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={150} placeholder="Ex. Altercation après le match FC Adjamé vs Yopougon Stars" className="mt-2 h-12 w-full rounded-lg border border-gray-200 px-4 text-sm outline-none focus:border-[#1E7A3A]" /></label>
      <div className="mt-5"><p className="text-sm font-bold text-gray-700">Type d’incident</p><div className="mt-2 flex flex-wrap gap-2">{TYPES.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className="h-10 rounded-lg border px-3 text-sm font-semibold" style={{ borderColor: category === item ? '#1E7A3A' : '#E5E7EB', color: category === item ? '#1E7A3A' : '#6B7280', backgroundColor: category === item ? '#F0FDF4' : 'white' }}>{item}</button>)}</div></div>
      <label className="mt-5 block text-sm font-bold text-gray-700">Description<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={5} placeholder="Décris objectivement le contexte, les personnes impliquées et les faits constatés…" className="mt-2 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#1E7A3A]" /></label>
      <div className="mt-5"><p className="text-sm font-bold text-gray-700">Gravité</p><div className="mt-2 flex gap-2">{PRIORITIES.map((item) => <button type="button" key={item} onClick={() => setPriority(item)} className="h-10 rounded-lg border px-3 capitalize text-sm font-semibold" style={{ borderColor: priority === item ? '#DC2626' : '#E5E7EB', color: priority === item ? '#DC2626' : '#6B7280', backgroundColor: priority === item ? '#FEF2F2' : 'white' }}>{item}</button>)}</div></div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="h-11 rounded-lg border border-gray-200 px-5 text-sm font-semibold text-gray-600">Annuler</button><button disabled={saving} className="h-11 rounded-lg bg-[#1E7A3A] px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Enregistrement…' : 'Enregistrer l’incident'}</button></div>
    </form>
  </div>;
}
