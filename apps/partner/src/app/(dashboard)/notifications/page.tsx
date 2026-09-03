'use client';

import { useEffect, useState } from 'react';
import { BellRing, CheckCheck, CalendarClock } from 'lucide-react';
import { Header } from '../../../components/layout/header';
import { apiFetch } from '../../../lib/api';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Notif[]>('/notifications');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function markAll() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }

  async function markOne(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <Header title="Notifications" subtitle={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'} />
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Vos notifications</h2>
          {unread > 0 && (
            <button onClick={markAll} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:border-[#1E7A3A]">
              <CheckCheck size={15} /> Tout marquer lu
            </button>
          )}
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-gray-400">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
            <BellRing size={28} className="mx-auto text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">Aucune notification pour le moment.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                onClick={() => !n.read && markOne(n.id)}
                className="flex cursor-pointer gap-3 rounded-2xl border bg-white p-4 shadow-sm transition"
                style={{ borderColor: n.read ? '#F1F5F9' : '#FDE9CF', backgroundColor: n.read ? 'white' : '#FFFBF4' }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: '#FEF0DC', color: '#F7921E' }}>
                  <CalendarClock size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#F7921E' }} />}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>
                  <p className="mt-1 text-xs text-gray-400">{fmt(n.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
