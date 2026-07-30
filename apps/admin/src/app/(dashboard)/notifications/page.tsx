'use client';
import { useEffect, useState } from 'react';
import { Bell, Send } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface ApiNotification {
  id: string;
  title: string | null;
  body: string | null;
  type: string | null;
  broadcast: boolean | null;
  created_at: string | null;
}

const INPUT_CLS =
  'w-full h-11 px-4 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition';

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [broadcast, setBroadcast] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<ApiNotification[]>('/notifications/all');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setFeedback('Renseignez un titre et un message.');
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), body: body.trim(), broadcast }),
      });
      setTitle('');
      setBody('');
      setFeedback('Notification envoyée.');
      await load();
    } catch {
      setFeedback("Échec de l'envoi de la notification.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header title="Notifications" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Formulaire d'envoi */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Envoyer une notification</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Titre</label>
              <input className={INPUT_CLS} placeholder="Ex : Nouvelle journée publiée" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-800 mb-2">Message</label>
              <textarea
                className="w-full min-h-28 px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                placeholder="Contenu de la notification…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={broadcast} onChange={(e) => setBroadcast(e.target.checked)} className="w-4 h-4 accent-[#1E7A3A]" />
              <span className="text-sm text-gray-700">Diffuser à tous les utilisateurs</span>
            </label>

            {feedback && <p className="text-sm" style={{ color: feedback.includes('Échec') || feedback.includes('Renseignez') ? '#DC2626' : '#15803D' }}>{feedback}</p>}

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#F7921E' }}
            >
              <Send size={16} /> {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </div>

        {/* Historique */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Historique des notifications</h2>
          </div>
          {loaded && items.length === 0 ? (
            <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F0FDF4', color: '#1E7A3A' }}>
                <Bell size={26} strokeWidth={1.8} />
              </div>
              <p className="text-base font-bold text-gray-900">Aucune notification envoyée</p>
              <p className="text-sm text-gray-400 mt-1">Les notifications diffusées apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {!loaded && <li className="px-6 py-16 text-center text-gray-400 text-sm">Chargement…</li>}
              {items.map((n) => (
                <li key={n.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{n.title?.trim() || 'Sans titre'}</p>
                      {n.body && <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>}
                    </div>
                    {n.broadcast && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                        Diffusion
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{fmtDateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
