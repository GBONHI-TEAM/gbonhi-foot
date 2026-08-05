'use client';

import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface ApiNotification { id: string; title: string | null; body: string | null; type: string | null; broadcast: boolean | null; created_at: string | null; }
type Target = 'all' | 'league' | 'reservation';

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-[#1E7A3A] focus:ring-1 focus:ring-[#1E7A3A]';

export default function NotificationsPage() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    try { setItems(await apiFetch<ApiNotification[]>('/notifications/all')); }
    catch { setItems([]); }
    finally { setLoaded(true); }
  }
  useEffect(() => { void load(); }, []);

  async function send() {
    if (!title.trim() || !body.trim()) { setFeedback('Saisissez un titre et un message avant l’envoi.'); return; }
    setSending(true); setFeedback(null);
    try {
      // L'API actuelle sait diffuser globalement. Les cibles de mode préparent
      // l'interface sans prétendre cibler des utilisateurs tant que l'API dédiée n'est pas livrée.
      await apiFetch('/notifications', { method: 'POST', body: JSON.stringify({ title: title.trim(), body: body.trim(), broadcast: true }) });
      setTitle(''); setBody(''); setFeedback('Notification envoyée aux utilisateurs concernés.'); await load();
    } catch { setFeedback('L’envoi n’a pas abouti. Vérifie la connexion puis réessaie.'); }
    finally { setSending(false); }
  }

  const targetLabels: Record<Target, string> = { all: 'Tous les utilisateurs', league: 'Mode League', reservation: 'Mode Réservation' };
  return <>
    <Header title="Envoyer une notification push" />
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)]">
      <section className="space-y-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="block text-sm font-bold text-gray-700">Titre <span className="font-medium text-gray-400">(max. 50 car.)</span>
            <input maxLength={50} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="🏆 Ligue Élite : la finale approche !" className={`${inputClass} mt-2 h-12`} />
          </label>
          <label className="mt-5 block text-sm font-bold text-gray-700">Message <span className="font-medium text-gray-400">(max. 150 car.)</span>
            <textarea maxLength={150} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Rédige ton message…" className={`${inputClass} mt-2 min-h-28 py-3`} />
          </label>
          <p className="mt-1 text-right text-xs text-gray-400">{body.length} / 150</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-700">Cible</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(targetLabels) as Target[]).map((value) => <button key={value} onClick={() => setTarget(value)} className="h-10 rounded-lg border px-4 text-sm font-semibold" style={{ borderColor: target === value ? '#1E7A3A' : '#E5E7EB', color: target === value ? '#1E7A3A' : '#6B7280', backgroundColor: target === value ? '#F0FDF4' : 'white' }}>{targetLabels[value]}</button>)}
          </div>
          {target !== 'all' && <p className="mt-3 text-xs text-amber-700">La diffusion est actuellement globale ; le ciblage par mode sera activé avec l’API de segmentation.</p>}
        </div>
        {feedback && <p className="rounded-lg border px-4 py-3 text-sm" style={{ backgroundColor: feedback.startsWith('Notification') ? '#F0FDF4' : '#FEF2F2', borderColor: feedback.startsWith('Notification') ? '#BBF7D0' : '#FECACA', color: feedback.startsWith('Notification') ? '#166534' : '#B91C1C' }}>{feedback}</p>}
        <div className="flex gap-3"><button onClick={() => { setTitle(''); setBody(''); setFeedback(null); }} className="h-12 flex-1 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600">Annuler</button><button onClick={() => void send()} disabled={sending} className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg bg-[#F7921E] text-sm font-bold text-white disabled:opacity-60"><Send size={17} />{sending ? 'Envoi…' : 'Envoyer la notification'}</button></div>
      </section>
      <aside className="space-y-4">
        <div><h2 className="mb-2 text-sm font-bold text-gray-700">Aperçu</h2><div className="rounded-[26px] bg-[#171717] p-5 text-white shadow-sm"><p className="mb-3 text-center text-xs text-white/45">maintenant · 09:41</p><div className="rounded-2xl bg-white/15 p-3"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-lg">⚽</div><div className="min-w-0"><p className="text-xs text-white/60">GBONHI FOOT · maintenant</p><p className="truncate text-sm font-bold">{title || 'Titre de votre notification'}</p><p className="mt-1 line-clamp-2 text-xs text-white/75">{body || 'Le contenu de votre notification apparaîtra ici.'}</p></div></div></div></div></div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-bold text-gray-900">Historique</h2></div>{!loaded ? <p className="px-5 py-10 text-center text-sm text-gray-400">Chargement…</p> : items.length === 0 ? <div className="px-5 py-10 text-center text-sm text-gray-400"><Bell className="mx-auto mb-2 text-gray-300" />Aucune notification envoyée.</div> : <table className="w-full text-left text-xs"><thead className="bg-gray-50 text-gray-400"><tr><th className="px-4 py-3">Titre</th><th className="px-4 py-3">Cible</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y divide-gray-50">{items.slice(0, 6).map((item) => <tr key={item.id}><td className="max-w-[150px] truncate px-4 py-3 font-medium text-gray-700">{item.title || 'Sans titre'}</td><td className="px-4 py-3 text-[#1E7A3A]">{item.broadcast ? 'Tous' : 'Ciblée'}</td><td className="whitespace-nowrap px-4 py-3 text-gray-400">{fmtDateTime(item.created_at)}</td></tr>)}</tbody></table>}</div>
      </aside>
    </div>
  </>;
}
